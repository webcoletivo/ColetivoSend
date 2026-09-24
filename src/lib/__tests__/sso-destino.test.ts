import { describe, it, expect } from 'vitest'
import { destinoSeguro } from '../sso-destino'

const BP = '/send'
const PADRAO = '/send/dashboard'

describe('destinoSeguro', () => {
    it('aceita caminhos internos do Send (com query, sem fragmento)', () => {
        expect(destinoSeguro('/send', BP)).toBe('/send')
        expect(destinoSeguro('/send/', BP)).toBe('/send/')
        expect(destinoSeguro('/send/dashboard', BP)).toBe(PADRAO)
        expect(destinoSeguro('/send/settings/media?x=1', BP)).toBe('/send/settings/media?x=1')
        expect(destinoSeguro('/send/d/abc#frag', BP)).toBe('/send/d/abc')
    })

    it('vazio/ausente vira o painel', () => {
        expect(destinoSeguro(null, BP)).toBe(PADRAO)
        expect(destinoSeguro(undefined, BP)).toBe(PADRAO)
        expect(destinoSeguro('', BP)).toBe(PADRAO)
    })

    it('barra redirecionamento aberto clássico', () => {
        expect(destinoSeguro('https://evil.com', BP)).toBe(PADRAO)
        expect(destinoSeguro('//evil.com', BP)).toBe(PADRAO)
        expect(destinoSeguro('/\\evil.com', BP)).toBe(PADRAO)
        expect(destinoSeguro('javascript:alert(1)', BP)).toBe(PADRAO)
    })

    it('barra tab/CR/LF (o parser do navegador os descarta: "/\\t/evil.com" vira "//evil.com")', () => {
        expect(destinoSeguro('/\t/evil.com', BP)).toBe(PADRAO)
        expect(destinoSeguro('/\n/evil.com', BP)).toBe(PADRAO)
        expect(destinoSeguro('/\r/evil.com', BP)).toBe(PADRAO)
        expect(destinoSeguro('/send/\t/x', BP)).toBe(PADRAO)
    })

    it('só sob o basePath do Send', () => {
        expect(destinoSeguro('/', BP)).toBe(PADRAO)
        expect(destinoSeguro('/kadro/painel', BP)).toBe(PADRAO)
        expect(destinoSeguro('/sendx', BP)).toBe(PADRAO)
        expect(destinoSeguro('/send/../conta', BP)).toBe(PADRAO)
    })

    it('rejeita valores enormes e credenciais na URL', () => {
        expect(destinoSeguro('/send/' + 'a'.repeat(3000), BP)).toBe(PADRAO)
        expect(destinoSeguro('/send@evil.com/x', BP)).toBe('/send@evil.com/x'.startsWith('/send/') ? '/send@evil.com/x' : PADRAO)
    })
})
