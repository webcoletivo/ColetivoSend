import { prisma } from './db'
import { logger } from './logger'

/**
 * Simple database-backed rate limiter using a fixed-window algorithm.
 *
 * @param key Unique identifier for the action and actor (e.g., 'signup:1.2.3.4')
 * @param limit Maximum number of allowed actions within the window
 * @param windowSeconds Window duration in seconds
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<{ success: boolean; remaining: number }> {
    const now = new Date()
    const windowStart = new Date(now.getTime() - windowSeconds * 1000)

    // Clean up old entries occasionally (could be a cron, but doing it lazily here/mostly relying on Prisma TTL if supported, or manual cleanup)
    // For strict correctness without cron, we can query valid count efficiently.

    // Strategy: Upsert a record for the key. 
    // Note: The current schema has `model RateLimit { id, key, count, expiresAt }`.
    // This looks like a "fixed window" approach per key (expiresAt defines the window end).

    try {
        const record = await prisma.rateLimit.findUnique({
            where: { key }
        })

        if (!record) {
            // Create new window
            await prisma.rateLimit.create({
                data: {
                    key,
                    count: 1,
                    expiresAt: new Date(now.getTime() + windowSeconds * 1000)
                }
            })
            return { success: true, remaining: limit - 1 }
        }

        if (now > record.expiresAt) {
            // Window expired, reset
            await prisma.rateLimit.update({
                where: { key },
                data: {
                    count: 1,
                    expiresAt: new Date(now.getTime() + windowSeconds * 1000)
                }
            })
            return { success: true, remaining: limit - 1 }
        }

        // Window active, check limit
        if (record.count >= limit) {
            return { success: false, remaining: 0 }
        }

        // Increment
        await prisma.rateLimit.update({
            where: { key },
            data: {
                count: { increment: 1 }
            }
        })

        return { success: true, remaining: limit - (record.count + 1) }

    } catch (error) {
        // Fail CLOSED: this limiter guards brute-force/abuse on auth, signup and
        // password endpoints. The app requires the DB for those flows anyway, so
        // a DB outage does not create extra availability loss — but failing open
        // would silently disable brute-force protection. Deny on error.
        logger.error('Rate limit error:', error)
        return { success: false, remaining: 0 }
    }
}

/**
 * Contador de FALHAS (senha errada): só as tentativas erradas contam, para
 * quem acertou a senha não ser bloqueado ao baixar vários arquivos. Par de
 * funções: `bloqueadoPorFalhas` antes de verificar, `registrarFalha` depois
 * de um erro. Em erro de banco, considera bloqueado (fail closed).
 */
export async function bloqueadoPorFalhas(key: string, limit: number): Promise<boolean> {
    try {
        const record = await prisma.rateLimit.findUnique({ where: { key } })
        if (!record) return false
        if (new Date() > record.expiresAt) return false
        return record.count >= limit
    } catch (error) {
        logger.error('Rate limit error:', error)
        return true
    }
}

export async function registrarFalha(key: string, windowSeconds: number): Promise<void> {
    const now = new Date()
    try {
        const record = await prisma.rateLimit.findUnique({ where: { key } })
        if (!record || now > record.expiresAt) {
            await prisma.rateLimit.upsert({
                where: { key },
                create: { key, count: 1, expiresAt: new Date(now.getTime() + windowSeconds * 1000) },
                update: { count: 1, expiresAt: new Date(now.getTime() + windowSeconds * 1000) },
            })
            return
        }
        await prisma.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } })
    } catch (error) {
        logger.error('Rate limit error:', error)
    }
}
