'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

interface NotificationContextType {
    notificationPermission: NotificationPermission
    requestPermission: () => Promise<void>
    showNotification: (title: string, options?: NotificationOptions & { isCall?: boolean }) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')
    const [isInCall, setIsInCall] = useState(false)

    useEffect(() => {
        if (typeof Notification !== 'undefined') {
            setNotificationPermission(Notification.permission)
        }

        // Listen for call state changes
        const handleCallActive = (e: any) => setIsInCall(e.detail.active)
        window.addEventListener('call-active-change', handleCallActive)
        return () => window.removeEventListener('call-active-change', handleCallActive)
    }, [])

    const requestPermission = useCallback(async () => {
        if (typeof Notification === 'undefined') return
        const permission = await Notification.requestPermission()
        setNotificationPermission(permission)
    }, [])

    const showNotification = useCallback((title: string, options?: NotificationOptions & { isCall?: boolean }) => {
        if (typeof Notification === 'undefined') return

        if (Notification.permission === 'default') {
            Notification.requestPermission().then(perm => {
                setNotificationPermission(perm)
                if (perm === 'granted') {
                    showNotification(title, options)
                }
            })
            return
        }

        if (Notification.permission !== 'granted') return

        const { isCall, ...notificationOptions } = options || {}

        // 🟢 FIX 1: Allow message notifications during active call, but block multiple call notifications
        if (isInCall && isCall) {
            console.log('[NotificationContext] Suppressing call notification because already in call')
            return
        }

        try {
            const n = new Notification(title, {
                icon: '/favicon.ico',
                ...notificationOptions
            })
            n.onclick = () => {
                window.focus()
                n.close()
            }
        } catch (err) {
            console.error('[NotificationContext] Notification failed:', err)
        }
    }, [isInCall])

    return (
        <NotificationContext.Provider value={{ notificationPermission, requestPermission, showNotification }}>
            {children}
        </NotificationContext.Provider>
    )
}

export function useNotifications() {
    const context = useContext(NotificationContext)
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider')
    }
    return context
}
