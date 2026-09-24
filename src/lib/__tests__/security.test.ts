import { describe, it, expect } from 'vitest'
import { generateShareToken, TAMANHO_TOKEN, ipDoPedido } from '../security'

describe('generateShareToken', () => {
    it('tem 22 caracteres do alfabeto URL-safe (≈131 bits)', () => {
        for (let i = 0; i < 200; i++) {
            const t = generateShareToken()
            expect(t).toHaveLength(TAMANHO_TOKEN)
            expect(t).toMatch(/^[A-Za-z0-9]+$/)
        }
        expect(Math.log2(62 ** TAMANHO_TOKEN)).toBeGreaterThanOrEqual(128)
    })

    it('não repete', () => {
        const vistos = new Set<string>()
        for (let i = 0; i < 2000; i++) vistos.add(generateShareToken())
        expect(vistos.size).toBe(2000)
    })

    it('usa o alfabeto inteiro (sem viés de módulo grosseiro)', () => {
        const contagem = new Map<string, number>()
        for (let i = 0; i < 3000; i++) {
            for (const c of generateShareToken()) contagem.set(c, (contagem.get(c) ?? 0) + 1)
        }
        expect(contagem.size).toBe(62)
        const valores = [...contagem.values()]
        const media = valores.reduce((a, b) => a + b, 0) / valores.length
        for (const v of valores) expect(Math.abs(v - media) / media).toBeLessThan(0.25)
    })
})

describe('ipDoPedido', () => {
    const pedido = (h: Record<string, string>) => ({ headers: { get: (n: string) => h[n.toLowerCase()] ?? null } })

    it('usa o primeiro x-forwarded-for', () => {
        expect(ipDoPedido(pedido({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }))).toBe('203.0.113.9')
    })

    it('cai no x-real-ip e depois em "desconhecido"', () => {
        expect(ipDoPedido(pedido({ 'x-real-ip': '2001:db8::1' }))).toBe('2001:db8::1')
        expect(ipDoPedido(pedido({}))).toBe('desconhecido')
    })

    it('descarta lixo injetado no cabeçalho', () => {
        expect(ipDoPedido(pedido({ 'x-forwarded-for': "1.2.3.4' OR 1=1" }))).toBe('1.2.3.4')
        expect(ipDoPedido(pedido({ 'x-forwarded-for': 'abc' }))).toBe('abc')
        expect(ipDoPedido(pedido({ 'x-forwarded-for': '!!!' }))).toBe('desconhecido')
    })
})
