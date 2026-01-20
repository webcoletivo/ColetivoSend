'use client'

import React from 'react'
import { MediaLoopPlayer } from '@/components/home/MediaLoopPlayer'
import { TransferCard } from '@/components/home/TransferCard'
import { HomeHeader } from '@/components/home/HomeHeader'

export default function HomePage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Fullscreen media background */}
      <MediaLoopPlayer className="fixed inset-0 w-full h-full z-0" />

      {/* Header */}
      <HomeHeader transparent />

      {/* Main content */}
      <main className="relative z-10 min-h-screen flex items-center pointer-events-none">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-start gap-8 lg:gap-16">
            {/* Left side - Transfer Card */}
            <div className="w-full lg:w-auto lg:flex-shrink-0 pointer-events-auto">
              <TransferCard className="lg:w-[420px]" />
            </div>
          </div>
        </div>
      </main>

      {/* Footer - minimal on home */}
      <footer className="absolute bottom-0 left-0 right-0 py-4 px-6 z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-white/60">
          <p>© {new Date().getFullYear()} ColetivoSend</p>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="hover:text-white transition-colors">Privacidade</a>
            <a href="/terms" className="hover:text-white transition-colors">Termos</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
