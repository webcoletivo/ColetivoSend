import { NextResponse } from 'next/server'

// Healthcheck do container (Dockerfile) e do Coolify. Sem sessão, sem banco:
// só diz que o processo responde.
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    { status: 'ok', module: 'SEND' },
    { headers: { 'cache-control': 'no-store' } },
  )
}
