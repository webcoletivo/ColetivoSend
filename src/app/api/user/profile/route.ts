import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        passwordHash: true,
        twoFactorEnabled: true,
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      hasPassword: !!user.passwordHash,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt,
    })
  } catch (error) {
    console.error('Error fetching profile:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const formData = await request.formData()
    const name = formData.get('name') as string
    const avatar = formData.get('avatar') as File | null
    const removeAvatar = formData.get('removeAvatar') === 'true'

    const updateData: { name?: string; image?: string | null } = {}

    if (name) {
      updateData.name = name
    }

    // Handle avatar upload
    if (avatar) {
      const bytes = await avatar.arrayBuffer()
      const buffer = Buffer.from(bytes)

      // Create uploads directory if it doesn't exist
      const uploadsDir = join(process.cwd(), 'public', 'uploads', 'avatars')
      await mkdir(uploadsDir, { recursive: true })

      // Generate unique filename
      const ext = avatar.name.split('.').pop()
      const filename = `${uuidv4()}.${ext}`
      const filepath = join(uploadsDir, filename)

      // Write file
      await writeFile(filepath, buffer)

      // Set image URL
      updateData.image = `/uploads/avatars/${filename}`

      // Delete old avatar if exists
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { image: true },
      })
      if (currentUser?.image?.startsWith('/uploads/')) {
        try {
          await unlink(join(process.cwd(), 'public', currentUser.image))
        } catch (e) {
          // Ignore if file doesn't exist
        }
      }
    } else if (removeAvatar) {
      // Delete current avatar
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { image: true },
      })
      if (currentUser?.image?.startsWith('/uploads/')) {
        try {
          await unlink(join(process.cwd(), 'public', currentUser.image))
        } catch (e) {
          // Ignore if file doesn't exist
        }
      }
      updateData.image = null
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json({ error: 'Erro ao atualizar perfil' }, { status: 500 })
  }
}
