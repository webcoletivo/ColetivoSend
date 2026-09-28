import { describe, it, expect } from 'vitest'
import { urlDePromocaoSchema } from '@/lib/admin'

/**
 * A tela /settings/media valida a URL da propaganda no navegador (mensagem
 * inline própria, sem `required`/bolha nativa). Este teste trava o que vale de
 * verdade: o servidor (POST /api/admin/media e PATCH /api/admin/media/[id])
 * recusa qualquer coisa que não seja http(s) absoluto de até 2 KB.
 */
describe('urlDePromocaoSchema (servidor)', () => {
    it('aceita http(s) absoluto', () => {
        expect(urlDePromocaoSchema.safeParse('https://exemplo.com/promo?x=1').success).toBe(true)
        expect(urlDePromocaoSchema.safeParse('http://exemplo.com').success).toBe(true)
        expect(urlDePromocaoSchema.safeParse('HTTPS://EXEMPLO.COM/a').success).toBe(true)
    })

    it('recusa esquemas perigosos e URLs relativas ou vazias', () => {
        for (const v of [
            'javascript:alert(1)',
            'JavaScript:alert(1)',
            'data:text/html,<script>alert(1)</script>',
            'vbscript:msgbox',
            'file:///etc/passwd',
            'ftp://x/y',
            'exemplo.com',
            '/relativa',
            '//exemplo.com/sem-esquema',
            '',
            ' https://espaco-antes.com',
        ]) {
            expect(urlDePromocaoSchema.safeParse(v).success, v).toBe(false)
        }
    })

    it('recusa URL acima de 2 KB e tipos que não são string', () => {
        expect(urlDePromocaoSchema.safeParse('https://exemplo.com/' + 'a'.repeat(2048)).success).toBe(false)
        expect(urlDePromocaoSchema.safeParse(123).success).toBe(false)
        expect(urlDePromocaoSchema.safeParse(null).success).toBe(false)
        expect(urlDePromocaoSchema.safeParse({ href: 'https://x' }).success).toBe(false)
    })
})
