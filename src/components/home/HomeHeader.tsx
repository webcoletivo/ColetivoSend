'use client'

import React from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { LayoutDashboard } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { BASE_PATH, caminhoSso } from '@/lib/sso-client'

// Entrar/criar conta: a ponte SSO leva ao login central e volta para o Send
// (navegação inteira de propósito: a ponte grava cookie e redireciona).
const ENTRAR = caminhoSso(BASE_PATH)

interface HomeHeaderProps {
    transparent?: boolean
}

/**
 * Cabeçalho da home, sobre a mídia de fundo. Os controles ficam em "pílulas"
 * com superfície do tema (bg-card + texto do tema): legíveis sobre qualquer
 * foto/vídeo e nos dois temas — texto branco solto dava 1,07:1 no claro.
 */
const PILULA =
    'inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold ' +
    'bg-card/90 text-foreground border border-border/70 backdrop-blur-md shadow-sm ' +
    'hover:bg-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

export function HomeHeader({ transparent = true }: HomeHeaderProps) {
    const { data: session, status } = useSession()

    const isLoggedIn = !!session?.user
    const isLoading = status === 'loading'

    return (
        <header className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${transparent ? 'bg-transparent' : 'bg-background/80 backdrop-blur-md border-b border-border'
            }`}>
            <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="ColetivoSend">
                <div className="flex items-center justify-between h-16 md:h-20">
                    {/* Logo — always the white variant: the header sits over the dark media hero */}
                    <Link href="/" className="flex items-center flex-shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="ColetivoSend — página inicial">
                        <Logo variant="white" priority className="h-7 md:h-9 w-auto" />
                    </Link>

                    {/* Right side actions */}
                    <div className="flex items-center gap-3 md:gap-4">
                        {isLoading ? (
                            <div className="w-32 h-10 rounded-xl bg-card/60 animate-pulse" aria-hidden="true" />
                        ) : isLoggedIn ? (
                            // Unificação: identidade e saída vivem na barra da plataforma.
                            // Aqui, só o atalho para os envios.
                            <Link href="/dashboard" className={PILULA}>
                                <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
                                <span>Meus envios</span>
                            </Link>
                        ) : (
                            // Sem sessão local (expirou no meio do uso): ponte SSO
                            <a href={ENTRAR} className={PILULA}>
                                Entrar
                            </a>
                        )}
                    </div>
                </div>
            </nav>
        </header>
    )
}
