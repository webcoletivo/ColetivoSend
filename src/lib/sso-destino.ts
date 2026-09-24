/**
 * Destino (`next` / `callbackUrl`) aceito pela ponte SSO — só caminho interno
 * do próprio Send.
 *
 * O parser de URL do navegador (WHATWG) descarta tab e quebra de linha antes
 * de interpretar: "/\t/evil.com" vira "//evil.com", um host externo — a
 * checagem antiga (começa com "/" e não com "//") deixava isso passar
 * (redirecionamento aberto). Aqui o valor é resolvido contra uma origem
 * fictícia e só vale se continuar nessa origem e sob o basePath.
 */
export function destinoSeguro(bruto: string | null | undefined, basePath: string): string {
    const padrao = `${basePath}/dashboard`
    if (typeof bruto !== 'string' || bruto.length === 0 || bruto.length > 2048) return padrao
    // nada de caracteres de controle (tab/CR/LF somem no parser) nem barra invertida
    if (/[\u0000-\u001F\u007F\\]/.test(bruto)) return padrao
    if (!bruto.startsWith('/') || bruto.startsWith('//')) return padrao

    let url: URL
    try {
        url = new URL(bruto, 'https://destino.invalid')
    } catch {
        return padrao
    }
    if (url.origin !== 'https://destino.invalid') return padrao
    if (url.username || url.password) return padrao

    const caminho = url.pathname
    const dentroDoApp = caminho === basePath || caminho.startsWith(`${basePath}/`)
    if (!dentroDoApp) return padrao

    // sem fragmento: nunca faz parte do redirect do servidor
    return `${caminho}${url.search}`
}
