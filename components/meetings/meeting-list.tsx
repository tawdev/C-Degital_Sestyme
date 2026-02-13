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
            <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-20 text-center">
                <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Video className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Aucune réunion prévue</h3>
                <p className="text-gray-500">Organisez votre première réunion en cliquant sur le bouton ci-dessus.</p>
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
                        className={`group bg-white rounded-3xl p-6 border transition-all relative overflow-hidden flex flex-col justify-between
                            ${canJoin
                                ? 'border-indigo-100 shadow-xl cursor-pointer hover:border-indigo-200'
                                : 'border-gray-100 shadow-sm opacity-90 cursor-default'
                            }`}
                    >
                        {/* Status Badge */}
                        <div className="absolute top-0 right-0 p-4 z-10">
                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${effectiveStatus === 'live' ? 'bg-red-50 text-red-600 animate-pulse' :
                                effectiveStatus === 'ended' ? 'bg-gray-100 text-gray-500' :
                                    'bg-indigo-50 text-indigo-600'
                                }`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${effectiveStatus === 'live' ? 'bg-red-600' :
                                    effectiveStatus === 'ended' ? 'bg-gray-400' :
                                        'bg-indigo-600'
                                    }`} />
                                {effectiveStatus === 'live' ? 'En cours' :
                                    effectiveStatus === 'ended' ? 'Terminé' :
                                        'Prévu'}
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Title & Type */}
                            <div className="flex items-start gap-4">
                                <div className={`p-4 rounded-2xl shadow-sm shrink-0 ${meeting.type === 'video' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                    {meeting.type === 'video' ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
                                </div>
                                <div className="pr-16">
                                    <h3 className="font-black text-gray-900 leading-tight mb-1 group-hover:text-indigo-600 transition-colors uppercase tracking-tight line-clamp-2">
                                        {meeting.title}
                                    </h3>
                                    <p className="text-xs text-gray-500 font-medium line-clamp-1">{meeting.description || 'Pas de description'}</p>
                                </div>
                            </div>

                            {/* Date & Time */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 p-3 rounded-2xl flex items-center gap-3">
                                    <Calendar className="w-4 h-4 text-indigo-500" />
                                    <div>
                                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Date</p>
                                        <p className="text-xs font-black text-gray-900">{format(start, 'd MMM yyyy', { locale: fr })}</p>
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-2xl flex items-center gap-3">
                                    <Clock className="w-4 h-4 text-indigo-500" />
                                    <div>
                                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Heure</p>
                                        <p className="text-xs font-black text-gray-900">{format(start, 'HH:mm', { locale: fr })}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Participants & Host */}
                            <div className="flex items-center justify-between pt-2">
                                <div className="flex -space-x-3 overflow-hidden">
                                    {meeting.participants?.slice(0, 4).map((p: any) => (
                                        <EmployeeAvatar
                                            key={p.user_id}
                                            avatarUrl={p.user?.avatar_url}
                                            fullName={p.user?.full_name}
                                            className="w-8 h-8 border-2 border-white shadow-sm"
                                        />
                                    ))}
                                    {meeting.participants?.length > 4 && (
                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 border-2 border-white text-[10px] font-bold text-gray-500">
                                            +{meeting.participants.length - 4}
                                        </div>
                                    )}
                                </div>

                                {/* Dynamic Action Button */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => handleDelete(e, meeting.id)}
                                        className="p-2 hover:bg-red-50 rounded-xl text-gray-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>

                                    {isLive ? (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); router.push(`/meetings/${meeting.id}`) }}
                                            className="ml-2 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200 transition-transform active:scale-95 animate-pulse"
                                        >
                                            <Video className="w-3 h-3" />
                                            Rejoindre
                                        </button>
                                    ) : isEnded ? (
                                        hasRecording ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest italic">Replay</span>
                                                <div className="p-3 bg-purple-600 text-white rounded-xl shadow-lg shadow-purple-100 transition-transform group-hover:translate-x-1">
                                                    <Play className="w-4 h-4 fill-current" />
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Terminé</span>
                                        )
                                    ) : (
                                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest italic">
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
