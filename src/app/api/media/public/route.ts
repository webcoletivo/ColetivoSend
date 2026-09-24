import { NextResponse } from 'next/server'
import { listarMidiaPublica } from '@/lib/media-publica'

// GET /api/media/public - mídia ativa do loop da página inicial (pública)
export async function GET() {
    try {
        const midia = await listarMidiaPublica()

        return NextResponse.json(midia, {
            headers: {
                // Cache for 5 minutes
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
            }
        })
    } catch (error) {
        console.error('Error fetching public media:', error)
        return NextResponse.json({ error: 'Erro ao buscar mídia' }, { status: 500 })
    }
}
