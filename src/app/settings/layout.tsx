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
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <header className="bg-white border-b border-surface-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="flex items-center gap-2 text-surface-500 hover:text-surface-900 transition-colors">
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Voltar</span>
              </Link>
              <div className="h-6 w-px bg-surface-200" />
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg font-bold text-surface-900">
                  Coletivo<span className="text-primary-500">Send</span>
                </span>
              </Link>
            </div>
            <h1 className="text-lg font-semibold text-surface-900">Configurações</h1>
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
                        ? 'bg-primary-50 text-primary-700 border border-primary-100' 
                        : 'text-surface-600 hover:bg-surface-100'
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
