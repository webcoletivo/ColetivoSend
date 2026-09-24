import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

/**
 * Erros das rotas de upload em partes: os casos conhecidos viram códigos
 * estáveis para o cliente (o UploadManager decide retomar/abortar por eles);
 * qualquer outro vira mensagem genérica — a mensagem crua da exceção (S3,
 * Prisma) fica só no log do servidor.
 */
export function respostaDeErroDeUpload(contexto: string, error: unknown, mensagemGenerica: string, codigoGenerico: string): NextResponse {
    const mensagem = error instanceof Error ? error.message : ''

    if (mensagem.includes('not found')) {
        return NextResponse.json(
            { error: 'Sessão de upload não encontrada', code: 'SESSION_NOT_FOUND' },
            { status: 404 }
        )
    }
    if (mensagem.includes('expired')) {
        return NextResponse.json(
            { error: 'Sessão de upload expirada', code: 'SESSION_EXPIRED' },
            { status: 410 }
        )
    }
    if (mensagem.startsWith('Upload session is ')) {
        return NextResponse.json(
            { error: 'Sessão de upload não está ativa', code: 'SESSION_INACTIVE' },
            { status: 409 }
        )
    }
    if (mensagem.startsWith('Incomplete upload')) {
        return NextResponse.json(
            { error: 'Upload incompleto: faltam partes', code: 'INCOMPLETE_UPLOAD' },
            { status: 400 }
        )
    }

    logger.error(contexto, error)
    return NextResponse.json({ error: mensagemGenerica, code: codigoGenerico }, { status: 500 })
}
