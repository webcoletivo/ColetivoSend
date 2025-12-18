import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

import { generatePresignedDownloadUrl, uploadBufferToS3, deleteS3Object } from '@/lib/storage'
import { extname } from 'path'

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

    // If image is an S3 key (starts with "avatars/"), generate presigned URL
    let imageUrl = user.image
    if (user.image && user.image.startsWith('avatars/')) {
       // Generate presigned URL valid for 1 hour
       imageUrl = await generatePresignedDownloadUrl(user.image, 'avatar.png', 3600)
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      image: imageUrl,
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
      const ext = extname(avatar.name) || '.jpg' // Fallback extension
      const filename = `avatars/${session.user.id}-${uuidv4()}${ext}`
      
      // Upload to S3
      await uploadBufferToS3(buffer, filename, avatar.type || 'image/jpeg')

      // Set new image key
      updateData.image = filename

      // Delete old avatar if it exists and is an S3 key
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { image: true },
      })
      
      if (currentUser?.image?.startsWith('avatars/')) {
        try {
          await deleteS3Object(currentUser.image)
        } catch (e) {
          console.warn('Failed to delete old avatar:', e)
        }
      }
    } else if (removeAvatar) {
      // Delete current avatar
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { image: true },
      })
      
      if (currentUser?.image?.startsWith('avatars/')) {
        try {
          await deleteS3Object(currentUser.image)
        } catch (e) {
           console.warn('Failed to delete old avatar:', e)
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
    
    // Return signed URL for the new image so UI updates immediately
    let returnedImage = updatedUser.image
    if (updatedUser.image && updatedUser.image.startsWith('avatars/')) {
       returnedImage = await generatePresignedDownloadUrl(updatedUser.image, 'avatar.png', 3600)
    }

    return NextResponse.json({
        ...updatedUser,
        image: returnedImage
    })
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json({ error: 'Erro ao atualizar perfil' }, { status: 500 })
  }
}
