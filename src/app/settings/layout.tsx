'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { 
  Sparkles, 
  User, 
  Shield, 
  ArrowLeft,
  ChevronRight
} from 'lucide-react'

const settingsNav = [
  { 
    href: '/settings/profile', 
    label: 'Perfil', 
    icon: User,
    description: 'Foto, nome e email'
  },
  { 
    href: '/settings/security', 
    label: 'Segurança', 
    icon: Shield,
    description: '2FA e senha'
  },
]

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const pathname = usePathname()

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session?.user) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login?callbackUrl=/settings/profile'
    }
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-lg border-b border-border sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Voltar</span>
              </Link>
              <div className="h-6 w-px bg-border" />
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg font-bold text-foreground">
                  Coletivo<span className="text-primary-500">Send</span>
                </span>
              </Link>
            </div>
            <h1 className="text-lg font-semibold text-foreground">Configurações</h1>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <nav className="space-y-1">
              {settingsNav.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive 
                        ? 'bg-primary-500/10 text-primary-500 border border-primary-500/20' 
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    <item.icon className={`w-5 h-5 ${isActive ? 'text-primary-500' : 'text-surface-400'}`} />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className={`text-xs ${isActive ? 'text-primary-500/70' : 'text-surface-400'}`}>
                        {item.description}
                      </p>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${isActive ? 'text-primary-400' : 'text-surface-300'}`} />
                  </Link>
                )
              })}
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  )
}
