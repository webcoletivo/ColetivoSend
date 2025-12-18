import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from './db'
import { authenticator } from 'otplib'
import { decryptSecret } from './security'
import bcrypt from 'bcryptjs'


export const authOptions: NextAuthOptions = {
  // Remove PrismaAdapter - conflicts with JWT strategy and custom user handling
  providers: [
    // Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      // Explicitly normalization for redirect URIs is handled by NextAuth, 
      // but ensure client ID/secret are trimmed to avoid whitespace issues
    }),

    // Email/Password credentials
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        totpCode: { label: 'TOTP Code', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email e senha são obrigatórios')
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.passwordHash) {
          throw new Error('Email ou senha incorretos')
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        )

        if (!isPasswordValid) {
          throw new Error('Email ou senha incorretos')
        }

        // Check if email is verified
        if (!user.emailVerifiedAt) {
          throw new Error('Por favor, verifique seu email antes de fazer login')
        }

        // Check 2FA if enabled
        if (user.twoFactorEnabled) {
          if (!credentials.totpCode) {
            throw new Error('2FA_REQUIRED')
          }
          
          if (!user.twoFactorSecret) {
            // Should not happen if enabled, but failsafe
            throw new Error('Erro na configuração de 2FA')
          }

          try {
            // Decrypt secret
            const secret = decryptSecret(user.twoFactorSecret)
            
            // Validate code
            const isValid = authenticator.verify({
              token: credentials.totpCode,
              secret: secret
            })

            if (!isValid) {
              throw new Error('Código 2FA inválido')
            }
          } catch (error) {
            console.error('2FA validation error:', error)
            throw new Error('Código 2FA inválido')
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        }
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Let NextAuth handle cookies automatically for better compatibility with Vercel
  // session: { strategy: 'jwt' } is already set above

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      // Handle Google OAuth sign in
      if (account?.provider === 'google') {
        try {
          console.log('Google signIn callback - account:', { 
            provider: account.provider, 
            providerAccountId: account.providerAccountId,
            email: user.email 
          })

          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! },
          })

          if (existingUser) {
            console.log('Existing user found:', { id: existingUser.id, googleLinked: !!existingUser.googleOauthId })
            // Link Google account if not already linked
            if (!existingUser.googleOauthId) {
              await prisma.user.update({
                where: { id: existingUser.id },
                data: { 
                  googleOauthId: account.providerAccountId,
                  emailVerifiedAt: existingUser.emailVerifiedAt || new Date(),
                },
              })
              console.log('Linked Google account to existing user')
            }
            user.id = existingUser.id
          } else {
            console.log('Creating new Google user')
            // Create new user with Google
            const newUser = await prisma.user.create({
              data: {
                email: user.email!,
                name: user.name || 'Usuário',
                googleOauthId: account.providerAccountId,
                emailVerifiedAt: new Date(),
                image: user.image,
              },
            })
            console.log('New user created:', { id: newUser.id })
            user.id = newUser.id
          }
        } catch (error) {
          console.error('CRITICAL: Error in Google signIn callback:', error)
          // Rethrowing instead of just returning false might show more info in logs
          throw error 
        }
      }
      return true
    },

    async jwt({ token, user, account, trigger, session }) {
      // Initial sign in - Fetch latest data from DB to ensure single source of truth
      if (user) {
        // We already have user.id from signIn/authorize
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
        })

        if (dbUser) {
          token.id = dbUser.id
          token.email = dbUser.email
          token.name = dbUser.name
          token.picture = dbUser.image
        } else {
          // Fallback (should rarely happen if id is valid)
          token.id = user.id
          token.email = user.email
          token.name = user.name
          token.picture = user.image
        }
      }

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
        session.user.image = token.picture as string | undefined
      }
      return session
    },

    async redirect({ url, baseUrl }) {
      console.log('Redirect callback:', { url, baseUrl })
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },

  events: {
    async signIn({ user }) {
      console.log(`SignIn event success for: ${user.email}`)
    },
    async signOut() {
      console.log('SignOut event')
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug: true,
  // Ensure we trust the host on Vercel
  // @ts-ignore
  trustHost: true,
}

// Helper to get current user in server components
import { getServerSession } from 'next-auth'

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
      twoFactorEnabled: true,
      passwordHash: true,
      createdAt: true,
    },
  })
}

export async function getFullUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
  })
}
