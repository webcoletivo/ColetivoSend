import { NextResponse } from 'next/server'

/**
 * Estado de uma transferência vista pelo link público (/d/<token>).
 *
 * TODAS as rotas públicas (metadados, unlock, download) passam por aqui:
 * expiração, revogação e exclusão valem em cada uma — sem esta checagem
 * única, uma rota esquecida (o /unlock, na auditoria) entregava arquivos
 * de link já expirado ou revogado.
 */
export type EstadoPublico = 'ok' | 'notfound' | 'expired' | 'revoked'

export interface TransferenciaPublica {
    status: string
    expiresAt: Date | string
}

export function estadoPublico(t: TransferenciaPublica, agora: Date = new Date()): EstadoPublico {
    if (t.status === 'deleted') return 'notfound'
    if (t.status === 'revoked') return 'revoked'
    if (t.status === 'expired' || new Date(t.expiresAt) <= agora) return 'expired'
    if (t.status !== 'active') return 'notfound'
    return 'ok'
}

/** Resposta genérica para cada estado que não é `ok` (nada de detalhes internos). */
export function respostaDeEstado(estado: Exclude<EstadoPublico, 'ok'>): NextResponse {
    switch (estado) {
        case 'expired':
            return NextResponse.json({ error: 'Este link expirou', code: 'expired' }, { status: 410 })
        case 'revoked':
            return NextResponse.json({ error: 'Link desativado', code: 'revoked' }, { status: 410 })
        default:
            return NextResponse.json({ error: 'Link não encontrado', code: 'notfound' }, { status: 404 })
    }
}

/** URLs presignadas de download: curtas — 15 minutos. */
export const VALIDADE_URL_DOWNLOAD_SEGUNDOS = 15 * 60

/**
 * Limites do link público por IP (limitador no banco — compartilhado entre
 * instâncias). Metadados: uma página aberta faz 1 pedido; 60/min por IP cobre
 * um escritório atrás de NAT sem deixar varrer tokens. Senha: 5 erros/min por
 * IP+token, mais um atraso a cada erro. Downloads: 30/min por IP+token (quem
 * baixa arquivo a arquivo não é bloqueado; abusar do contador é).
 */
export const LIMITES_PUBLICOS = {
    metadados: { limite: 60, janelaSegundos: 60 },
    senhaErrada: { limite: 5, janelaSegundos: 60 },
    download: { limite: 30, janelaSegundos: 60 },
    avisoAoDono: { limite: 1, janelaSegundos: 3600 },
} as const

/** Atraso fixo depois de uma senha errada (freia força bruta sem punir quem errou uma vez). */
export const ATRASO_SENHA_ERRADA_MS = 400
