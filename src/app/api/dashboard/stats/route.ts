import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const userId = session.user.id
    const now = new Date()

    // Execute queries in parallel for better performance
    const [total, active, expired, revoked] = await Promise.all([
      // Total transfers
      prisma.transfer.count({
        where: { ownerUserId: userId },
      }),
      
      // Active transfers (status active AND not expired)
      prisma.transfer.count({
        where: { 
          ownerUserId: userId,
          status: 'active',
          expiresAt: { gt: now }
        },
      }),

      // Expired transfers (status expired OR (status active AND expired))
      prisma.transfer.count({
        where: { 
          ownerUserId: userId,
          OR: [
            { status: 'expired' },
            { 
              status: 'active',
              expiresAt: { lte: now }
            }
          ]
        },
      }),

      // Revoked transfers (just for reference if needed later)
      prisma.transfer.count({
        where: { 
          ownerUserId: userId,
          status: 'revoked'
        },
      })
    ])

    return NextResponse.json({
      total,
      active,
      expired,
      revoked
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json({ error: 'Erro ao buscar estatísticas' }, { status: 500 })
  }
}
