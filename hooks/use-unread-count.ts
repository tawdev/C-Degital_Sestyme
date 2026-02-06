'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

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
            if (initialCount > lastCountRef.current || initialCount === 0) {
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
    }, [initialCount])

    const syncWithDb = useCallback(async () => {
        if (!userIdRef.current) return

        try {
            const dbCount = await getUnreadCount(convIdRef.current)

            const now = Date.now()
            const isLocked = now - lastRealtimeUpdateRef.current < 5000

            // Apply same stabilization logic to manual syncs
            // Use lastCountRef instead of state count to avoid dependency loop
            if (!isLocked || dbCount > lastCountRef.current || dbCount === 0) {
                setCount(dbCount)
                lastCountRef.current = dbCount
            }
        } catch (err) {
            console.error('Error syncing unread count with DB:', err)
        }
    }, [])

    useEffect(() => {
        if (!userId) return

        const handleNewMessage = (e: any) => {
            const { message } = e.detail

            // Check if this message should increment OUR count
            const isOurConvo = !conversationId || message.conversation_id === conversationId
            const isSomeoneElse = message.sender_id !== userId

            if (isOurConvo && isSomeoneElse) {
                console.log('[useUnreadCount] Incrementing count for:', conversationId || 'global')
                setCount(prev => prev + 1)
            }
        }

        const handleReadReset = (e: any) => {
            const { conversation_id, user_id } = e.detail
            if (user_id === userId) {
                if (!conversationId || conversation_id === conversationId) {
                    console.log('[useUnreadCount] Resetting count for:', conversationId || 'global')
                    if (conversationId) {
                        setCount(0)
                    } else {
                        // For global count, we should probably re-sync with DB as only one convo was read
                        syncWithDb()
                    }
                }
            }
        }

        window.addEventListener('new-message', handleNewMessage)
        window.addEventListener('unread-count-reset', handleReadReset)

        // Initial sync
        syncWithDb()

        return () => {
            window.removeEventListener('new-message', handleNewMessage)
            window.removeEventListener('unread-count-reset', handleReadReset)
        }
    }, [userId, conversationId, syncWithDb])

    return { count, setCount }
}
