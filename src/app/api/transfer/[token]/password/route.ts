import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyPassword } from '@/lib/security'

export async function POST(
  request: NextRequest, 
  { params }: { params: { token: string } }
) {
  try {
    const { password } = await request.json()
    const { token } = params

    if (!token) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
    }

    if (!password) {
      return NextResponse.json({ error: 'Senha obrigatória' }, { status: 400 })
    }

    const transfer = await prisma.transfer.findUnique({
      where: { shareToken: token },
      select: {
        id: true,
        passwordHash: true,
      }
    })

    if (!transfer) {
      return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 })
    }

    if (!transfer.passwordHash) {
      return NextResponse.json({ error: 'Este link não está protegido por senha' }, { status: 400 })
    }

    const isValid = await verifyPassword(password, transfer.passwordHash)

    if (!isValid) {
      return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
    }

    // Return success - in a real app, might fetch "protected" partial data here
    return NextResponse.json({ 
      success: true,
      message: 'Senha verificada' 
    })

  } catch (error) {
    console.error('Password verification error:', error)
    return NextResponse.json({ error: 'Erro ao verificar senha' }, { status: 500 })
  }
}
