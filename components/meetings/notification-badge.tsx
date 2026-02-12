'use client'

import React, { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getUnreadNotifications } from '@/app/(main)/chat/actions'

export default function MeetingNotificationBadge({ userId }: { userId: string }) {
    const [unreadCount, setUnreadCount] = useState(0)
    const supabase = createClient()

    useEffect(() => {
        loadCount()

        // 🟢 Listen for real-time notifications
        const channel = supabase
            .channel(`meeting_notifications_${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'meeting_notifications',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    console.log('[MeetingNotification] New notification:', payload)
                    setUnreadCount(prev => prev + 1)
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [userId])

    async function loadCount() {
        const notifs = await getUnreadNotifications()
        setUnreadCount(notifs.length)
    }

    if (unreadCount === 0) return <Bell className="h-4 w-4 text-gray-400 group-hover:text-indigo-600" />

    return (
        <div className="relative group">
            <Bell className="h-4 w-4 text-indigo-600" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 text-[8px] font-bold text-white items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            </span>
        </div>
    )
}
