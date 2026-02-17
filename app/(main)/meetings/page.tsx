'use client'

import React, { useEffect, useState } from 'react'
import { Video, Plus, Search, Filter, Calendar, Users, Monitor, ArrowLeft } from 'lucide-react'
import { getMeetings } from '@/app/(main)/chat/actions'
import MeetingList from '@/components/meetings/meeting-list'
import MeetingCreationModal from '@/components/meetings/meeting-creation-modal'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function MeetingsPage() {
    const [meetings, setMeetings] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [filterStatus, setFilterStatus] = useState<'all' | 'scheduled' | 'live' | 'ended'>('all')

    useEffect(() => {
        loadMeetings()
    }, [])

    async function loadMeetings(showLoading = true) {
        if (showLoading) setLoading(true)
        const data = await getMeetings()
        setMeetings(data)
        setLoading(false)
    }

    // Real-time subscription
    useEffect(() => {
        const supabase = createClient()
        let channel: ReturnType<typeof supabase.channel>

        async function setupRealtime() {
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) return

            channel = supabase.channel('meetings-realtime')
                // 0. Listen for Manual Broadcasts (Reliable fallback)
                .on('broadcast', { event: 'meeting-update' }, (payload: any) => {
                    console.log('Broadcast received:', payload)
                    const p = payload.payload
                    if (p && p.participantIds && Array.isArray(p.participantIds)) {
                        if (p.participantIds.includes(user.id)) {
                            console.log('Refreshing meetings via broadcast...')
                            loadMeetings(false)
                        }
                    }
                })
                // 1. Listen for new invites (User added to meeting_participants)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'meeting_participants',
                        filter: `user_id=eq.${user.id}`
                    },
                    (payload: any) => {
                        console.log('New meeting invite!', payload)
                        loadMeetings(false)
                    }
                )
                // 2. Listen for removal (User removed from meeting_participants)
                .on(
                    'postgres_changes',
                    {
                        event: 'DELETE',
                        schema: 'public',
                        table: 'meeting_participants',
                        filter: `user_id=eq.${user.id}`
                    },
                    (payload: any) => {
                        console.log('Removed from meeting!', payload)
                        loadMeetings(false)
                    }
                )
                // 3. Listen for meeting STATUS updates or DELETIONS
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'meetings'
                    },
                    (payload: any) => {
                        console.log('Meeting update!', payload)
                        loadMeetings(false)
                    }
                )
                .subscribe()
        }

        setupRealtime()

        return () => {
            if (channel) supabase.removeChannel(channel)
        }
    }, [])

    const filteredMeetings = meetings.filter(m => {
        const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.host?.full_name.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesStatus = filterStatus === 'all' || m.status === filterStatus
        return matchesSearch && matchesStatus
    })

    return (
        <div className="max-w-7xl mx-auto space-y-10 pb-12 transition-colors duration-500">
            {/* Header section with rich aesthetics */}
            <div className="relative overflow-hidden bg-white/70 dark:bg-white/5 backdrop-blur-2xl p-8 md:p-12 rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-2xl shadow-indigo-900/5">
                {/* Background decorative elements */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-50 dark:bg-indigo-600/10 rounded-full blur-3xl opacity-50" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-50 dark:bg-purple-600/10 rounded-full blur-3xl opacity-50" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full opacity-20" />

                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 font-black">
                            <div className="p-2.5 bg-indigo-50 dark:bg-white/5 rounded-2xl shadow-sm border border-transparent dark:border-white/10">
                                <Monitor className="w-5 h-5" />
                            </div>
                            <span className="text-xs tracking-[0.2em] uppercase">Communication System</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-gray-900 dark:text-white tracking-tight">Hub de Réunions</h1>
                        <p className="text-gray-500 dark:text-indigo-200/60 max-w-lg font-medium text-lg">Planifiez, gérez et rejoignez vos réunions professionnelles en un clic avec une expérience audio et vidéo haute définition.</p>
                    </div>

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="group flex items-center justify-center gap-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white px-10 py-5 rounded-[2rem] font-black shadow-2xl shadow-indigo-900/20 transition-all active:scale-[0.98] w-full lg:w-auto uppercase tracking-widest text-sm"
                    >
                        <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
                        Nouvelle Réunion
                    </button>
                </div>

                {/* Search and Filters */}
                <div className="relative mt-12 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-indigo-500 transition-all" />
                        <input
                            type="text"
                            placeholder="Rechercher une réunion par titre ou organisateur..."
                            className="w-full pl-16 pr-6 py-5 bg-gray-50/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:bg-white dark:focus:bg-white/10 focus:border-indigo-100 dark:focus:border-white/20 transition-all text-gray-900 dark:text-white placeholder:text-gray-400"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 p-1.5 bg-gray-50/50 dark:bg-white/5 rounded-[1.5rem] border border-transparent dark:border-white/10">
                        {(['all', 'scheduled', 'live', 'ended'] as const).map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-6 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${filterStatus === status
                                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-xl scale-[1.02]'
                                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                {status === 'all' ? 'Toutes' :
                                    status === 'scheduled' ? 'Prévues' :
                                        status === 'live' ? 'En direct' : 'Terminées'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 bg-white/50 dark:bg-white/5 backdrop-blur-xl rounded-[2.5rem] border border-dashed border-gray-200 dark:border-white/10">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-indigo-600/10 dark:border-white/5 rounded-full" />
                        <div className="absolute inset-0 w-16 h-16 border-4 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <p className="text-gray-900 dark:text-white font-black uppercase tracking-widest text-[10px] mt-8 animate-pulse">Synchronisation des réunions...</p>
                </div>
            ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <MeetingList meetings={filteredMeetings} />
                </div>
            )}

            <MeetingCreationModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false)
                    loadMeetings()
                }}
            />
        </div>
    )
}
