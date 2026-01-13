import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkRateLimit } from '../ratelimit'
import { prisma } from '../db'

// Mock Prisma
vi.mock('../db', () => ({
    prisma: {
        rateLimit: {
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        }
    }
}))

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
