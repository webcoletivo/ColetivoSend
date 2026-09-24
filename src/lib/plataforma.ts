import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * Nome de exibição = SEMPRE o da plataforma Grupo Coletivo.
 *
 * O Send guarda uma cópia local (users.name) que a ponte /api/sso/entrar
 * sincroniza a cada entrada. Entre uma entrada e outra a sessão local dura
 * até 7 dias — então, na hora de gravar algo que mostra o nome (o remetente
 * de um envio), o nome é lido do verify da plataforma com o cookie do
 * próprio pedido, e a cópia local é acertada se estiver diferente.
 *
 * Sem PLATFORM_URL (dev isolado) ou com a plataforma fora do ar, cai na
 * cópia local — nunca bloqueia o envio.
 */
export interface IdentidadePlataforma {
    name: string
    email: string
}

const TEMPO_LIMITE_MS = 4_000

export async function identidadeDaPlataforma(cookie: string | null): Promise<IdentidadePlataforma | null> {
    const platformUrl = process.env.PLATFORM_URL
    if (!platformUrl || !cookie) return null
    try {
        const r = await fetch(`${platformUrl}/api/auth/verify`, {
            headers: { cookie },
            cache: 'no-store',
            signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
        })
        if (!r.ok) return null
        const data = (await r.json()) as { user?: { name?: string; email?: string } }
        const name = data.user?.name?.trim()
        const email = data.user?.email?.trim().toLowerCase()
        if (!name || !email) return null
        return { name, email }
    } catch (e) {
        logger.warn('[plataforma] verify indisponível; usando cópia local do nome', { erro: String(e).slice(0, 120) })
        return null
    }
}

/**
 * Nome a exibir para o usuário local `userId`: plataforma primeiro (e acerta
 * a cópia local quando difere), senão a cópia local, senão o `fallback`.
 */
export async function nomeDeExibicao(userId: string, cookie: string | null, fallback: string): Promise<string> {
    const local = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } })
    const plataforma = await identidadeDaPlataforma(cookie)

    // só confia no verify se é a MESMA conta da sessão local
    if (plataforma && local && plataforma.email === local.email.toLowerCase()) {
        if (local.name !== plataforma.name) {
            await prisma.user.update({ where: { id: userId }, data: { name: plataforma.name } }).catch((e) => {
                logger.warn('[plataforma] não foi possível acertar a cópia local do nome', { erro: String(e).slice(0, 120) })
            })
        }
        return plataforma.name
    }
    return local?.name?.trim() || fallback
}
