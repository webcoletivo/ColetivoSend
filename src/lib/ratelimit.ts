import { prisma } from './db'
import { logger } from './logger'

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
        // Fail open in case of DB error? Or fail closed?
        // For security (brute force), usually fail open OR closed depending on criticality. 
        // To avoid blocking valid users during DB hiccups, we might log and allow, 
        // but for STRICT security, we fail closed. 
        // Let's Log and Fail Open to prevent downtime, but warn loudly.
        logger.error('Rate limit error:', error)
        return { success: true, remaining: 1 }
    }
}
