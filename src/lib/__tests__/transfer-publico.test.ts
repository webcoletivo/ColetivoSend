import { describe, it, expect } from 'vitest'
import { estadoPublico, respostaDeEstado, VALIDADE_URL_DOWNLOAD_SEGUNDOS } from '../transfer-publico'

const agora = new Date('2026-09-24T12:00:00Z')
const futuro = new Date('2026-09-25T12:00:00Z')
const passado = new Date('2026-09-23T12:00:00Z')

describe('estadoPublico', () => {
    it('ativo e dentro do prazo é ok', () => {
        expect(estadoPublico({ status: 'active', expiresAt: futuro }, agora)).toBe('ok')
        expect(estadoPublico({ status: 'active', expiresAt: futuro.toISOString() }, agora)).toBe('ok')
    })

    it('data vencida expira mesmo com status active', () => {
        expect(estadoPublico({ status: 'active', expiresAt: passado }, agora)).toBe('expired')
        expect(estadoPublico({ status: 'active', expiresAt: agora }, agora)).toBe('expired')
    })

    it('status expired/revoked/deleted valem mesmo com data futura', () => {
        expect(estadoPublico({ status: 'expired', expiresAt: futuro }, agora)).toBe('expired')
        expect(estadoPublico({ status: 'revoked', expiresAt: futuro }, agora)).toBe('revoked')
        expect(estadoPublico({ status: 'deleted', expiresAt: futuro }, agora)).toBe('notfound')
    })

    it('status desconhecido não é servido', () => {
        expect(estadoPublico({ status: 'rascunho', expiresAt: futuro }, agora)).toBe('notfound')
    })
})

describe('respostaDeEstado', () => {
    it('404 genérico para não encontrado, 410 com code minúsculo para expirado/revogado', async () => {
        expect(respostaDeEstado('notfound').status).toBe(404)
        const exp = respostaDeEstado('expired')
        expect(exp.status).toBe(410)
        expect(await exp.json()).toEqual({ error: 'Este link expirou', code: 'expired' })
        const rev = respostaDeEstado('revoked')
        expect(rev.status).toBe(410)
        expect((await rev.json()).code).toBe('revoked')
    })

    it('URLs de download valem no máximo 15 minutos', () => {
        expect(VALIDADE_URL_DOWNLOAD_SEGUNDOS).toBeLessThanOrEqual(15 * 60)
    })
})
