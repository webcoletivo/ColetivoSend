'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ExternalLink } from 'lucide-react'

interface MediaItem {
    id: string
    title: string | null
    type: 'video' | 'image'
    isPromotion: boolean
    promotionUrl: string | null
    mimeType: string
    duration: number | null
    url: string
}

interface MediaLoopPlayerProps {
    className?: string
    fallbackImageUrl?: string
}

export function MediaLoopPlayer({ className = '', fallbackImageUrl = '/api/placeholder/1920/1080' }: MediaLoopPlayerProps) {
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [nextPreloaded, setNextPreloaded] = useState(false)

    const videoRef = useRef<HTMLVideoElement>(null)
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    // Fetch media items
    useEffect(() => {
        async function fetchMedia() {
            try {
                console.log('Fetching media...')
                const res = await fetch('/api/media/public', { cache: 'no-store' })
                if (!res.ok) throw new Error(`Failed to fetch media: ${res.status}`)
                const data = await res.json()
                console.log('Media loaded:', data)
                setMediaItems(data)
                setError(null)
            } catch (e: any) {
                console.error('Error fetching media:', e)
                setError(`Erro ao carregar mídia: ${e.message}`)
            } finally {
                setIsLoading(false)
            }
        }
        fetchMedia()
    }, [])

    // Get current and next media
    const currentMedia = mediaItems[currentIndex]
    const nextIndex = (currentIndex + 1) % mediaItems.length
    const nextMedia = mediaItems[nextIndex]

    // Advance to next item
    const goToNext = useCallback(() => {
        if (mediaItems.length <= 1) return
        setNextPreloaded(false)
        setCurrentIndex(prev => (prev + 1) % mediaItems.length)
    }, [mediaItems.length])

    // Handle video end
    const handleVideoEnd = useCallback(() => {
        goToNext()
    }, [goToNext])

    // Handle video error - skip to next
    const handleVideoError = useCallback(() => {
        console.warn('Video failed to load, skipping to next')
        goToNext()
    }, [goToNext])

    // Start timer for images
    useEffect(() => {
        if (!currentMedia || currentMedia.type === 'video') return

        // Clear any existing timer
        if (timerRef.current) {
            clearTimeout(timerRef.current)
        }

        const duration = (currentMedia.duration || 6) * 1000 // Default 6 seconds
        timerRef.current = setTimeout(goToNext, duration)

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current)
            }
        }
    }, [currentMedia, goToNext])

    // Preload next item
    useEffect(() => {
        if (!nextMedia || nextPreloaded) return

        if (nextMedia.type === 'image') {
            const img = new Image()
            img.src = nextMedia.url
            img.onload = () => setNextPreloaded(true)
        } else if (nextMedia.type === 'video') {
            // Video preloading is handled by the browser
            setNextPreloaded(true)
        }
    }, [nextMedia, nextPreloaded])

    // Handle promotion click
    const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
        // Validation: Must be promotion and have a valid URL
        if (!currentMedia?.isPromotion || !currentMedia?.promotionUrl) return

        // Prevent click if targeting a button or interactive element (safety check)
        if ((e.target as HTMLElement).closest('button, a, input, [role="button"]')) return

        // Basic URL validation
        try {
            const url = new URL(currentMedia.promotionUrl)
            if (url.protocol === 'http:' || url.protocol === 'https:') {
                window.open(currentMedia.promotionUrl, '_blank', 'noopener,noreferrer')
            }
        } catch (err) {
            console.warn('Invalid promotion URL:', currentMedia.promotionUrl)
        }
    }, [currentMedia])

    // Show fallback when no media or loading
    if (isLoading) {
        return (
            <div className={`bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 ${className}`}>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
            </div>
        )
    }

    if (!mediaItems.length || error) {
        // Fallback gradient background
        return (
            <div className={`bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 ${className}`}>
                {/* Animated gradient overlay */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent animate-pulse-soft" />
            </div>
        )
    }

    const isClickable = currentMedia?.isPromotion && !!currentMedia?.promotionUrl

    return (
        <div
            className={`overflow-hidden ${className} ${isClickable ? 'cursor-pointer' : ''}`}
            onClick={handleBackgroundClick}
            role={isClickable ? 'link' : undefined}
            aria-label={isClickable ? `Visitar ${currentMedia.title || 'anúncio'}` : undefined}
        >
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentMedia?.id || 'fallback'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, ease: 'easeInOut' }}
                    className="absolute inset-0"
                >
                    {currentMedia?.type === 'video' ? (
                        <video
                            ref={videoRef}
                            src={currentMedia.url}
                            autoPlay
                            muted
                            playsInline
                            onEnded={handleVideoEnd}
                            onError={handleVideoError}
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                    ) : (
                        <img
                            src={currentMedia?.url || fallbackImageUrl}
                            alt={currentMedia?.title || 'Background'}
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Gradient overlay for contrast with card */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />
        </div>
    )
}
