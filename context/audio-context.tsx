'use client'

import React, { createContext, useContext, useRef, useCallback, useEffect } from 'react'

interface AudioContextType {
    playRingtone: () => void
    stopRingtone: () => void
    playNotificationSound: () => void
    playSound: (type?: 'default' | 'notification' | 'ready') => void
}

const AudioContext = createContext<AudioContextType | undefined>(undefined)

export function AudioProvider({ children }: { children: React.ReactNode }) {
    const ringtoneRef = useRef<HTMLAudioElement | null>(null)
    const notificationRef = useRef<HTMLAudioElement | null>(null)

    useEffect(() => {
        // Initialize ringtone
        const ringtone = new Audio('/sounds/call.mp3')
        ringtone.loop = true
        ringtone.volume = 1.0
        ringtoneRef.current = ringtone

        // Initialize notification sound
        const notification = new Audio('/sounds/message.mp3')
        notification.preload = 'auto'
        notificationRef.current = notification

        const unlock = () => {
            if (ringtoneRef.current) {
                ringtoneRef.current.play().then(() => {
                    ringtoneRef.current?.pause()
                }).catch(() => { })
            }
            if (notificationRef.current) {
                notificationRef.current.play().then(() => {
                    notificationRef.current?.pause()
                }).catch(() => { })
            }
            document.removeEventListener('click', unlock)
            document.removeEventListener('keydown', unlock)
            document.removeEventListener('touchstart', unlock)
        }

        document.addEventListener('click', unlock)
        document.addEventListener('keydown', unlock)
        document.addEventListener('touchstart', unlock)

        return () => {
            document.removeEventListener('click', unlock)
            document.removeEventListener('keydown', unlock)
            document.removeEventListener('touchstart', unlock)
            if (ringtoneRef.current) {
                ringtoneRef.current.pause()
                ringtoneRef.current = null
            }
            if (notificationRef.current) {
                notificationRef.current = null
            }
        }
    }, [])

    const playRingtone = useCallback(() => {
        if (ringtoneRef.current) {
            ringtoneRef.current.currentTime = 0
            ringtoneRef.current.play().catch(err => {
                console.warn('[AudioContext] Autoplay blocked or failed:', err)
            })
        }
    }, [])

    const stopRingtone = useCallback(() => {
        if (ringtoneRef.current) {
            ringtoneRef.current.pause()
            ringtoneRef.current.currentTime = 0
        }
    }, [])

    const playNotificationSound = useCallback(() => {
        if (notificationRef.current) {
            notificationRef.current.currentTime = 0
            notificationRef.current.play().catch(err => {
                console.warn('[AudioContext] Notification sound blocked or failed:', err)
            })
        }
    }, [])

    const playSound = useCallback((type: 'default' | 'notification' | 'ready' = 'default') => {
        if (notificationRef.current) {
            notificationRef.current.currentTime = 0
            notificationRef.current.play().catch(err => {
                console.warn('[AudioContext] playSound blocked or failed:', err)
            })
        }
    }, [])

    return (
        <AudioContext.Provider value={{ playRingtone, stopRingtone, playNotificationSound, playSound }}>
            {children}
        </AudioContext.Provider>
    )
}

export function useAudio() {
    const context = useContext(AudioContext)
    if (context === undefined) {
        throw new Error('useAudio must be used within an AudioProvider')
    }
    return context
}
