'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getMeetings } from '@/app/(main)/chat/actions'
import { Video, X, Clock, ArrowRight, Play } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, differenceInSeconds, addMinutes, isBefore, isAfter } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useAudio } from '@/context/audio-context'

export default function MeetingNotification() {
    const router = useRouter()
    const pathname = usePathname()
    const [nextMeeting, setNextMeeting] = useState<any>(null)
    const [isVisible, setIsVisible] = useState(false)
    const [isDismissed, setIsDismissed] = useState(false)
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
                // Check if dismissed in localStorage
                const dismissedMeetings = JSON.parse(localStorage.getItem('dismissed-notifications') || '{}')
                if (dismissedMeetings[relevantMeeting.id]) {
                    setIsVisible(false)
                    setIsDismissed(true)
                } else {
                    setIsDismissed(false)
                }

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
        setIsDismissed(true)
        if (nextMeeting?.id) {
            const dismissedMeetings = JSON.parse(localStorage.getItem('dismissed-notifications') || '{}')
            dismissedMeetings[nextMeeting.id] = true
            localStorage.setItem('dismissed-notifications', JSON.stringify(dismissedMeetings))
        }
    }

    if (!isVisible || !nextMeeting || isDismissed) return null

    // Formatting for display
    const formatTime = (seconds: number) => {
        if (seconds <= 0) return '00:00'
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    return (
        <div className="fixed bottom-6 right-6 z-50">
            <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.9 }}
                className={`
                    relative overflow-hidden rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border backdrop-blur-2xl transition-all w-[340px] md:w-[380px]
                    ${isLive
                        ? 'bg-white/80 dark:bg-gray-900/80 border-indigo-500/30'
                        : 'bg-white/80 dark:bg-gray-900/80 border-gray-200 dark:border-white/10'}
                `}
            >
                {/* Modern Header Gradient */}
                <div className={`h-1.5 w-full ${isLive ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-gradient-x' : 'bg-gray-100 dark:bg-white/10'}`} />

                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-2xl ${isLive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-gray-100 dark:bg-white/5 text-gray-400'}`}>
                                <Video className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col">
                                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isLive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                    {isLive ? 'Meeting en direct' : 'Prochain Meeting'}
                                </span>
                                {isLive && (
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                        <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest">Live Now</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={handleDismiss}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all active:scale-90"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <h3 className="font-black text-gray-900 dark:text-white text-lg mb-1 leading-tight tracking-tight line-clamp-2">
                        {nextMeeting.title}
                    </h3>
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-5 h-5 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center overflow-hidden border border-white/10">
                            {nextMeeting.host?.avatar_url ? (
                                <img src={nextMeeting.host.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-[8px] font-black text-gray-400">{nextMeeting.host?.full_name?.charAt(0)}</span>
                            )}
                        </div>
                        <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
                            Proposé par <span className="text-indigo-600 dark:text-indigo-400">{nextMeeting.host?.full_name || 'Inconnu'}</span>
                        </p>
                    </div>

                    {!isLive ? (
                        <div className="flex items-center justify-between bg-gray-50 dark:bg-white/5 rounded-[1.25rem] p-4 border border-gray-100 dark:border-white/5 mb-2">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Démarrage dans</span>
                                <span className="font-mono text-2xl font-black text-gray-900 dark:text-white tabular-nums tracking-tighter">
                                    {formatTime(timeRemaining)}
                                </span>
                            </div>
                            <Clock className="w-6 h-6 text-gray-200 dark:text-white/10" />
                        </div>
                    ) : (
                        <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-500/10 rounded-[1.25rem] p-4 border border-indigo-100 dark:border-indigo-500/20 mb-2">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">Durée prévue</span>
                                <span className="text-sm font-black text-indigo-900 dark:text-white">
                                    {nextMeeting.duration || 60} minutes
                                </span>
                            </div>
                            <Play className="w-5 h-5 text-indigo-500 animate-pulse" />
                        </div>
                    )}

                    <div className="mt-6">
                        {isLive ? (
                            <button
                                onClick={handleJoin}
                                className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-500/25 active:scale-[0.98] group"
                            >
                                <Video className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                Rejoindre le Salon
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                        ) : (
                            <div className="w-full flex items-center justify-center gap-2 bg-gray-100 dark:bg-white/5 text-gray-400 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
                                <Clock className="w-4 h-4" />
                                Salle en attente
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
