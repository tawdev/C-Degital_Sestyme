'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getUnreadCount } from '@/app/(main)/chat/actions'

/**
 * Custom hook for highly efficient, realtime unread message counting.
 * Supports both global unread count and conversation-specific counts.
 */
export function useUnreadCount(initialCount: number, userId: string, conversationId?: string) {
    const [count, setCount] = useState(initialCount)
    // lastCountRef tracks what we think the count is (Prop or Realtime)
    const lastCountRef = useRef(initialCount)
    // lastRealtimeUpdateRef tracks when we last got a +1 from Realtime
    const lastRealtimeUpdateRef = useRef(0)

    const supabase = createClient()
    const userIdRef = useRef(userId)
    const convIdRef = useRef(conversationId)

    // Sync refs
    useEffect(() => {
        userIdRef.current = userId
        convIdRef.current = conversationId
    }, [userId, conversationId])

    // Update count when initialCount changes, but with a STABILIZATION LOCK.
    // If we just got a Realtime +1, we ignore server-side prop updates for 5s 
    // because the server (revalidatePath) might still be returning the old value.
    useEffect(() => {
        const now = Date.now()
        const isLocked = now - lastRealtimeUpdateRef.current < 5000

        if (isLocked) {
            // During lock-in, only trust server if it yields a HIGHER count than us
            // OR if it explicitly resets to 0 (which means it's definitely been read)
            if (initialCount > count || initialCount === 0) {
                setCount(initialCount)
                lastCountRef.current = initialCount
            }
        } else {
            // No lock, sync everything
            if (initialCount !== lastCountRef.current) {
                setCount(initialCount)
                lastCountRef.current = initialCount
            }
        }
    }, [initialCount, count])

    const syncWithDb = useCallback(async () => {
        if (!userIdRef.current) return

        try {
            const dbCount = await getUnreadCount(convIdRef.current)

            const now = Date.now()
            const isLocked = now - lastRealtimeUpdateRef.current < 5000

            // Apply same stabilization logic to manual syncs
            if (!isLocked || dbCount > count || dbCount === 0) {
                setCount(dbCount)
                lastCountRef.current = dbCount
            }
        } catch (err) {
            console.error('Error syncing unread count with DB:', err)
        }
    }, [count])

    useEffect(() => {
        if (!userId) return

        // If we have a conversationId, we listen to that specific conversation.
        // This handles both P2P and Group chats correctly.
        const filter = conversationId
            ? `conversation_id=eq.${conversationId}`
            : `recipient_id=eq.${userId}`

        const channelId = conversationId
            ? `unread_${userId}_${conversationId}`
            : `unread_global_${userId}`

        const channel = supabase
            .channel(channelId)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: filter
                },
                (payload) => {
                    const msg = payload.new as any

                    // For specific conversation: Increment if someone else sent it
                    if (conversationId) {
                        if (msg.sender_id !== userId) {
                            setCount(prev => {
                                const next = prev + 1
                                lastCountRef.current = next
                                lastRealtimeUpdateRef.current = Date.now()
                                return next
                            })
                        }
                    } else {
                        // Global count (Fallback to P2P only for now)
                        if (msg.recipient_id === userId) {
                            setCount(prev => {
                                const next = prev + 1
                                lastCountRef.current = next
                                lastRealtimeUpdateRef.current = Date.now()
                                return next
                            })
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages'
                },
                (payload) => {
                    const msg = payload.new as any

                    const matchesUser = msg.recipient_id === userId
                    const matchesConv = !conversationId || msg.conversation_id === conversationId

                    if (matchesConv && (matchesUser || conversationId)) {
                        // When a message is updated (e.g. is_read changed or participants updated), we sync
                        if (msg.is_read === true) {
                            lastRealtimeUpdateRef.current = 0 // Clear lock
                        }
                        syncWithDb()
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    syncWithDb()
                }
            })

        return () => {
            supabase.removeChannel(channel)
        }
    }, [userId, conversationId, supabase, syncWithDb])

    return { count, setCount }
}
