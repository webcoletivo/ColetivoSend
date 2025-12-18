import { NextRequest, NextResponse } from 'next/server'
import { uploadFile } from '@/lib/storage'
import { GUEST_LIMITS, USER_LIMITS } from '@/lib/security'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const transferId = (formData.get('transferId') as string) || `batch_${Date.now()}`

    if (!file) {
      return NextResponse.json(
        { error: 'Arquivo não fornecido' },
        { status: 400 }
      )
    }

    // Get user from session to apply correct limits
    const session = await getServerSession(authOptions)
    const isLoggedIn = !!session?.user
    const maxSizeBytes = (isLoggedIn ? USER_LIMITS.maxSizeMB : GUEST_LIMITS.maxSizeMB) * 1024 * 1024

    // Validate file size
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { error: `Arquivo excede o tamanho máximo de ${isLoggedIn ? USER_LIMITS.maxSizeMB : GUEST_LIMITS.maxSizeMB}MB` },
        { status: 400 }
      )
    }

    // Convert to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Upload to storage
    const result = await uploadFile(buffer, transferId, file.name)

    return NextResponse.json({
      success: true,
      storageKey: result.storageKey,
      checksum: result.checksum,
      size: file.size,
    })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Erro no upload' },
      { status: 500 }
    )
  }
}

// Increase body size limit for uploads
// Config removed (deprecated in Next.js 15+)
