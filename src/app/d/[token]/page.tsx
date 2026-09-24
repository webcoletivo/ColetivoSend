import { notFound } from 'next/navigation'
import prisma from '@/lib/db'
import { DownloadClient } from './download-client'

/**
 * Página pública de download (/send/d/<token>).
 *
 * O servidor só confere se o token existe: token mal formado ou inexistente
 * é 404 de verdade (não uma tela 200 com "não encontrado") — quem varre
 * tokens recebe o mesmo 404 genérico de qualquer caminho inválido. Expirado,
 * revogado e senha continuam sendo tratados pela tela (via API pública).
 */
export const dynamic = 'force-dynamic'

// Tokens novos: 22 caracteres alfanuméricos; os antigos, 12 (sem 0/O/l/1/I).
const FORMATO_TOKEN = /^[A-Za-z0-9]{8,64}$/

export default async function DownloadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!FORMATO_TOKEN.test(token)) notFound()

  const existe = await prisma.transfer.findUnique({
    where: { shareToken: token },
    select: { status: true },
  })
  if (!existe || existe.status === 'deleted') notFound()

  return <DownloadClient token={token} />
}
