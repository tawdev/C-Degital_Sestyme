'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Custom hook for highly efficient, realtime unread message counting.
 * Implements "No-Refresh" logic: increments count directly in state on INSERT.
 */
export function useUnreadCount(initialCount: number, userId: string) {
    const [count, setCount] = useState(initialCount)
    const supabase = createClient()
    const userIdRef = useRef(userId)

    useEffect(() => {
        userIdRef.current = userId
        setCount(initialCount)
    }, [initialCount, userId])

    const syncWithDb = useCallback(async () => {
        if (!userIdRef.current) return

        console.log('[useUnreadCount] Syncing unread count from DB...')
        const { count: dbCount, error } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('recipient_id', userIdRef.current)
            .eq('is_read', false)

        if (!error && dbCount !== null) {
            console.log('[useUnreadCount] Sync complete:', dbCount)
            setCount(dbCount)
        }
    }, [supabase])

    useEffect(() => {
        if (!userId) return

        console.log(`[useUnreadCount] Initializing Realtime for user: ${userId}`)

        const channel = supabase
            .channel(`unread_realtime_${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `recipient_id=eq.${userId}`
                },
                (payload) => {
                    console.log('[useUnreadCount] EVENT: INSERT detected. Payload:', payload.new)
                    setCount(prev => prev + 1)
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages'
                    // We REMOVED the filter on UPDATE because REPLICA IDENTITY FULL might be missing.
                    // We filter client-side instead.
                },
                (payload) => {
                    const isNewRead = payload.new.is_read
                    const isOldRead = payload.old?.is_read
                    const belongsToMe = payload.new.recipient_id === userId
                    const wasModified = payload.new.id !== undefined // Ensure it's not a heartbeat

                    if (belongsToMe && wasModified) {
                        console.log('[useUnreadCount] EVENT: UPDATE detected for current user. Syncing...')
                        syncWithDb()
                    }
                }
            )
            .subscribe((status) => {
                console.log(`[useUnreadCount] Subscription status:`, status)
                if (status === 'SUBSCRIBED') {
                    // One-time sync on subscribe to catch anything missed during transition
                    syncWithDb()
                }
            })

        return () => {
            console.log(`[useUnreadCount] Cleaning up subscription for user: ${userId}`)
            supabase.removeChannel(channel)
        }
    }, [userId, supabase, syncWithDb])

    return { count }
}
