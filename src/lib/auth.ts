import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { getServerSession } from 'next-auth'
import { prisma } from './db'
import { generatePresignedDownloadUrl } from './storage'
import { logger } from './logger'

/**
 * Unificação por abas: quem autentica é a plataforma Grupo Coletivo. A única
 * porta de entrada é a ponte /api/sso/entrar, que cunha o JWT local
 * (next-auth v4, estratégia jwt). Aqui não existe provedor que autentique:
 * o Credentials abaixo recusa sempre — fica só para o next-auth ter a forma
 * de sessão/JWT que as rotas usam. Google/senha local foram removidos: com
 * eles, /api/auth/signin criava conta e sessão sem passar pela plataforma.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'plataforma',
      credentials: {},
      async authorize() {
        logger.warn('[Auth] tentativa de login local recusada (entrada só pela plataforma)')
        return null
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 dias — mesmo prazo do cookie cunhado pela ponte SSO
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    async jwt({ token, trigger, session }) {
      // Handle session update (e.g., after profile change)
      if (trigger === 'update' && session) {
        token.name = session.name
        token.picture = session.image
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
        session.user.name = token.name as string

        // Sign avatar URL if it's an S3 key
        let imageUrl = token.picture as string | undefined
        if (imageUrl && imageUrl.startsWith('avatars/')) {
          try {
            // Generate a short-lived URL (e.g. 1 hour) for the session
            imageUrl = await generatePresignedDownloadUrl(imageUrl, 'avatar.png', 3600)
          } catch (e) {
            logger.error('[Auth] falha ao presignar avatar', e)
          }
        }
        session.user.image = imageUrl
      }
      return session
    },

    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug: false,
  // @ts-ignore
  trustHost: true,
}

// Helper to get current user in server components
export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  return session?.user
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Não autorizado')
  }
  return user
}

export async function getUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      emailVerifiedAt: true,
      createdAt: true,
    },
  })
}
