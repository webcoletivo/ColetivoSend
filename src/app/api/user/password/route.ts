import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const createPasswordSchema = z.object({
  newPassword: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z.string().min(8, 'A nova senha deve ter pelo menos 8 caracteres'),
})

// POST - Create password (for Google-only users)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validation = createPasswordSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { newPassword } = validation.data

    // Check if user already has a password
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    })

    if (user?.passwordHash) {
      return NextResponse.json(
        { error: 'Você já possui uma senha. Use a opção de alterar senha.' },
        { status: 400 }
      )
    }

    // Hash and save password
    const passwordHash = await bcrypt.hash(newPassword, 12)
    
    await prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash },
    })

    return NextResponse.json({ message: 'Senha criada com sucesso!' })
  } catch (error) {
    console.error('Error creating password:', error)
    return NextResponse.json({ error: 'Erro ao criar senha' }, { status: 500 })
  }
}

// PUT - Change password
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validation = changePasswordSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { currentPassword, newPassword } = validation.data

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    })

    if (!user?.passwordHash) {
      return NextResponse.json(
        { error: 'Você não possui uma senha. Use a opção de criar senha.' },
        { status: 400 }
      )
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!isValid) {
      return NextResponse.json(
        { error: 'Senha atual incorreta' },
        { status: 400 }
      )
    }

    // Hash and save new password
    const passwordHash = await bcrypt.hash(newPassword, 12)
    
    await prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash },
    })

    return NextResponse.json({ message: 'Senha alterada com sucesso!' })
  } catch (error) {
    console.error('Error changing password:', error)
    return NextResponse.json({ error: 'Erro ao alterar senha' }, { status: 500 })
  }
}
