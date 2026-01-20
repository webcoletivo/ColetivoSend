'use client'

import React, { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Sparkles, ChevronDown, User, LogOut, Settings, LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserAvatar } from '@/components/UserAvatar'

const NAV_ITEMS: { label: string; href: string }[] = [
    // Menu items removed as requested
]

interface HomeHeaderProps {
    transparent?: boolean
}

export function HomeHeader({ transparent = true }: HomeHeaderProps) {
    const { data: session, status } = useSession()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [userMenuOpen, setUserMenuOpen] = useState(false)

    const isLoggedIn = !!session?.user
    const isLoading = status === 'loading'

    return (
        <header className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${transparent ? 'bg-transparent' : 'bg-background/80 backdrop-blur-md border-b border-border'
            }`}>
            <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16 md:h-20">
                    {/* Logo */}
                    <a href="/" className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/25">
                            <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-white" />
                        </div>
                        <span className="text-lg md:text-xl font-bold text-white">
                            Coletivo<span className="text-primary-500">Send</span>
                        </span>
                    </a>

                    {/* Desktop Navigation - hidden on smaller screens */}
                    <div className="hidden lg:flex items-center gap-8">
                        {NAV_ITEMS.map(item => (
                            <a
                                key={item.label}
                                href={item.href}
                                className="text-sm font-medium text-white/80 hover:text-white transition-colors"
                            >
                                {item.label}
                            </a>
                        ))}
                    </div>

                    {/* Right side actions */}
                    <div className="flex items-center gap-3 md:gap-4">
                        <ThemeToggle />

                        {isLoading ? (
                            <div className="w-20 h-9 rounded-full bg-white/10 animate-pulse" />
                        ) : isLoggedIn ? (
                            // User menu
                            <div className="relative">
                                <button
                                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                                    className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-white/10 transition-colors"
                                >
                                    <UserAvatar
                                        user={{
                                            name: session.user?.name,
                                            email: session.user?.email,
                                            image: session.user?.image
                                        }}
                                        size="sm"
                                    />
                                    <span className="hidden sm:block text-sm font-medium text-white max-w-[100px] truncate">
                                        {session.user?.name?.split(' ')[0]}
                                    </span>
                                    <ChevronDown className="w-4 h-4 text-white/70" />
                                </button>

                                <AnimatePresence>
                                    {userMenuOpen && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-40"
                                                onClick={() => setUserMenuOpen(false)}
                                            />
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                                className="absolute right-0 top-full mt-2 w-56 bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-50"
                                            >
                                                <div className="p-3 border-b border-border">
                                                    <p className="font-medium text-foreground truncate">{session.user?.name}</p>
                                                    <p className="text-sm text-muted-foreground truncate">{session.user?.email}</p>
                                                </div>
                                                <div className="p-1">
                                                    <a
                                                        href="/dashboard"
                                                        className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-muted rounded-lg transition-colors"
                                                    >
                                                        <LayoutDashboard className="w-4 h-4" />
                                                        Dashboard
                                                    </a>
                                                    <a
                                                        href="/settings/profile"
                                                        className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-muted rounded-lg transition-colors"
                                                    >
                                                        <Settings className="w-4 h-4" />
                                                        Configurações
                                                    </a>
                                                </div>
                                                <div className="p-1 border-t border-border">
                                                    <button
                                                        onClick={() => signOut({ callbackUrl: '/' })}
                                                        className="flex items-center gap-3 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                                    >
                                                        <LogOut className="w-4 h-4" />
                                                        Sair
                                                    </button>
                                                </div>
                                            </motion.div>
                                        </>
                                    )}
                                </AnimatePresence>
                            </div>
                        ) : (
                            // Login/Signup buttons
                            <div className="flex items-center gap-2 md:gap-3">
                                <a
                                    href="/login"
                                    className="hidden sm:block text-sm font-medium text-white/80 hover:text-white transition-colors"
                                >
                                    Entrar
                                </a>
                                <a href="/signup">
                                    <Button variant="secondary" size="sm">
                                        Criar conta
                                    </Button>
                                </a>
                            </div>
                        )}

                        {/* Mobile menu button */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="lg:hidden p-2 text-white/80 hover:text-white"
                        >
                            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>

                {/* Mobile menu */}
                <AnimatePresence>
                    {mobileMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="lg:hidden border-t border-white/10 overflow-hidden"
                        >
                            <div className="py-4 space-y-1">
                                {NAV_ITEMS.map(item => (
                                    <a
                                        key={item.label}
                                        href={item.href}
                                        className="block px-4 py-3 text-base font-medium text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        {item.label}
                                    </a>
                                ))}
                                {!isLoggedIn && (
                                    <a
                                        href="/login"
                                        className="block px-4 py-3 text-base font-medium text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition-colors sm:hidden"
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        Entrar
                                    </a>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </nav>
        </header>
    )
}
