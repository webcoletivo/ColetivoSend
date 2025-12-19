import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { deleteMultipleFiles } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Optional: Add a secret key check for security (e.g., Bearer CRON_SECRET)
    // const authHeader = request.headers.get('authorization')
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const now = new Date()

    // Find transfers that are active but expired
    const expiredTransfers = await prisma.transfer.findMany({
      where: {
        OR: [
          { status: 'active' },
          { status: 'expired' }
        ],
        expiresAt: { lte: now },
        cleanupStatus: 'pending', // Safety check
      },
      include: {
        files: true
      },
      take: 50 // Limit batch size to prevent timeouts
    })

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      details: [] as any[]
    }

    for (const transfer of expiredTransfers) {
      results.processed++
      
      try {
        console.log(`Processing expiration for transfer ${transfer.id} (Status: ${transfer.status})`)
        
        // 1. Delete files from storage
        // Gather all storage keys
        const storageKeys = transfer.files.map(f => f.storageKey)
        let storageDeleted = false
        
        if (storageKeys.length > 0) {
           storageDeleted = await deleteMultipleFiles(storageKeys)
        } else {
           storageDeleted = true // No files to delete
        }
        
        if (!storageDeleted) {
            console.warn(`Failed to delete storage for transfer ${transfer.id}`)
            // We continue to mark as expired to block access, but keep cleanupStatus pending/failed
        } else {
            console.log(`Deleted ${storageKeys.length} files for transfer ${transfer.id}`)
        }

        // 2. Database updates
        await prisma.$transaction([
          // Mark transfer as expired and update cleanup status
          prisma.transfer.update({
            where: { id: transfer.id },
            data: { 
              status: 'expired',
              cleanupStatus: storageDeleted ? 'done' : 'failed' 
            }
          }),
          // Mark files as deleted
          prisma.file.updateMany({
            where: { transferId: transfer.id },
            data: { deletedAt: new Date() }
          })
        ])

        results.succeeded++
        results.details.push({ id: transfer.id, status: 'expired', storageDeleted })

      } catch (error) {
        console.error(`Error cleaning up transfer ${transfer.id}:`, error)
        results.failed++
        results.details.push({ id: transfer.id, error: String(error) })
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
