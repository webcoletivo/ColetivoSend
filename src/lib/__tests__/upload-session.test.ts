import { describe, it, expect, vi, beforeEach } from 'vitest'
import { chaveDeArmazenamento, prefixoDoDono, exigirDonoDaSessao } from '../upload-session'
import { prisma } from '../db'

// O módulo testado usa o export default; o teste, o nomeado — mesmo objeto.
vi.mock('../db', () => {
    const prisma = {
        uploadSession: {
            findUnique: vi.fn(),
        },
    }
    return { prisma, default: prisma }
})

describe('chaveDeArmazenamento', () => {
    it('fica sob o prefixo do dono e do envio', () => {
        const chave = chaveDeArmazenamento('user1', 'transfer1', 'file1', 'relatório final.pdf')
        expect(chave).toBe('transfers/user1/transfer1/file1-relat_rio_final.pdf')
        expect(chave.startsWith(prefixoDoDono('user1', 'transfer1'))).toBe(true)
    })

    it('não deixa o nome carregar caminho', () => {
        const chave = chaveDeArmazenamento('u', 't', 'f', '../../etc/passwd')
        expect(chave).toBe('transfers/u/t/f-._._etc_passwd')
        expect(chave).not.toContain('..')
        expect(chave.split('/').length).toBe(4)
    })

    it('limita o tamanho do nome e nunca fica vazio', () => {
        const chave = chaveDeArmazenamento('u', 't', 'f', 'x'.repeat(500) + '.bin')
        expect(chave.length).toBeLessThan(160)
        expect(chaveDeArmazenamento('u', 't', 'f', '///')).toBe('transfers/u/t/f-___')
    })
})

describe('exigirDonoDaSessao', () => {
    beforeEach(() => vi.resetAllMocks())

    it('passa para o dono', async () => {
        // @ts-ignore
        prisma.uploadSession.findUnique.mockResolvedValue({ userId: 'u1' })
        await expect(exigirDonoDaSessao('s1', 'u1')).resolves.toBeUndefined()
    })

    it('nega outro usuário, sessão inexistente e sessão sem dono — sempre com a mesma mensagem', async () => {
        // @ts-ignore
        prisma.uploadSession.findUnique.mockResolvedValue({ userId: 'u2' })
        await expect(exigirDonoDaSessao('s1', 'u1')).rejects.toThrow('Upload session not found')
        // @ts-ignore
        prisma.uploadSession.findUnique.mockResolvedValue(null)
        await expect(exigirDonoDaSessao('s1', 'u1')).rejects.toThrow('Upload session not found')
        // @ts-ignore
        prisma.uploadSession.findUnique.mockResolvedValue({ userId: null })
        await expect(exigirDonoDaSessao('s1', 'u1')).rejects.toThrow('Upload session not found')
    })
})
