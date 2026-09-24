import { describe, it, expect } from 'vitest'
import { initUploadSchema, finalizeTransferSchema, nomeDeArquivoSchema, MAX_FILES_COUNT } from '../schemas'

const UUID = '6f1c2b1e-9c4a-4a2f-8f5e-1c2d3e4f5a6b'

describe('nomeDeArquivoSchema', () => {
    it('recusa separador de caminho, controle e nomes especiais', () => {
        for (const ruim of ['../x.txt', 'a/b.txt', 'a\\b.txt', 'x\u0000.txt', '.', '..', '', 'a'.repeat(256)]) {
            expect(nomeDeArquivoSchema.safeParse(ruim).success, JSON.stringify(ruim)).toBe(false)
        }
    })

    it('aceita nomes normais (acentos, espaços, colchetes)', () => {
        for (const bom of ['relatório final.pdf', '[E2E-SEC].txt', 'foto (1).jpg']) {
            expect(nomeDeArquivoSchema.safeParse(bom).success).toBe(true)
        }
    })
})

describe('initUploadSchema', () => {
    it('exige transferId e fileId em UUID (viram parte da chave no bucket)', () => {
        const base = { fileName: 'a.txt', fileSize: 10, mimeType: 'text/plain' }
        expect(initUploadSchema.safeParse({ ...base, transferId: UUID, fileId: UUID }).success).toBe(true)
        expect(initUploadSchema.safeParse({ ...base, transferId: '../x', fileId: UUID }).success).toBe(false)
        expect(initUploadSchema.safeParse({ ...base, transferId: UUID, fileId: 'abc' }).success).toBe(false)
        expect(initUploadSchema.safeParse({ ...base, transferId: UUID, fileId: UUID, fileSize: 0 }).success).toBe(false)
        expect(initUploadSchema.safeParse({ ...base, transferId: UUID, fileId: UUID, fileSize: 1.5 }).success).toBe(false)
    })
})

describe('finalizeTransferSchema', () => {
    const arquivo = { name: 'a.txt', size: 10, storageKey: 'transfers/u/t/f-a.txt' }
    const base = { transferId: UUID, senderName: 'Ana', files: [arquivo] }

    it('exige transferId UUID e pelo menos um arquivo', () => {
        expect(finalizeTransferSchema.safeParse(base).success).toBe(true)
        expect(finalizeTransferSchema.safeParse({ ...base, transferId: undefined }).success).toBe(false)
        expect(finalizeTransferSchema.safeParse({ ...base, files: [] }).success).toBe(false)
        expect(finalizeTransferSchema.safeParse({ ...base, files: Array(MAX_FILES_COUNT + 1).fill(arquivo) }).success).toBe(false)
    })

    it('valida destinatários (lista separada por vírgula, até 20)', () => {
        expect(finalizeTransferSchema.safeParse({ ...base, recipientEmail: 'a@b.co, c@d.co' }).success).toBe(true)
        expect(finalizeTransferSchema.safeParse({ ...base, recipientEmail: 'a@b.co, sem-arroba' }).success).toBe(false)
        const muitos = Array.from({ length: 21 }, (_, i) => `u${i}@ex.com`).join(',')
        expect(finalizeTransferSchema.safeParse({ ...base, recipientEmail: muitos }).success).toBe(false)
    })

    it('senha curta ou expiração fora das opções são recusadas', () => {
        expect(finalizeTransferSchema.safeParse({ ...base, password: '123' }).success).toBe(false)
        expect(finalizeTransferSchema.safeParse({ ...base, password: '' }).success).toBe(true)
        expect(finalizeTransferSchema.safeParse({ ...base, expirationDays: 365 }).success).toBe(false)
    })
})
