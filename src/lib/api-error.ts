import { NextResponse } from 'next/server'
import { logger } from './logger'
import { ZodError } from 'zod'

export class AppError extends Error {
    public statusCode: number
    public code?: string

    constructor(message: string, statusCode = 400, code?: string) {
        super(message)
        this.statusCode = statusCode
        this.code = code
        this.name = 'AppError'
    }
}

export function handleApiError(error: unknown) {
    if (error instanceof AppError) {
        return NextResponse.json(
            { error: error.message, code: error.code },
            { status: error.statusCode }
        )
    }

    if (error instanceof ZodError) {
        return NextResponse.json(
            { error: 'Dados inválidos', details: error.flatten() },
            { status: 400 }
        )
    }

    // NextAuth ERRORS
    if (error instanceof Error && error.message === '2FA_REQUIRED') {
        return NextResponse.json({ error: 'Autenticação de dois fatores necessária', code: '2FA_REQUIRED' }, { status: 401 })
    }

    logger.error('Unhandled API Error:', error)

    return NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
    )
}
