'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  user?: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  className?: string
  priority?: boolean // For eager loading in header
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-24 h-24 text-2xl',
  '2xl': 'w-32 h-32 text-3xl',
}

export function UserAvatar({ user, size = 'md', className, priority = false }: UserAvatarProps) {
  const imageUrl = user?.image
  const initials = user?.name
    ? user.name.split(' ').map(n => n?.[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'U'

  // If it's a GIF or generic image, we use standard <img> to avoid Next/Image interfering with animation
  // and to simplify external URL handling.
  // We also use key={imageUrl} to force re-render if URL changes (e.g. update profile)
  
  if (imageUrl) {
    return (
      <div className={cn(
        'relative rounded-full overflow-hidden bg-surface-100 flex-shrink-0',
        sizeClasses[size],
        className
      )}>
        <img
          key={imageUrl} 
          src={imageUrl}
          alt={user?.name || 'Avatar'}
          className="w-full h-full object-cover"
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
        />
      </div>
    )
  }

  // Fallback initials
  return (
    <div className={cn(
      'rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold shadow-sm flex-shrink-0',
      sizeClasses[size],
      className
    )}>
      {initials}
    </div>
  )
}
