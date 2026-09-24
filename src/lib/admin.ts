import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { lerInicioDoObjeto, tamanhoDoObjeto } from '@/lib/storage'
import { assinaturaConfere, BYTES_DA_ASSINATURA } from '@/lib/assinatura-midia'

/** Tamanho máximo de mídia de fundo: 100MB vídeo, 10MB imagem. */
export const TAMANHO_MAXIMO_MIDIA = { video: 100 * 1024 * 1024, image: 10 * 1024 * 1024 } as const

export interface MidiaParaVerificar {
    storageKey: string
    mimeType: string
    type: string
    sizeBytes: bigint | number
}

/**
 * O objeto no armazenamento é mesmo o que foi declarado? Confere existência,
 * tamanho (o aprovado no POST, dentro do máximo do tipo) e assinatura
 * (magic bytes) contra o Content-Type declarado. Roda ao confirmar o upload
 * e a cada ativação.
 */
export async function verificarMidiaNoArmazenamento(midia: MidiaParaVerificar): Promise<{ ok: true } | { ok: false; motivo: string }> {
    const tamanho = await tamanhoDoObjeto(midia.storageKey)
    if (tamanho === null) return { ok: false, motivo: 'Arquivo não encontrado no armazenamento' }
    const maximo = midia.type === 'video' ? TAMANHO_MAXIMO_MIDIA.video : TAMANHO_MAXIMO_MIDIA.image
    if (tamanho !== Number(midia.sizeBytes) || tamanho > maximo) {
        return { ok: false, motivo: 'Tamanho do arquivo diferente do declarado' }
    }
    const inicio = await lerInicioDoObjeto(midia.storageKey, BYTES_DA_ASSINATURA)
    if (!inicio || !assinaturaConfere(inicio, midia.mimeType)) {
        return { ok: false, motivo: 'O conteúdo do arquivo não corresponde ao tipo declarado' }
    }
    return { ok: true }
}

/**
 * Guarda das rotas de administração (mídia de fundo): sessão válida E
 * isAdmin lido do banco a cada chamada (o papel vem da plataforma pela
 * ponte SSO; o JWT não carrega o papel, então rebaixar alguém vale na hora).
 */
export async function exigirAdmin(): Promise<{ userId: string } | { error: string; status: number }> {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return { error: 'Não autenticado', status: 401 }
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isAdmin: true }
    })

    if (!user?.isAdmin) {
        return { error: 'Acesso negado', status: 403 }
    }

    return { userId: session.user.id }
}

/** URL de propaganda: só http(s) absoluto (nada de javascript:/data:), até 2 KB. */
export const urlDePromocaoSchema = z.string().max(2048).url().refine(
    (v) => /^https?:\/\//i.test(v),
    { message: 'A URL da propaganda precisa começar com http:// ou https://' },
)
