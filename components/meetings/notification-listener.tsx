'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNotifications } from '@/context/notification-context'
import { useAudio } from '@/context/audio-context'
import { markNotificationSeen, getUnreadNotifications } from '@/app/(main)/chat/actions'
import { Video, Bell, X, Calendar, Clock } from 'lucide-react'
import Link from 'next/link'

export default function MeetingNotificationListener({ userId }: { userId: string }) {
    const supabase = createClient()
    const { showNotification } = useNotifications()
    const { playSound } = useAudio()
    const [currentPopup, setCurrentPopup] = useState<any>(null)

    const handleNewNotification = useCallback((notification: any) => {
        console.log('[NotificationListener] Processing notification:', notification)

        // Play sound
        if (notification.sound === 'exact') playSound('ready')
        else playSound('notification')

        // Show browser notification
        showNotification(
            notification.type === 'immediate' ? 'Nouveau Meeting' : 'Rappel Meeting',
            {
                body: `Vous avez un meeting prévu à ${new Date(notification.scheduled_at).toLocaleTimeString()}`,
                icon: '/favicon.ico',
                tag: notification.id
            }
        )

        // Show UI Popup
        setCurrentPopup(notification)
    }, [showNotification, playSound])

    useEffect(() => {
        // 1. Initial check for "Today" meetings on load
        checkUpcomingMeetings()

        // 2. Real-time subscription
        const channel = supabase
            .channel(`meeting_notifications_listener_${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'meeting_notifications',
                    filter: `user_id=eq.${userId}`
                },
                // @ts-ignore - Payload typing
                (payload: any) => {
                    handleNewNotification(payload.new)
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [userId, handleNewNotification])

    async function checkUpcomingMeetings() {
        const unread = await getUnreadNotifications()
        if (unread.length > 0) {
            // Pick the most recent one to show as a popup if not seen
            setCurrentPopup(unread[0])
        }
    }

    const closePopup = async () => {
        if (currentPopup) {
            await markNotificationSeen(currentPopup.id)
            setCurrentPopup(null)
        }
    }

    if (!currentPopup) return null

    return (
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-right-full duration-500">
            <div className="bg-white rounded-3xl shadow-2xl border border-indigo-100 p-6 max-w-sm w-full overflow-hidden relative group">
                {/* Decoration */}
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-50 rounded-full blur-3xl opacity-50 group-hover:scale-110 transition-transform duration-700" />

                <button
                    onClick={closePopup}
                    className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-xl text-gray-400 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="relative flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100">
                            <Video className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-none mb-1">
                                {currentPopup.type === 'immediate' ? 'Nouveau Meeting' : 'Rappel Meeting'}
                            </p>
                            <h3 className="text-lg font-black text-gray-900 leading-tight">
                                {currentPopup.meeting?.title || 'Réunion Prévue'}
                            </h3>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 p-3 rounded-2xl flex items-center gap-3">
                            <Calendar className="w-4 h-4 text-indigo-500" />
                            <p className="text-xs font-black text-gray-900">
                                {new Date(currentPopup.scheduled_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                            </p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-2xl flex items-center gap-3">
                            <Clock className="w-4 h-4 text-indigo-500" />
                            <p className="text-xs font-black text-gray-900">
                                {new Date(currentPopup.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={closePopup}
                            className="flex-1 py-4 bg-gray-100 text-gray-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-[0.98]"
                        >
                            Fermer
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
