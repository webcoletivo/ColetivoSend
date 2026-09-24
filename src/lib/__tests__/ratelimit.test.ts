import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkRateLimit, bloqueadoPorFalhas, registrarFalha } from '../ratelimit'
import { prisma } from '../db'

// Mock Prisma
vi.mock('../db', () => ({
    prisma: {
        rateLimit: {
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            upsert: vi.fn(),
        }
    }
}))

describe('bloqueadoPorFalhas / registrarFalha', () => {
    beforeEach(() => {
        vi.resetAllMocks()
    })

    it('sem registro ou janela vencida: não bloqueia', async () => {
        // @ts-ignore
        prisma.rateLimit.findUnique.mockResolvedValue(null)
        expect(await bloqueadoPorFalhas('senha-errada:ip:tok', 5)).toBe(false)
        // @ts-ignore
        prisma.rateLimit.findUnique.mockResolvedValue({ count: 99, expiresAt: new Date(Date.now() - 1000) })
        expect(await bloqueadoPorFalhas('senha-errada:ip:tok', 5)).toBe(false)
    })

    it('bloqueia quando as falhas na janela chegam ao limite', async () => {
        // @ts-ignore
        prisma.rateLimit.findUnique.mockResolvedValue({ count: 5, expiresAt: new Date(Date.now() + 60_000) })
        expect(await bloqueadoPorFalhas('senha-errada:ip:tok', 5)).toBe(true)
        // @ts-ignore
        prisma.rateLimit.findUnique.mockResolvedValue({ count: 4, expiresAt: new Date(Date.now() + 60_000) })
        expect(await bloqueadoPorFalhas('senha-errada:ip:tok', 5)).toBe(false)
    })

    it('em erro de banco, considera bloqueado (fail closed)', async () => {
        // @ts-ignore
        prisma.rateLimit.findUnique.mockRejectedValue(new Error('db down'))
        expect(await bloqueadoPorFalhas('senha-errada:ip:tok', 5)).toBe(true)
    })

    it('registrarFalha abre janela nova ou incrementa a atual', async () => {
        // @ts-ignore
        prisma.rateLimit.findUnique.mockResolvedValue(null)
        await registrarFalha('k', 60)
        expect(prisma.rateLimit.upsert).toHaveBeenCalledTimes(1)
        // @ts-ignore
        prisma.rateLimit.findUnique.mockResolvedValue({ count: 2, expiresAt: new Date(Date.now() + 60_000) })
        await registrarFalha('k', 60)
        expect(prisma.rateLimit.update).toHaveBeenCalledWith({ where: { key: 'k' }, data: { count: { increment: 1 } } })
    })
})

describe('checkRateLimit', () => {
    beforeEach(() => {
        vi.resetAllMocks()
    })

    it('should allow request if no record exists', async () => {
        // @ts-ignore
        prisma.rateLimit.findUnique.mockResolvedValue(null)

        const result = await checkRateLimit('test-ip', 10, 60)

        expect(prisma.rateLimit.create).toHaveBeenCalled()
        expect(result.success).toBe(true)
        expect(result.remaining).toBe(9)
    })

    it('should block if count exceeded limit within window', async () => {
        // @ts-ignore
        prisma.rateLimit.findUnique.mockResolvedValue({
            key: 'test-ip',
            count: 10,
            expiresAt: new Date(Date.now() + 100000) // Future expiry
        })

        const result = await checkRateLimit('test-ip', 10, 60)

        expect(result.success).toBe(false)
        expect(result.remaining).toBe(0)
    })

    it('should reset window if expired', async () => {
        // @ts-ignore
        prisma.rateLimit.findUnique.mockResolvedValue({
            key: 'test-ip',
            count: 10,
            expiresAt: new Date(Date.now() - 100000) // Past expiry
        })

        const result = await checkRateLimit('test-ip', 10, 60)

        expect(prisma.rateLimit.update).toHaveBeenCalled()
        expect(result.success).toBe(true)
        expect(result.remaining).toBe(9)
    })
})
