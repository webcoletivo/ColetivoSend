/**
 * Tipo real de uma mídia de fundo pelos primeiros bytes (magic numbers).
 *
 * O upload vai direto ao S3 com o Content-Type declarado pelo navegador; o
 * servidor confirma depois lendo o começo do objeto. Só o que a lista aceita
 * vira fundo da home — um HTML/SVG renomeado para .png fica de fora e é
 * apagado.
 */
export const TIPOS_DE_MIDIA_ACEITOS = {
    video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'],
    image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
} as const

/** Quantos bytes bastam para reconhecer todos os tipos aceitos. */
export const BYTES_DA_ASSINATURA = 16

function comeca(bytes: Uint8Array, assinatura: number[], deslocamento = 0): boolean {
    if (bytes.length < deslocamento + assinatura.length) return false
    return assinatura.every((b, i) => bytes[deslocamento + i] === b)
}

function ascii(bytes: Uint8Array, inicio: number, fim: number): string {
    return String.fromCharCode(...bytes.subarray(inicio, fim))
}

/** Tipo MIME reconhecido pela assinatura, ou null quando não é nenhum dos aceitos. */
export function tipoPelaAssinatura(bytes: Uint8Array): string | null {
    if (comeca(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
    if (comeca(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
    if (comeca(bytes, [0x47, 0x49, 0x46, 0x38]) && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) {
        return 'image/gif'
    }
    if (comeca(bytes, [0x52, 0x49, 0x46, 0x46]) && bytes.length >= 12) {
        const marca = ascii(bytes, 8, 12)
        if (marca === 'WEBP') return 'image/webp'
        if (marca === 'AVI ') return 'video/x-msvideo'
    }
    if (comeca(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm'
    if (comeca(bytes, [0x4f, 0x67, 0x67, 0x53])) return 'video/ogg'
    if (bytes.length >= 12 && ascii(bytes, 4, 8) === 'ftyp') {
        const marca = ascii(bytes, 8, 12)
        if (marca.startsWith('qt')) return 'video/quicktime'
        return 'video/mp4'
    }
    // QuickTime antigo: átomos moov/mdat/wide/free antes de qualquer ftyp
    if (bytes.length >= 8 && ['moov', 'mdat', 'wide', 'free', 'skip'].includes(ascii(bytes, 4, 8))) {
        return 'video/quicktime'
    }
    return null
}

/**
 * A assinatura confere com o tipo declarado? MP4 e QuickTime compartilham o
 * contêiner ISO (ftyp) — vídeo .mov declarado como mp4 e vice-versa é aceito.
 */
export function assinaturaConfere(bytes: Uint8Array, mimeDeclarado: string): boolean {
    const real = tipoPelaAssinatura(bytes)
    if (!real) return false
    const declarado = mimeDeclarado.trim().toLowerCase()
    if (real === declarado) return true
    const iso = ['video/mp4', 'video/quicktime']
    return iso.includes(real) && iso.includes(declarado)
}
