import { describe, it, expect } from 'vitest'
import { tipoPelaAssinatura, assinaturaConfere, BYTES_DA_ASSINATURA } from '../assinatura-midia'

const b = (...xs: (number | string)[]) => {
    const out: number[] = []
    for (const x of xs) {
        if (typeof x === 'string') for (const c of x) out.push(c.charCodeAt(0))
        else out.push(x)
    }
    while (out.length < BYTES_DA_ASSINATURA) out.push(0)
    return new Uint8Array(out)
}

describe('tipoPelaAssinatura', () => {
    it('reconhece imagens aceitas', () => {
        expect(tipoPelaAssinatura(b(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
        expect(tipoPelaAssinatura(b(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png')
        expect(tipoPelaAssinatura(b('GIF89a'))).toBe('image/gif')
        expect(tipoPelaAssinatura(b('RIFF', 0, 0, 0, 0, 'WEBP'))).toBe('image/webp')
    })

    it('reconhece vídeos aceitos', () => {
        expect(tipoPelaAssinatura(b(0, 0, 0, 0x18, 'ftyp', 'isom'))).toBe('video/mp4')
        expect(tipoPelaAssinatura(b(0, 0, 0, 0x14, 'ftyp', 'qt  '))).toBe('video/quicktime')
        expect(tipoPelaAssinatura(b(0, 0, 0, 0x08, 'moov'))).toBe('video/quicktime')
        expect(tipoPelaAssinatura(b(0x1a, 0x45, 0xdf, 0xa3))).toBe('video/webm')
        expect(tipoPelaAssinatura(b('OggS'))).toBe('video/ogg')
        expect(tipoPelaAssinatura(b('RIFF', 0, 0, 0, 0, 'AVI '))).toBe('video/x-msvideo')
    })

    it('não reconhece HTML/SVG/scripts nem buffers curtos', () => {
        expect(tipoPelaAssinatura(b('<!DOCTYPE html>'))).toBeNull()
        expect(tipoPelaAssinatura(b('<svg xmlns="http'))).toBeNull()
        expect(tipoPelaAssinatura(b('<?xml version="1'))).toBeNull()
        expect(tipoPelaAssinatura(new Uint8Array([0xff, 0xd8]))).toBeNull()
        expect(tipoPelaAssinatura(new Uint8Array(0))).toBeNull()
    })
})

describe('assinaturaConfere', () => {
    it('exige que o tipo real seja o declarado', () => {
        expect(assinaturaConfere(b(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a), 'image/png')).toBe(true)
        expect(assinaturaConfere(b(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a), 'image/jpeg')).toBe(false)
        expect(assinaturaConfere(b('<svg xmlns="http'), 'image/png')).toBe(false)
        expect(assinaturaConfere(b('<!DOCTYPE html>'), 'image/svg+xml')).toBe(false)
    })

    it('mp4 e quicktime são intercambiáveis (mesmo contêiner ISO)', () => {
        expect(assinaturaConfere(b(0, 0, 0, 0x18, 'ftyp', 'isom'), 'video/quicktime')).toBe(true)
        expect(assinaturaConfere(b(0, 0, 0, 0x14, 'ftyp', 'qt  '), 'video/mp4')).toBe(true)
        expect(assinaturaConfere(b(0, 0, 0, 0x18, 'ftyp', 'isom'), 'video/webm')).toBe(false)
    })
})
