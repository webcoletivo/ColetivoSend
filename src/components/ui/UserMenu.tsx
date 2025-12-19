'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { UserAvatar } from '@/components/UserAvatar'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  User, 
  Settings, 
  Shield, 
  LogOut, 
  ChevronDown,
  LayoutDashboard 
} from 'lucide-react'

export function UserMenu() {
  const { data: session, status } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close on ESC
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  if (status === 'loading') {
    return (
      <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
    )
  }

  if (!session?.user) {
    return null
  }

  const user = session.user
  const initials = user.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user.email?.[0]?.toUpperCase() || 'U'

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/' })
  }

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
    { icon: User, label: 'Perfil', href: '/settings/profile' },
    { icon: Shield, label: 'Segurança', href: '/settings/security' },
  ]

  const helpItems = [
    { label: 'Termos de Uso', href: '/terms' },
    { label: 'Privacidade', href: '/privacy' },
  ]

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-muted/50 transition-colors group"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <UserAvatar user={user} size="md" priority />
        <div className="hidden md:block text-left mr-1">
          <p className="text-sm font-semibold text-foreground group-hover:text-primary-500 transition-colors">
            {user.name}
          </p>
          <p className="text-xs text-muted-foreground truncate max-w-[120px]">
            {user.email}
          </p>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 w-56 bg-card rounded-xl shadow-lg border border-border py-1 z-50"
          >
            {/* User info header */}
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-medium text-foreground truncate">
                {user.name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user.email}
              </p>
            </div>

            {/* Menu items */}
            <div className="py-1">
              {menuItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-accent/5 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  <item.icon className="w-4 h-4 text-muted-foreground" />
                  {item.label}
                </a>
              ))}
            </div>

            <div className="border-t border-border py-1">
              <p className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Ajuda
              </p>
              {helpItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="block px-4 py-2 text-sm text-muted-foreground hover:bg-accent/5 hover:text-foreground transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </a>
              ))}
            </div>

            {/* Logout */}
            <div className="border-t border-border py-1">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-500/10 transition-colors w-full"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
