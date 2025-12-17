import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// DELETE - Soft delete (or permanent if requested)
export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const userId = session.user.id
    const transferId = params.id

    // Verify ownership
    const transfer = await prisma.transfer.findUnique({
      where: { id: transferId },
      select: { ownerUserId: true }
    })

    if (!transfer || transfer.ownerUserId !== userId) {
      return NextResponse.json({ error: 'Transfer não encontrado' }, { status: 404 })
    }

    // Delete transfer (cascade will delete files and S3 objects cleanup should happen via webhook/cron)
    await prisma.transfer.delete({
      where: { id: transferId }
    })

    return NextResponse.json({ message: 'Transfer excluído com sucesso' })
  } catch (error) {
    console.error('Error deleting transfer:', error)
    return NextResponse.json({ error: 'Erro ao excluir transfer' }, { status: 500 })
  }
}

// PATCH - Update status (Revoke)
export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const userId = session.user.id
    const transferId = params.id
    const { status } = await request.json()

    if (!['revoked'].includes(status)) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
    }

    // Verify ownership
    const transfer = await prisma.transfer.findUnique({
      where: { id: transferId },
      select: { ownerUserId: true }
    })

    if (!transfer || transfer.ownerUserId !== userId) {
      return NextResponse.json({ error: 'Transfer não encontrado' }, { status: 404 })
    }

    // Update status
    await prisma.transfer.update({
      where: { id: transferId },
      data: { status }
    })

    return NextResponse.json({ message: 'Status atualizado com sucesso' })
  } catch (error) {
    console.error('Error updating transfer:', error)
    return NextResponse.json({ error: 'Erro ao atualizar transfer' }, { status: 500 })
  }
}
