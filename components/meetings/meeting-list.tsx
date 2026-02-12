'use client'

import React from 'react'
import { Video, Phone, Calendar, Clock, User, ChevronRight, Play, MoreVertical, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import EmployeeAvatar from '@/components/employee-avatar'
import { deleteMeeting, updateMeetingStatus } from '@/app/(main)/chat/actions'
import { useRouter } from 'next/navigation'

interface MeetingListProps {
    meetings: any[]
}

export default function MeetingList({ meetings }: MeetingListProps) {
    const router = useRouter()

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
                const now = new Date()
                const scheduledTime = new Date(meeting.scheduled_at)
                const isEnded = meeting.status === 'ended'
                const isReady = now >= scheduledTime && !isEnded

                return (
                    <div
                        key={meeting.id}
                        onClick={() => isReady && router.push(`/meetings/${meeting.id}`)}
                        className={`group bg-white rounded-3xl p-6 border border-gray-100 shadow-sm transition-all relative overflow-hidden ${isReady ? 'hover:shadow-xl hover:border-indigo-100 cursor-pointer' : 'opacity-80 cursor-default'}`}
                    >
                        {/* Status Badge */}
                        <div className="absolute top-0 right-0 p-4">
                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${meeting.status === 'live' ? 'bg-red-50 text-red-600 animate-pulse' :
                                meeting.status === 'ended' ? 'bg-gray-100 text-gray-500' :
                                    'bg-indigo-50 text-indigo-600'
                                }`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${meeting.status === 'live' ? 'bg-red-600' :
                                    meeting.status === 'ended' ? 'bg-gray-400' :
                                        'bg-indigo-600'
                                    }`} />
                                {meeting.status === 'live' ? 'En cours' :
                                    meeting.status === 'ended' ? 'Terminé' :
                                        'Prévu'}
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Title & Type */}
                            <div className="flex items-start gap-4">
                                <div className={`p-4 rounded-2xl shadow-sm ${meeting.type === 'video' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                    {meeting.type === 'video' ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
                                </div>
                                <div className="pr-16">
                                    <h3 className="font-black text-gray-900 leading-tight mb-1 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{meeting.title}</h3>
                                    <p className="text-xs text-gray-500 font-medium line-clamp-1">{meeting.description || 'Pas de description'}</p>
                                </div>
                            </div>

                            {/* Date & Time */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 p-3 rounded-2xl flex items-center gap-3">
                                    <Calendar className="w-4 h-4 text-indigo-500" />
                                    <div>
                                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Date</p>
                                        <p className="text-xs font-black text-gray-900">{format(new Date(meeting.scheduled_at), 'd MMM yyyy', { locale: fr })}</p>
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-2xl flex items-center gap-3">
                                    <Clock className="w-4 h-4 text-indigo-500" />
                                    <div>
                                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Heure</p>
                                        <p className="text-xs font-black text-gray-900">{format(new Date(meeting.scheduled_at), 'HH:mm', { locale: fr })}</p>
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

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => handleDelete(e, meeting.id)}
                                        className="p-2 hover:bg-red-50 rounded-xl text-gray-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>

                                    {isEnded ? (
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Le meeting est terminé</p>
                                    ) : !isReady ? (
                                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest italic animate-pulse">
                                            Le meeting commencera à {format(scheduledTime, 'HH:mm')}
                                        </p>
                                    ) : (
                                        <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 transition-transform group-hover:translate-x-1">
                                            <Play className="w-4 h-4 fill-current" />
                                        </div>
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
