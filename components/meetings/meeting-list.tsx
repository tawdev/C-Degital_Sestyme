'use client'

import React, { useState, useEffect } from 'react'
import { Video, Phone, Calendar, Clock, User, ChevronRight, Play, MoreVertical, Trash2 } from 'lucide-react'
import { format, addMinutes } from 'date-fns'
import { fr } from 'date-fns/locale'
import EmployeeAvatar from '@/components/employee-avatar'
import { deleteMeeting, updateMeetingStatus } from '@/app/(main)/chat/actions'
import { useRouter } from 'next/navigation'

interface MeetingListProps {
    meetings: any[]
}

export default function MeetingList({ meetings }: MeetingListProps) {
    const router = useRouter()
    const [currentTime, setCurrentTime] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 10000) // Update every 10s for responsiveness
        return () => clearInterval(timer)
    }, [])

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.preventDefault()
        e.stopPropagation()
        if (confirm('Voulez-vous vraiment supprimer cette réunion ?')) {
            const res = await deleteMeeting(id)
            if (res.success) router.refresh()
        }
    }

    if (meetings.length === 0) {
        return (
            <div className="bg-white/50 dark:bg-white/5 backdrop-blur-xl rounded-[2.5rem] border border-dashed border-gray-200 dark:border-white/10 p-20 text-center">
                <div className="bg-gray-50 dark:bg-white/5 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                    <Video className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3 tracking-tight">Aucune réunion prévue</h3>
                <p className="text-gray-500 dark:text-indigo-200/40 max-w-sm mx-auto font-medium">Organisez votre première réunion professionnelle en un clic.</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {meetings.map((meeting) => {
                const start = new Date(meeting.scheduled_at)
                const duration = meeting.duration || 60
                const end = addMinutes(start, duration)

                // Effective Status Logic
                let effectiveStatus = meeting.status
                if (meeting.status === 'scheduled' || meeting.status === 'planned') {
                    if (currentTime >= start && currentTime < end) {
                        effectiveStatus = 'live'
                    } else if (currentTime >= end) {
                        effectiveStatus = 'ended'
                    }
                }

                const isEnded = effectiveStatus === 'ended'
                const isLive = effectiveStatus === 'live'
                const hasRecording = !!meeting.recording_url

                // Ready to join if Live
                const canJoin = isLive && !isEnded

                return (
                    <div
                        key={meeting.id}
                        onClick={() => canJoin && router.push(`/meetings/${meeting.id}`)}
                        className={`group bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-[2.5rem] p-8 border transition-all relative overflow-hidden flex flex-col justify-between
                            ${canJoin
                                ? 'border-indigo-100 dark:border-indigo-400/20 shadow-xl cursor-pointer hover:border-indigo-200 dark:hover:border-indigo-400/40 shadow-indigo-900/5'
                                : 'border-gray-100 dark:border-white/10 shadow-sm opacity-90 cursor-default'
                            }`}
                    >
                        {/* Status Badge */}
                        <div className="absolute top-0 right-0 p-6 z-10">
                            <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border ${effectiveStatus === 'live' ? 'bg-red-50 dark:bg-red-400/10 text-red-600 dark:text-red-400 border-red-100 dark:border-red-400/20 animate-pulse' :
                                effectiveStatus === 'ended' ? 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-500 border-gray-200 dark:border-white/10' :
                                    'bg-indigo-50 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-400/20'
                                }`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${effectiveStatus === 'live' ? 'bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.5)]' :
                                    effectiveStatus === 'ended' ? 'bg-gray-400' :
                                        'bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)]'
                                    }`} />
                                {effectiveStatus === 'live' ? 'En cours' :
                                    effectiveStatus === 'ended' ? 'Terminé' :
                                        'Prévu'}
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Title & Type */}
                            <div className="flex items-start gap-5">
                                <div className={`p-4 rounded-[1.2rem] shadow-sm shrink-0 border ${meeting.type === 'video' ? 'bg-purple-50 dark:bg-purple-400/10 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-400/20' : 'bg-blue-50 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-400/20'}`}>
                                    {meeting.type === 'video' ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
                                </div>
                                <div className="pr-20">
                                    <h3 className="text-lg font-black text-gray-900 dark:text-white leading-tight mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors uppercase tracking-tight line-clamp-2">
                                        {meeting.title}
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium line-clamp-2 leading-relaxed">{meeting.description || 'Optimisation des performances et revue hebdomadaire de la structure du projet.'}</p>
                                </div>
                            </div>

                            {/* Date & Time */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50/50 dark:bg-white/5 p-4 rounded-2xl flex items-center gap-3 border border-transparent dark:border-white/5 transition-colors">
                                    <Calendar className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                                    <div>
                                        <p className="text-[8px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Date</p>
                                        <p className="text-xs font-black text-gray-900 dark:text-white transition-colors">{format(start, 'd MMM yyyy', { locale: fr })}</p>
                                    </div>
                                </div>
                                <div className="bg-gray-50/50 dark:bg-white/5 p-4 rounded-2xl flex items-center gap-3 border border-transparent dark:border-white/5 transition-colors">
                                    <Clock className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                                    <div>
                                        <p className="text-[8px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Heure</p>
                                        <p className="text-xs font-black text-gray-900 dark:text-white transition-colors">{format(start, 'HH:mm', { locale: fr })}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Participants & Host */}
                            <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-white/5">
                                <div className="flex -space-x-3 overflow-hidden">
                                    {meeting.participants?.slice(0, 4).map((p: any) => (
                                        <EmployeeAvatar
                                            key={p.user_id}
                                            avatarUrl={p.user?.avatar_url}
                                            fullName={p.user?.full_name}
                                            className="w-9 h-9 border-2 border-white dark:border-white/10 shadow-lg"
                                        />
                                    ))}
                                    {meeting.participants?.length > 4 && (
                                        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-indigo-50 dark:bg-white/10 border-2 border-white dark:border-white/10 text-[10px] font-black text-indigo-600 dark:text-indigo-400">
                                            +{meeting.participants.length - 4}
                                        </div>
                                    )}
                                </div>

                                {/* Dynamic Action Button */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => handleDelete(e, meeting.id)}
                                        className="p-3 bg-red-50 dark:bg-red-400/10 text-red-400 dark:text-red-300 hover:text-red-700 dark:hover:text-white border border-red-100 dark:border-red-400/20 rounded-xl transition-all shadow-sm translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>

                                    {isLive ? (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); router.push(`/meetings/${meeting.id}`) }}
                                            className="ml-2 flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-900/20 transition-all active:scale-95 animate-pulse"
                                        >
                                            <Video className="w-4 h-4" />
                                            Rejoindre
                                        </button>
                                    ) : isEnded ? (
                                        hasRecording ? (
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest italic">Replay</span>
                                                <div className="p-4 bg-purple-600 dark:bg-purple-500 text-white rounded-[1.2rem] shadow-xl shadow-purple-900/20 transition-transform group-hover:scale-110">
                                                    <Play className="w-5 h-5 fill-current" />
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] font-black text-gray-400 dark:text-gray-600 uppercase tracking-widest italic">Session terminée</span>
                                        )
                                    ) : (
                                        <span className="text-[10px] font-black text-indigo-400 dark:text-indigo-400/60 uppercase tracking-widest italic flex items-center gap-2">
                                            <div className="w-1 h-1 rounded-full bg-indigo-400 animate-bounce" />
                                            {format(start, 'HH:mm')}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
