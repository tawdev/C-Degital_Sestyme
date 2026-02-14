'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getMeetings } from '@/app/(main)/chat/actions'
import { Video, X, Clock, ArrowRight, Play } from 'lucide-react'
import { format, differenceInSeconds, addMinutes, isBefore, isAfter } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useAudio } from '@/context/audio-context'

export default function MeetingNotification() {
    const router = useRouter()
    const pathname = usePathname()
    const [nextMeeting, setNextMeeting] = useState<any>(null)
    const [isVisible, setIsVisible] = useState(false)
    const [timeRemaining, setTimeRemaining] = useState<number>(0)
    const [isLive, setIsLive] = useState(false)
    const [audioAllowed, setAudioAllowed] = useState(false) // For potential sound alert
    const { playSound } = useAudio()
    const supabase = createClient()
    const meetingCheckInterval = useRef<NodeJS.Timeout | null>(null)
    const countdownInterval = useRef<NodeJS.Timeout | null>(null)

    // Constants
    const NOTIFICATION_THRESHOLD_SECONDS = 5 * 60 // Show 5 minutes before
    const NOTIFICATION_DURATION_AFTER_START = 15 * 60 // Keep showing for 15 mins after start if not joined

    // Unified Visibility & Countdown Logic
    useEffect(() => {
        // 1. Instant check: If on meeting page, force hide
        if (typeof window !== 'undefined' && window.location.pathname.includes(`/meetings/${nextMeeting?.id}`)) {
            setIsVisible(false)
            return
        }

        if (!nextMeeting) {
            setIsVisible(false)
            return
        }

        const updateTimer = () => {
            // Re-check path inside interval to ensure we hide immediately if navigation happens
            if (typeof window !== 'undefined' && window.location.pathname.includes(`/meetings/${nextMeeting.id}`)) {
                setIsVisible(false)
                return
            }

            const now = new Date()
            const start = new Date(nextMeeting.scheduled_at)
            const duration = nextMeeting.duration || 60
            const end = addMinutes(start, duration)

            // Calculate diffs
            const secondsToStart = differenceInSeconds(start, now)
            const secondsToEnd = differenceInSeconds(end, now)

            // Determine state
            const isMeetingLive = secondsToStart <= 0 && secondsToEnd > 0
            const isAppproaching = secondsToStart > 0 && secondsToStart <= NOTIFICATION_THRESHOLD_SECONDS

            setIsLive(isMeetingLive)

            if (isAppproaching || isMeetingLive) {
                setTimeRemaining(secondsToStart)
                setIsVisible(true)
            } else {
                setIsVisible(false)
            }
        }

        updateTimer() // Initial call
        countdownInterval.current = setInterval(updateTimer, 1000)

        return () => {
            if (countdownInterval.current) clearInterval(countdownInterval.current)
        }
    }, [nextMeeting, pathname]) // Added pathname to dependencies so it re-runs immediately on navigation

    async function loadNextMeeting() {
        try {
            const allMeetings = await getMeetings()
            const now = new Date()

            // Find the most relevant upcoming or active meeting
            // 1. Not ended
            // 2. Scheduled time is close (within 5 mins) OR it's currently live
            // 3. Status is not cancelled/deleted (implied by getMeetings usually)

            const relevantMeeting = allMeetings
                .filter((m: any) => {
                    const start = new Date(m.scheduled_at)
                    const duration = m.duration || 60
                    const end = addMinutes(start, duration)

                    // Filter out ended meetings
                    if (isAfter(now, end)) return false
                    if (m.status === 'ended' || m.status === 'cancelled') return false

                    // Keep if it's starting soon or live
                    const secondsToStart = differenceInSeconds(start, now)
                    return secondsToStart <= NOTIFICATION_THRESHOLD_SECONDS
                })
                .sort((a: any, b: any) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0]

            if (relevantMeeting) {
                // Only update if it's a different meeting to avoid resetting state unnecessarily
                setNextMeeting((prev: any) => {
                    // Update if ID changed OR if key data changed (status, time)
                    if (
                        prev?.id !== relevantMeeting.id ||
                        prev?.status !== relevantMeeting.status ||
                        prev?.scheduled_at !== relevantMeeting.scheduled_at
                    ) {
                        // Only play sound if it's a NEW meeting ID (not just a status update)
                        if (prev?.id !== relevantMeeting.id) {
                            try { playSound('notification') } catch (e) { console.error(e) }
                        }
                        return relevantMeeting
                    }
                    return prev
                })
            } else {
                setNextMeeting(null)
                setIsVisible(false)
            }

        } catch (error) {
            console.error('Error loading meetings for notification:', error)
        }
    }

    useEffect(() => {
        let channel: ReturnType<typeof supabase.channel> | null = null

        const setup = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            channel = supabase.channel(`meeting-notification-${user.id}`)
                // Listen for database changes
                .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings' }, () => {
                    console.log('Meeting change detected, reloading...')
                    loadNextMeeting()
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_participants', filter: `user_id=eq.${user.id}` }, () => {
                    console.log('Participant change detected, reloading...')
                    loadNextMeeting()
                })
                // Listen for manual broadcasts (faster/instant)
                .on('broadcast', { event: 'meeting-update' }, () => {
                    console.log('Meeting broadcast received, reloading...')
                    loadNextMeeting()
                })
                .subscribe()
        }

        loadNextMeeting()
        setup()

        // Periodic check loop
        meetingCheckInterval.current = setInterval(loadNextMeeting, 60000)

        // Unified Cleanup
        return () => {
            if (channel) supabase.removeChannel(channel)
            if (meetingCheckInterval.current) clearInterval(meetingCheckInterval.current)
            if (countdownInterval.current) clearInterval(countdownInterval.current)
        }
    }, [])

    // Deleted setupRealtime function as it is now inside useEffect

    const handleJoin = () => {
        if (!nextMeeting) return
        setIsVisible(false) // Hide immediately
        router.push(`/meetings/${nextMeeting.id}`)
    }

    const handleDismiss = () => {
        setIsVisible(false)
        // Optionally store "dismissed" state for this meeting ID in sessionStorage so we don't show it again until status changes?
        // For now, simple dismiss until next refresh/update is fine.
    }

    if (!isVisible || !nextMeeting) return null

    // Formatting for display
    const formatTime = (seconds: number) => {
        if (seconds <= 0) return '00:00'
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-10 fade-in duration-500">
            <div className={`
                relative overflow-hidden rounded-2xl shadow-2xl border backdrop-blur-xl transition-all w-80 md:w-96
                ${isLive
                    ? 'bg-white/90 border-indigo-200 shadow-indigo-500/20'
                    : 'bg-white/90 border-gray-200'}
            `}>
                {/* Visual Header / Progress Bar */}
                <div className={`h-1.5 w-full ${isLive ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                    <div className={`h-full transition-all duration-1000 ease-linear ${isLive ? 'bg-indigo-600 w-full animate-pulse' : 'bg-gray-400'}`}
                        style={{ width: isLive ? '100%' : '100%' /* We could animate width based on time remaining */ }}
                    />
                </div>

                <div className="p-5">
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                            {isLive ? (
                                <span className="flex h-2.5 w-2.5 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                </span>
                            ) : (
                                <Clock className="w-4 h-4 text-gray-400" />
                            )}
                            <span className={`text-[10px] font-black uppercase tracking-widest ${isLive ? 'text-red-600' : 'text-gray-500'}`}>
                                {isLive ? 'Réunion en cours' : 'Commence bientôt'}
                            </span>
                        </div>
                        <button onClick={handleDismiss} className="text-gray-400 hover:text-gray-600 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <h3 className="font-bold text-gray-900 mb-1 line-clamp-1">{nextMeeting.title}</h3>
                    <p className="text-xs text-gray-500 mb-4 line-clamp-1">
                        Organisé par {nextMeeting.host?.full_name || 'Inconnu'}
                    </p>

                    {!isLive ? (
                        <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3 mb-2">
                            <span className="text-xs font-semibold text-gray-500">Temps restant</span>
                            <span className="font-mono text-xl font-black text-gray-900 tabular-nums">
                                {formatTime(timeRemaining)}
                            </span>
                        </div>
                    ) : null}

                    <div className="mt-4 flex gap-2">
                        {isLive ? (
                            <button
                                onClick={handleJoin}
                                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all shadow-lg shadow-indigo-200 active:scale-95 group"
                            >
                                <Video className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                Rejoindre maintenant
                            </button>
                        ) : (
                            <button disabled className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-400 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide cursor-not-allowed">
                                <Clock className="w-4 h-4" />
                                Bientôt disponible
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
