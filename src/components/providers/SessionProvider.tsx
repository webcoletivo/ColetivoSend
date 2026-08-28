'use client'

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'
import { ReactNode } from 'react'

interface SessionProviderProps {
  children: ReactNode
}

// Unificação por abas: o app é servido sob um basePath, então os endpoints de
// sessão do next-auth ficam em <basePath>/api/auth — sem isso o client procura
// em /api/auth (raiz do domínio, que é a plataforma) e nunca acha a sessão.
const AUTH_BASE_PATH = `${process.env.NEXT_PUBLIC_BASE_PATH ?? '/send'}/api/auth`

export function SessionProvider({ children }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider basePath={AUTH_BASE_PATH}>
      {children}
    </NextAuthSessionProvider>
  )
}
