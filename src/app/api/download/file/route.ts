import { NextRequest, NextResponse } from 'next/server'
import { getFile, verifyDownloadSignature } from '@/lib/storage'

// Serve file download with signed URL
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const storageKey = searchParams.get('key')
    const fileName = searchParams.get('name')
    const expires = searchParams.get('expires')
    const signature = searchParams.get('sig')

    if (!storageKey || !fileName || !expires || !signature) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos' },
        { status: 400 }
      )
    }

    // Verify signature
    if (!verifyDownloadSignature(storageKey, expires, signature)) {
      return NextResponse.json(
        { error: 'Link de download expirado ou inválido' },
        { status: 403 }
      )
    }

    // Get file from storage
    const fileBuffer = await getFile(storageKey)

    if (!fileBuffer) {
      return NextResponse.json(
        { error: 'Arquivo não encontrado' },
        { status: 404 }
      )
    }

    // Return file with appropriate headers
    // Cast buffer to BodyInit to satisfy Next.js 16 types
    const response = new NextResponse(fileBuffer as unknown as BodyInit)
    
    response.headers.set('Content-Type', 'application/octet-stream')
    response.headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`)
    response.headers.set('Content-Length', fileBuffer.length.toString())
    response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate')

    return response

  } catch (error) {
    console.error('File download error:', error)
    return NextResponse.json(
      { error: 'Erro ao baixar arquivo' },
      { status: 500 }
    )
  }
}
