'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimePresenceState } from '@supabase/supabase-js'

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
    const supabase = useMemo(() => createClient(), [])
    const audioRef = useRef<HTMLAudioElement | null>(null)

    // Initialize notification sound
    useEffect(() => {
        audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3')
    }, [])

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

    const showNotification = useCallback((payload: any) => {
        console.log('[Realtime] Attempting to show notification:', payload)
        if (Notification.permission === 'granted') {
            const { sender_name, content } = payload
            new Notification(`New message from ${sender_name}`, {
                body: content,
                icon: '/favicon.ico'
            })
        } else {
            console.warn('[Realtime] Notification permission state:', Notification.permission)
        }
    }, [])

    useEffect(() => {
        if (!currentUserId) return

        console.log('[Realtime] Starting main-realtime channel for user:', currentUserId)

        // 1. Request Notification Permission
        if (Notification.permission === 'default') {
            Notification.requestPermission()
        }

        // 2. Persistent Realtime Channel (Presence + Listeners)
        const mainChannel = supabase.channel('main-realtime', {
            config: {
                presence: { key: currentUserId },
            },
        })

        mainChannel
            .on('presence', { event: 'sync' }, () => {
                const newState = mainChannel.presenceState<PresenceState>()
                setOnlineUsers(newState)
            })
            .on('presence', { event: 'join' }, ({ key }: { key: string }) => {
                if (key === currentUserId) updateDbStatus(true)
            })
            .on('presence', { event: 'leave' }, ({ key }: { key: string }) => {
                if (key === currentUserId) updateDbStatus(false)
            })
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages'
                },
                async (payload) => {
                    const newMessage = payload.new
                    console.log('[Realtime] New message detected:', newMessage.id)

                    // Track handled message ID for deduplication with broadcast fallback
                    handledMessagesRef.current.add(newMessage.id);
                    if (handledMessagesRef.current.size > 100) {
                        const firstEntry = handledMessagesRef.current.values().next().value;
                        if (firstEntry) handledMessagesRef.current.delete(firstEntry);
                    }

                    // Skip if from self
                    if (newMessage.sender_id === currentUserId) return

                    // Check if chat is active (don't notify)
                    if (newMessage.conversation_id === activeConvRef.current) {
                        console.log('[Realtime] Notification suppressed: active chat window')
                        return
                    }

                    // Play sound
                    audioRef.current?.play().catch(e => console.warn('[Realtime] Sound error:', e))

                    // Get sender details
                    const { data: sender } = await supabase
                        .from('employees')
                        .select('full_name')
                        .eq('id', newMessage.sender_id)
                        .single()

                    showNotification({
                        sender_name: sender?.full_name || 'Someone',
                        content: newMessage.content
                    })

                    // Dispatch global event for components (ChatWindow, Sidebar)
                    window.dispatchEvent(new CustomEvent('new-message', {
                        detail: { message: newMessage }
                    }))

                    // Auto-mark as delivered via broadcast
                    mainChannel.send({
                        type: 'broadcast',
                        event: 'message-status',
                        payload: {
                            message_id: newMessage.id,
                            status: 'delivered',
                            conversation_id: newMessage.conversation_id
                        }
                    })
                }
            )
            .on(
                'broadcast',
                { event: 'new-message-fallback' },
                async (payload) => {
                    const { message, sender_name } = payload.payload;
                    console.log('[Realtime] Fallback message received via broadcast:', message.id);

                    // Skip if from self
                    if (message.sender_id === currentUserId) return;

                    // Deduplicate: If we already handled this message via postgres_changes, ignore broadcast
                    // (We can use a simple ref set for this)
                    if (handledMessagesRef.current.has(message.id)) {
                        console.log('[Realtime] Ignoring fallback broadcast: already handled by DB');
                        return;
                    }
                    handledMessagesRef.current.add(message.id);
                    // Cleanup old IDs
                    if (handledMessagesRef.current.size > 100) {
                        const firstEntry = handledMessagesRef.current.values().next().value;
                        if (firstEntry) handledMessagesRef.current.delete(firstEntry);
                    }

                    // Check if chat is active (don't notify)
                    if (message.conversation_id === activeConvRef.current) {
                        console.log('[Realtime] Fallback suppressed: active chat window');
                        return;
                    }

                    // Play sound
                    audioRef.current?.play().catch(e => console.warn('[Realtime] Sound error fallback:', e));

                    showNotification({
                        sender_name: sender_name || 'Someone',
                        content: message.content
                    });

                    // Dispatch global event for components
                    window.dispatchEvent(new CustomEvent('new-message', {
                        detail: { message: message }
                    }))

                    // Auto-mark as delivered via broadcast
                    mainChannel.send({
                        type: 'broadcast',
                        event: 'message-status',
                        payload: {
                            message_id: message.id,
                            status: 'delivered',
                            conversation_id: message.conversation_id
                        }
                    });
                }
            )
            .on(
                'broadcast',
                { event: 'message-status' },
                (payload) => {
                    const { message_id, status, conversation_id } = payload.payload
                    window.dispatchEvent(new CustomEvent('message-status-update', {
                        detail: { message_id, status, conversation_id }
                    }))
                }
            )
            .on(
                'broadcast',
                { event: 'conversation-seen' },
                (payload) => {
                    const { conversation_id, user_id } = payload.payload
                    window.dispatchEvent(new CustomEvent('conversation-seen', {
                        detail: { conversation_id, user_id }
                    }))
                }
            )
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[Realtime] Successfully subscribed to main-realtime')
                    await mainChannel.track({
                        user_id: currentUserId,
                        online_at: new Date().toISOString(),
                    })
                } else {
                    console.error('[Realtime] Subscription error:', status)
                }
            })

        return () => {
            console.log('[Realtime] Cleaning up main-realtime')
            mainChannel.unsubscribe()
        }
    }, [currentUserId, supabase, updateDbStatus, showNotification])

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
        <RealtimeContext.Provider value={value}>
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
