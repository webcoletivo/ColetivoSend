import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { generatePresignedDownloadUrl } from '@/lib/storage'

export async function GET(
  request: NextRequest, 
  props: { params: Promise<{ token: string }> }
) {
  const params = await props.params;
  try {
    const { token } = params

    if (!token) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
    }

    const transfer = await prisma.transfer.findUnique({
      where: { shareToken: token },
      include: {
        files: {
          select: {
            id: true,
            originalName: true,
            sizeBytes: true,
            mimeType: true,
            storageKey: true,
          }
        }
      }
    })

    if (!transfer) {
      return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 })
    }

    // Check expiration (Lazy Expire)
    const now = new Date()
    const expiresAt = new Date(transfer.expiresAt)
    if (expiresAt <= now) {
      // If it's still marked active, update it
      // OR if it's marked expired but files are NOT cleaned up (pending), try again
      if (transfer.status === 'active' || (transfer.status === 'expired' /* check cleanup status in next step? no, schema optimization needed for complex check */)) {
        try {
           console.log(`[LazyExpire] Triggering immediate cleanup for ${transfer.id}`)
           
           // Immediate deletion of S3 files
           const storageKeys = transfer.files.map(f => f.storageKey)
           if (storageKeys.length > 0) {
             const { deleteMultipleFiles } = await import('@/lib/storage')
             await deleteMultipleFiles(storageKeys)
           }

           // Update DB
           await prisma.transfer.update({
             where: { id: transfer.id },
             data: { 
               status: 'expired',
               cleanupStatus: 'done' // Assume done if we just tried. (Simpler for Lazy trigger)
             }
           })
           
           // Also mark files deleted
           await prisma.file.updateMany({
             where: { transferId: transfer.id },
             data: { deletedAt: new Date() }
           })
           
        } catch (e) {
          console.error('Lazy expire update failed:', e)
        }
      }
  
      return NextResponse.json({ 
        error: 'Este link expirou',
        code: 'EXPIRED',
        expiresAt: transfer.expiresAt
      }, { status: 410 })
    }

    // Check revocation
    if (transfer.status === 'revoked') {
      return NextResponse.json({ 
        error: 'Link desativado', 
        code: 'revoked' 
      }, { status: 410 })
    }

    // If password protected, return limited data only
    if (transfer.passwordHash) {
      return NextResponse.json({
        hasPassword: true,
        id: transfer.id,
        // Don't send files or text yet
      })
    }

    // If public/verified, return full data
    const filesWithUrls = await Promise.all(
      transfer.files.map(async (file) => ({
        ...file,
        downloadUrl: await generatePresignedDownloadUrl(file.storageKey, file.originalName),
        storageKey: undefined, // Hide real storage key from client
      }))
    )

    return NextResponse.json({
      id: transfer.id,
      senderName: transfer.senderName,
      message: transfer.message,
      expiresAt: transfer.expiresAt,
      viewCount: transfer.viewCount,
      downloadCount: transfer.downloadCount,
      files: filesWithUrls,
      hasPassword: false
    })

  } catch (error) {
    console.error('Fetch transfer error:', error)
    return NextResponse.json({ error: 'Erro ao buscar link' }, { status: 500 })
  }
}
