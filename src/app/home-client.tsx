'use client'

import React from 'react'
import { MediaLoopPlayer } from '@/components/home/MediaLoopPlayer'
import { TransferCard } from '@/components/home/TransferCard'
import { HomeHeader } from '@/components/home/HomeHeader'

export function HomeClient() {
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

      {/* Sistema interno: sem rodapé — privacidade/termos ficam linkados
          na página inicial da plataforma */}
    </div>
  )
}
