import { prisma } from '@/lib/db'
import { deleteMultipleFiles } from '@/lib/storage'

export interface CleanupResult {
  processed: number
  succeeded: number
  failed: number
  details: any[]
}

/**
 * Performs cleanup of expired transfers.
 * @param limit Max number of transfers to process in this run
 * @returns Cleanup stats
 */
export async function cleanupExpiredTransfers(limit: number = 50): Promise<CleanupResult> {
  const now = new Date()
  
  // Find active transfers that have passed their expiration date
  const expiredTransfers = await prisma.transfer.findMany({
    where: {
      OR: [
        { status: 'active' },
        { status: 'expired' } // Also retry failed cleanups
      ],
      expiresAt: { lte: now },
      cleanupStatus: { not: 'done' } // Only pick pending or failed
    },
    include: {
      files: true
    },
    take: limit
  })
  
  const results: CleanupResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    details: []
  }
  
  for (const transfer of expiredTransfers) {
    results.processed++
    
    try {
      // 1. Delete files from storage
      const storageKeys = transfer.files.map(f => f.storageKey)
      let storageDeleted = false
      
      if (storageKeys.length > 0) {
         // This function (in storage.ts) should handle S3 deletion and swallow 404s
         storageDeleted = await deleteMultipleFiles(storageKeys)
      } else {
         storageDeleted = true // No files to delete
      }
      
      // 2. Update Database
      // If storage deletion failed, we still mark as expired (to block access)
      // but keep cleanupStatus as 'failed' to retry later.
      // If storage deletion succeeded, cleanupStatus = 'done'.
      
      await prisma.$transaction([
        prisma.transfer.update({
          where: { id: transfer.id },
          data: { 
            status: 'expired',
            cleanupStatus: storageDeleted ? 'done' : 'failed' 
          }
        }),
        prisma.file.updateMany({
          where: { transferId: transfer.id },
          data: { deletedAt: new Date() }
        })
      ])
      
      if (storageDeleted) {
        results.succeeded++
      } else {
        // Count as failed only if critical storage deletion failed
        results.failed++
      }
      
      results.details.push({ id: transfer.id, status: 'expired', storageDeleted })
      
    } catch (error) {
      console.error(`Error cleaning up transfer ${transfer.id}:`, error)
      results.failed++
      results.details.push({ id: transfer.id, error: String(error) })
    }
  }
  
  return results
}
