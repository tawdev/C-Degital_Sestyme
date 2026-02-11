'use client'

import React, { createContext, useContext, useRef, useCallback, useEffect } from 'react'

interface AudioContextType {
    playRingtone: () => void
    stopRingtone: () => void
    playNotificationSound: () => void
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
        const pingBase64 = 'data:audio/mp3;base64,SUQzBAAAAAABAFRYWFgAAAASAAADbWFqb3JfYnJhbmQAZGFzaABUWFhYAAAAEQAAA21pbm9yX3ZlcnNpb24AMABUWFhYAAAAHAAAA2NvbXBhdGlibGVfYnJhbmRzAGlzbzZtcDQxAFRTU0UAAAAPAAADTGF2ZjYwLjMuMTAwAAAAAAAAAAAAAAD/+000OAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA/wAAAACAFG7bgAAAAAAAANuWAAAAAAAAAAEAAA6F//7kMQZAAAAGkAaACAAAnQBoAIAAAnQBj7v8AAAAA//uQxBkAAADYAYAAAAAC2AGAAAAAAEY+7/AAAAAP/7kMQZAAAAlgBgAAAAAJYAYAAAAAARj7v8AAAAA/+5DEGQAAACYAYAAAAACWAGAAAAAAEY+7/AAAAAD'
        const notification = new Audio(pingBase64)
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

    return (
        <AudioContext.Provider value={{ playRingtone, stopRingtone, playNotificationSound }}>
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
