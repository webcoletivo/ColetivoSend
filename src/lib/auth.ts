import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from './db'
import { authenticator } from 'otplib'
import { decryptSecret } from './security'
import { generatePresignedDownloadUrl } from './storage'
// ... imports
import crypto from 'crypto'

// ...

    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        totpCode: { label: 'TOTP Code', type: 'text' },
        totpVerified: { label: 'TOTP Already Verified', type: 'text' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email e senha são obrigatórios')
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.passwordHash) {
          throw new Error('Conta não encontrada. Crie uma conta para continuar.')
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        )

        if (!isPasswordValid) {
          throw new Error('Conta não encontrada. Crie uma conta para continuar.')
        }

        // Check if email is verified
        if (!user.emailVerifiedAt) {
          throw new Error('Por favor, verifique seu email antes de fazer login')
        }

        // Check 2FA if enabled
        if (user.twoFactorEnabled) {
          let isTrustedDevice = false
          
          // Check for trusted device cookie
          // Note: accessing cookies in NextAuth authorize can be tricky depending on adapter/version
          // We'll try to get it from the request headers
          try {
            // @ts-ignore - req type definition might vary
            const cookies = req?.headers?.cookie || req?.cookies
            let trustedToken = null
            
            if (typeof cookies === 'string') {
               const match = cookies.match(/trusted_device=([^;]+)/)
               if (match) trustedToken = match[1]
            } else if (cookies?.trusted_device) {
               trustedToken = cookies.trusted_device
            }

            if (trustedToken) {
               const tokenHash = crypto.createHash('sha256').update(trustedToken).digest('hex')
               const validDevice = await prisma.trustedDevice.findUnique({
                 where: { tokenHash },
                 include: { user: true }
               })

               if (validDevice && validDevice.userId === user.id && validDevice.expiresAt > new Date()) {
                  isTrustedDevice = true
                  console.log('[Auth] Trusted device detected, skipping 2FA')
               }
            }
          } catch (e) {
            console.error('[Auth] Error checking trusted device:', e)
          }

          if (isTrustedDevice) {
             // Skip 2FA
          } else if (credentials.totpVerified === 'true') {
            console.log('[Auth] 2FA already verified via challenge endpoint, skipping re-validation')
          } else if (!credentials.totpCode) {
            throw new Error('2FA_REQUIRED')
          } else {
            if (!user.twoFactorSecret) {
              throw new Error('Erro na configuração de 2FA')
            }

            try {
              // Decrypt secret
              const secret = decryptSecret(user.twoFactorSecret)
              
              // Configure authenticator with window tolerance
              authenticator.options = { window: 1, step: 30 }
              
              // Validate code
              const isValid = authenticator.verify({
                token: credentials.totpCode,
                secret: secret
              })

              if (!isValid) {
                throw new Error('Código 2FA inválido')
              }
            } catch (error) {
              console.error('[Auth] 2FA validation error:', error)
              throw new Error('Código 2FA inválido')
            }
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
    maxAge: 7 * 24 * 60 * 60, // 7 days (as requested)
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
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! },
          })

          if (existingUser) {
            // Link Google account if not already linked
            if (!existingUser.googleOauthId) {
              await prisma.user.update({
                where: { id: existingUser.id },
                data: { 
                  googleOauthId: account.providerAccountId,
                  emailVerifiedAt: existingUser.emailVerifiedAt || new Date(),
                },
              })
            }
            user.id = existingUser.id
          } else {
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
            user.id = newUser.id
          }
        } catch (error) {
          console.error('Error in Google signIn callback:', error)
          return false
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
        
        // Sign avatar URL if it's an S3 key
        let imageUrl = token.picture as string | undefined
        if (imageUrl && imageUrl.startsWith('avatars/')) {
           try {
             // Generate a short-lived URL (e.g. 1 hour) for the session
             imageUrl = await generatePresignedDownloadUrl(imageUrl, 'avatar.png', 3600)
           } catch (e) {
             console.error('Failed to sign avatar URL in session:', e)
           }
        }
        session.user.image = imageUrl
      }
      return session
    },

    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },

  events: {
    async signIn({ user }) {
      // Basic logging for security audit
    },
    async signOut() {
      // Basic logging for security audit
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug: false,
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
