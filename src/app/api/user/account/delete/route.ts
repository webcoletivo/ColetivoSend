import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { verifyPassword } from '@/lib/security'
import { deleteTransferFiles } from '@/lib/storage'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const userId = session.user.id
    const { password, confirmation } = await request.json()

    // 1. Validate confirmation word
    if (confirmation !== 'DELETE' && confirmation !== 'EXCLUIR') {
      return NextResponse.json(
        { error: 'Palavra de confirmação incorreta' },
        { status: 400 }
      )
    }

    // 2. Fetch user to check password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // 3. Verify password if account has one
    if (user.passwordHash) {
      if (!password) {
        return NextResponse.json(
          { error: 'Sua senha é necessária para confirmar a exclusão' },
          { status: 400 }
        )
      }

      const isPasswordValid = await verifyPassword(password, user.passwordHash)
      if (!isPasswordValid) {
        return NextResponse.json(
          { error: 'Senha incorreta' },
          { status: 401 }
        )
      }
    }

    // 4. Physical Cleanup - Get all transfers to delete files from storage
    const userTransfers = await prisma.transfer.findMany({
      where: { ownerUserId: userId },
      select: { id: true }
    })

    // Delete physical files for each transfer
    for (const transfer of userTransfers) {
      try {
        await deleteTransferFiles(transfer.id)
      } catch (error) {
        console.error(`Failed to delete files for transfer ${transfer.id}:`, error)
        // Continue with user deletion even if some files fail (we want the account gone)
      }
    }

    // 5. Delete User - Cascade will handle Session and Transfer records
    // Note: We changed Transfer to 'Cascade' in schema.prisma earlier
    await prisma.user.delete({
      where: { id: userId }
    })

    return NextResponse.json({ message: 'Conta excluída com sucesso' })
  } catch (error) {
    console.error('Account deletion error:', error)
    return NextResponse.json(
      { error: 'Erro ao processar exclusão de conta' },
      { status: 500 }
    )
  }
}
