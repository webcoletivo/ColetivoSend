import { describe, it, expect } from 'vitest'
import { contentDispositionAttachment, isFileTypeAllowed } from '../storage'

describe('contentDispositionAttachment', () => {
    it('mantém nome simples e acrescenta filename* em UTF-8', () => {
        expect(contentDispositionAttachment('relatorio.pdf')).toBe(
            `attachment; filename="relatorio.pdf"; filename*=UTF-8''relatorio.pdf`,
        )
    })

    it('não deixa aspas, barra invertida nem CR/LF entrarem no cabeçalho', () => {
        const cd = contentDispositionAttachment('a"b\\c\r\nX-Injected: 1.txt')
        expect(cd).not.toMatch(/[\r\n]/)
        expect(cd.startsWith('attachment; filename="a_b_cX-Injected: 1.txt"')).toBe(true)
        expect(cd).not.toContain('\\')
    })

    it('acentos e emojis vão só no filename* (RFC 5987)', () => {
        const cd = contentDispositionAttachment('relatório ✓.pdf')
        expect(cd).toContain(`filename="relat_rio _.pdf"`)
        expect(cd).toContain(`filename*=UTF-8''relat%C3%B3rio%20%E2%9C%93.pdf`)
    })

    it('nome vazio vira "arquivo"', () => {
        expect(contentDispositionAttachment('\r\n')).toContain('filename="arquivo"')
    })
})

describe('isFileTypeAllowed', () => {
    it('bloqueia executáveis, scripts e conteúdo ativo (inclusive dupla extensão)', () => {
        expect(isFileTypeAllowed('application/octet-stream', 'setup.exe')).toBe(false)
        expect(isFileTypeAllowed('text/plain', 'invoice.html.txt')).toBe(false)
        expect(isFileTypeAllowed('image/svg+xml', 'logo.svg')).toBe(false)
        expect(isFileTypeAllowed('text/html', 'pagina')).toBe(false)
        expect(isFileTypeAllowed('image/png', 'x.php.png')).toBe(false)
    })

    it('aceita documentos e mídias comuns', () => {
        expect(isFileTypeAllowed('application/pdf', 'contrato.pdf')).toBe(true)
        expect(isFileTypeAllowed('image/png', 'foto.png')).toBe(true)
        expect(isFileTypeAllowed('application/zip', 'pacote.zip')).toBe(true)
        expect(isFileTypeAllowed('text/plain', '[E2E-SEC].txt')).toBe(true)
    })
})
