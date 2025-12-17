import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, getFullUserById } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { authenticator } from 'otplib'
import { encryptSecret, decryptSecret } from '@/lib/security'
import QRCode from 'qrcode'


import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// Generate recovery codes
function generateRecoveryCodes(): string[] {
  const codes: string[] = []
  for (let i = 0; i < 8; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase()
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`)
  }
  return codes
}

// POST - Start 2FA setup (generate secret and QR code)
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = await getFullUserById(session.user.id)
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // Check if 2FA is already enabled
    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { error: '2FA já está ativado' },
        { status: 400 }
      )
    }

    // Generate new secret
    const secret = authenticator.generateSecret()
    
    // Encrypt secret before storing
    const encryptedSecret = encryptSecret(secret)
    
    // Store pending secret (encrypted)
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: encryptedSecret },
    })

    // Generate QR code
    const otpauth = authenticator.keyuri(user.email, 'ColetivoSend', secret)
    const qrCodeUrl = await QRCode.toDataURL(otpauth)

    return NextResponse.json({
      secret,
      qrCodeUrl,
    })
  } catch (error) {
    console.error('Error starting 2FA setup:', error)
    return NextResponse.json({ error: 'Erro ao gerar QR code' }, { status: 500 })
  }
}

// PUT - Verify code and activate 2FA
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { code } = await request.json()

    if (!code || code.length !== 6) {
      return NextResponse.json(
        { error: 'Código deve ter 6 dígitos' },
        { status: 400 }
      )
    }

    const user = await getFullUserById(session.user.id)
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    if (!user.twoFactorSecret) {
      return NextResponse.json(
        { error: 'Nenhuma configuração de 2FA pendente' },
        { status: 400 }
      )
    }

    // Decrypt secret for verification
    const secret = decryptSecret(user.twoFactorSecret)

    // Verify the code
    const isValid = authenticator.verify({
      token: code,
      secret: secret,
    })

    if (!isValid) {
      return NextResponse.json(
        { error: 'Código inválido. Tente novamente.' },
        { status: 400 }
      )
    }

    // Generate recovery codes
    const recoveryCodes = generateRecoveryCodes()
    
    // Activate 2FA
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
        recoveryCodes: encryptSecret(JSON.stringify(recoveryCodes)),
      },
    })

    return NextResponse.json({
      message: '2FA ativado com sucesso!',
      recoveryCodes,
    })
  } catch (error) {
    console.error('Error activating 2FA:', error)
    return NextResponse.json({ error: 'Erro ao ativar 2FA' }, { status: 500 })
  }
}

// DELETE - Deactivate 2FA
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { password } = await request.json()

    const user = await getFullUserById(session.user.id)
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    if (!user.twoFactorEnabled) {
      return NextResponse.json(
        { error: '2FA não está ativado' },
        { status: 400 }
      )
    }

    // Verify password if user has one
    if (user.passwordHash) {
      if (!password) {
        return NextResponse.json(
          { error: 'Senha é obrigatória' },
          { status: 400 }
        )
      }

      const isValid = await bcrypt.compare(password, user.passwordHash)
      if (!isValid) {
        return NextResponse.json(
          { error: 'Senha incorreta' },
          { status: 400 }
        )
      }
    }

    // Deactivate 2FA
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        recoveryCodes: null,
      },
    })

    return NextResponse.json({ message: '2FA desativado com sucesso!' })
  } catch (error) {
    console.error('Error deactivating 2FA:', error)
    return NextResponse.json({ error: 'Erro ao desativar 2FA' }, { status: 500 })
  }
}
