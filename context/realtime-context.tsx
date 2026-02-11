'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimePresenceState } from '@supabase/supabase-js'
import { useAudio } from './audio-context'
import { useNotifications } from './notification-context'

export type PresenceState = {
    user_id: string
    online_at: string
}

interface RealtimeContextType {
    onlineUsers: Record<string, PresenceState[]>
    isUserOnline: (userId: string) => boolean
    activeConversationId: string | null
    setActiveConversationId: (id: string | null) => void
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined)

export function RealtimeProvider({ children, currentUserId }: { children: React.ReactNode, currentUserId: string }) {
    const [onlineUsers, setOnlineUsers] = useState<Record<string, PresenceState[]>>({})
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
    const activeConvRef = useRef<string | null>(null)
    const handledMessagesRef = useRef<Set<string>>(new Set())
    const supabase = createClient()
    const { playNotificationSound } = useAudio()
    const { showNotification } = useNotifications()

    const updateDbStatus = useCallback(async (online: boolean) => {
        if (!currentUserId) return
        try {
            await supabase
                .from('employees')
                .update({
                    is_online: online,
                    last_seen_at: new Date().toISOString()
                })
                .eq('id', currentUserId)
        } catch (err) {
            console.error('[Realtime] Error updating DB status:', err)
        }
    }, [currentUserId, supabase])

    useEffect(() => {
        activeConvRef.current = activeConversationId
    }, [activeConversationId])

    // Sync DB status on mount/unmount
    useEffect(() => {
        updateDbStatus(true)
        return () => { updateDbStatus(false) }
    }, [updateDbStatus])


    // Web Push Registration
    useEffect(() => {
        if (!currentUserId || typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
            return
        }

        const registerPush = async () => {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js')
                console.log('[SW] Registered:', registration)

                // Wait for registration to be ready
                const ready = await navigator.serviceWorker.ready

                let subscription = await ready.pushManager.getSubscription()

                if (!subscription && Notification.permission === 'granted') {
                    console.log('[Push] Creating new subscription...')
                    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
                    if (!vapidPublicKey) {
                        console.error('[Push] VAPID Key missing')
                        return
                    }

                    // Convert base64 VAPID key to UInt8Array
                    const padding = '='.repeat((4 - vapidPublicKey.length % 4) % 4)
                    const base64 = (vapidPublicKey + padding).replace(/-/g, '+').replace(/_/g, '/')
                    const rawData = window.atob(base64)
                    const outputArray = new Uint8Array(rawData.length)
                    for (let i = 0; i < rawData.length; ++i) {
                        outputArray[i] = rawData.charCodeAt(i)
                    }

                    subscription = await ready.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: outputArray
                    })
                }

                if (subscription) {
                    console.log('[Push] Subscription active:', subscription.endpoint)

                    // Verify Auth Session before Save
                    const { data: { session } } = await supabase.auth.getSession()
                    console.log('[Push] Client Auth State:', session ? 'Authenticated' : 'Anonymous', 'UID:', session?.user?.id, 'Prop ID:', currentUserId)

                    // Save to DB
                    const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(subscription.getKey('p256dh')!))))
                    const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(subscription.getKey('auth')!))))

                    console.log('[Push] Saving to DB with user_id:', currentUserId)
                    const { error } = await supabase
                        .from('push_subscriptions')
                        .upsert({
                            user_id: currentUserId,
                            endpoint: subscription.endpoint,
                            p256dh,
                            auth
                        }, { onConflict: 'user_id,endpoint' })

                    if (error) {
                        console.error('[Push] DB Save Error:', error.message, 'Code:', error.code)
                    } else {
                        console.log('[Push] Subscription synced to DB successfully!')
                    }
                }
            } catch (err) {
                console.error('[Push] Registration failed:', err)
            }
        }

        registerPush()
    }, [currentUserId, supabase])

    useEffect(() => {
        if (!currentUserId) return

        console.log('[Realtime] Starting main-realtime channel for user:', currentUserId)


        const channel = supabase.channel('main-realtime', {
            config: {
                presence: { key: currentUserId },
            },
        })

        channel
            .on('presence', { event: 'sync' }, () => {
                const newState = channel.presenceState() as Record<string, PresenceState[]>
                setOnlineUsers(newState)
            })
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages'
                },
                async (payload: any) => {
                    const newMessage = payload.new
                    handledMessagesRef.current.add(newMessage.id)
                    if (handledMessagesRef.current.size > 100) {
                        const first = handledMessagesRef.current.values().next().value
                        if (first) handledMessagesRef.current.delete(first)
                    }

                    if (newMessage.sender_id === currentUserId) return

                    let enrichedMessage = { ...newMessage }
                    let conversationName = ''

                    try {
                        const { data: fullMsg } = await supabase
                            .from('messages')
                            .select('*, sender:employees!messages_sender_id_fkey(full_name), conversation:conversations(name, is_group)')
                            .eq('id', newMessage.id)
                            .single()

                        if (fullMsg) {
                            enrichedMessage = fullMsg
                            if (fullMsg.conversation?.is_group && fullMsg.conversation.name) {
                                conversationName = fullMsg.conversation.name
                            }
                        }
                    } catch (e) { console.error('[Realtime] Quick enrichment failed', e) }

                    const isTabHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
                    const isActive = newMessage.conversation_id === activeConvRef.current

                    console.log('[Realtime] Message Received -> isActive:', isActive, 'isTabHidden:', isTabHidden)

                    if (!isActive || isTabHidden) {
                        // Play sound only if not active/visible
                        playNotificationSound()

                        const senderName = (enrichedMessage as any).sender?.full_name || 'Someone'
                        const title = conversationName ? `${senderName} in ${conversationName}` : senderName

                        let displayContent = newMessage.content
                        if (newMessage.type === 'image') displayContent = '📷 Image'
                        else if (newMessage.type === 'audio') displayContent = '🎤 Voice message'
                        else if (newMessage.type === 'file') displayContent = '📁 File'

                        showNotification(title, { body: displayContent, tag: 'new-message' })
                    }
                    else {
                        console.log('[Realtime] Notification skipped: User is active in this conversation and tab is visible')
                    }

                    // Auto-mark as delivered via broadcast
                    channel.send({
                        type: 'broadcast',
                        event: 'message-status',
                        payload: {
                            message_id: newMessage.id,
                            status: 'delivered',
                            conversation_id: newMessage.conversation_id
                        }
                    })
                    window.dispatchEvent(new CustomEvent('new-message', { detail: { message: enrichedMessage } }))
                }
            )
            .on(
                'broadcast',
                { event: 'new-message-fallback' },
                (payload: any) => {
                    const { message, sender_name } = payload.payload
                    if (message.sender_id === currentUserId || handledMessagesRef.current.has(message.id)) return
                    handledMessagesRef.current.add(message.id)

                    playNotificationSound()

                    const isTabHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
                    const isActive = message.conversation_id === activeConvRef.current

                    if (!isActive || isTabHidden) {
                        showNotification(sender_name || 'Someone', { body: message.content, tag: 'new-message' })
                    }

                    // Auto-mark as delivered via broadcast
                    channel.send({
                        type: 'broadcast',
                        event: 'message-status',
                        payload: {
                            message_id: message.id,
                            status: 'delivered',
                            conversation_id: message.conversation_id
                        }
                    })
                    window.dispatchEvent(new CustomEvent('new-message', { detail: { message } }))
                }
            )
            .on(
                'broadcast',
                { event: 'message-status' },
                (payload: any) => {
                    window.dispatchEvent(new CustomEvent('message-status-update', { detail: payload.payload }))
                }
            )
            .on(
                'broadcast',
                { event: 'conversation-seen' },
                (payload: any) => {
                    const { conversation_id, user_id } = payload.payload
                    if (user_id === currentUserId) {
                        window.dispatchEvent(new CustomEvent('unread-count-reset', { detail: { conversation_id, user_id } }))
                    }
                    window.dispatchEvent(new CustomEvent('conversation-seen', { detail: { conversation_id, user_id } }))
                }
            )
            .subscribe(async (status: any) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[Realtime] Subscribed to main-realtime')
                    await channel.track({ user_id: currentUserId, online_at: new Date().toISOString() })
                }
            })

        return () => {
            console.log('[Realtime] Unsubscribing main-realtime')
            supabase.removeChannel(channel)
        }
    }, [currentUserId, supabase, showNotification, playNotificationSound])

    const isUserOnline = useCallback((userId: string) => {
        return !!onlineUsers[userId]
    }, [onlineUsers])

    const value = useMemo(() => ({
        onlineUsers,
        isUserOnline,
        activeConversationId,
        setActiveConversationId
    }), [onlineUsers, isUserOnline, activeConversationId])


    return (
        <RealtimeContext.Provider value={{ onlineUsers, isUserOnline, activeConversationId, setActiveConversationId }}>
            {children}
        </RealtimeContext.Provider>
    )
}

export function useRealtime() {
    const context = useContext(RealtimeContext)
    if (context === undefined) {
        throw new Error('useRealtime must be used within a RealtimeProvider')
    }
    return context
}
