'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
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
      <div className="w-10 h-10 rounded-full bg-surface-200 animate-pulse" />
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
        className="flex items-center gap-2 p-1.5 pr-3 rounded-full bg-white/80 backdrop-blur-sm border border-surface-200 hover:border-surface-300 transition-all shadow-sm hover:shadow"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {/* Avatar */}
        {user.image ? (
          <img
            src={user.image}
            alt={user.name || 'Avatar'}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-sm font-medium">
            {initials}
          </div>
        )}
        
        {/* Name */}
        <span className="text-sm font-medium text-surface-700 hidden sm:block max-w-[120px] truncate">
          {user.name || user.email}
        </span>
        
        {/* Chevron */}
        <ChevronDown 
          className={`w-4 h-4 text-surface-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-surface-200 py-1 z-50"
          >
            {/* User info header */}
            <div className="px-4 py-3 border-b border-surface-100">
              <p className="text-sm font-medium text-surface-900 truncate">
                {user.name}
              </p>
              <p className="text-xs text-surface-500 truncate">
                {user.email}
              </p>
            </div>

            {/* Menu items */}
            <div className="py-1">
              {menuItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  <item.icon className="w-4 h-4 text-surface-400" />
                  {item.label}
                </a>
              ))}
            </div>

            <div className="border-t border-surface-100 py-1">
              <p className="px-4 py-1.5 text-xs font-semibold text-surface-400 uppercase tracking-wider">
                Ajuda
              </p>
              {helpItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="block px-4 py-2 text-sm text-surface-600 hover:bg-surface-50 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </a>
              ))}
            </div>

            {/* Logout */}
            <div className="border-t border-surface-100 py-1">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors w-full"
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
