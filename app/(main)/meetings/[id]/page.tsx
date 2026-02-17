'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import MeetingRoom from '@/components/meetings/meeting-room'
import { getMeetingDetails } from '@/app/(main)/chat/actions'
import { getSession } from '@/app/auth/actions'
import { Loader2, ShieldAlert, ArrowLeft, Play, Calendar, Clock, Video, User } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useCall } from '@/components/providers/call-provider'

export default function MeetingPage() {
    const params = useParams()
    const id = params.id as string
    const router = useRouter()

    // Global call context for "Fast Path"
    const { isInCall, meetingId: activeMeetingId, meeting: activeMeeting, currentUser: activeUser } = useCall()

    const [meeting, setMeeting] = useState<any>(null)
    const [currentUser, setCurrentUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Fast Path logic: If we're already in THIS call, skip loading
    const isAlreadyInThisCall = isInCall && activeMeetingId === id && activeMeeting && activeUser

    useEffect(() => {
        if (id && !isAlreadyInThisCall) {
            loadData()
        }
    }, [id, isAlreadyInThisCall])

    async function loadData() {
        setLoading(true)
        const [meetingData, session] = await Promise.all([
            getMeetingDetails(id),
            getSession()
        ])

        if (!session) {
            router.push('/auth/login')
            return
        }

        setCurrentUser(session)

        if (!meetingData) {
            setError('Réunion introuvable')
            setLoading(false)
            return
        }

        // Check meeting status
        if (meetingData.status === 'ended' && !meetingData.recording_url) {
            setError('Cette réunion est terminée et aucun enregistrement n\'est disponible.')
            setLoading(false)
            return
        }

        // Check if user is a participant or host
        const isHost = meetingData.host_id === session.id
        const isParticipant = meetingData.participants.some((p: any) => p.user_id === session.id)
        const isAdmin = session.role === 'Administrator'

        if (!isHost && !isParticipant && !isAdmin) {
            setError('Vous n\'avez pas la permission de rejoindre cette réunion')
            setLoading(false)
            return
        }

        // Check scheduled time (Allow host and admin to join early)
        const now = new Date()
        const scheduledTime = new Date(meetingData.scheduled_at)
        // Give 5 mins buffer or if host/admin
        if (!isHost && !isAdmin && now < new Date(scheduledTime.getTime() - 5 * 60000)) {
            setError(`Cette réunion n'a pas encore commencé. Prévue à ${scheduledTime.toLocaleTimeString()}`)
            setLoading(false)
            return
        }

        setMeeting(meetingData)
        setLoading(false)
    }

    if (isAlreadyInThisCall) {
        return (
            <MeetingRoom
                meetingId={id}
                meeting={activeMeeting}
                currentUser={activeUser}
            />
        )
    }

    if (loading) {
        return (
            <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center gap-6">
                <div className="relative">
                    <div className="w-20 h-20 border-4 border-indigo-600/10 rounded-full" />
                    <div className="absolute inset-0 w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
                <div className="text-center">
                    <p className="text-white font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Initialisation du flux sécurisé</p>
                    <p className="text-gray-500 text-xs mt-2 font-medium">Préparation de votre espace de collaboration...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center p-6">
                <div className="bg-red-600/10 border border-red-600/20 p-8 rounded-[2.5rem] max-w-md w-full text-center space-y-6">
                    <div className="w-20 h-20 bg-red-600/20 rounded-full flex items-center justify-center mx-auto">
                        <ShieldAlert className="w-10 h-10 text-red-600" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-white mb-2">Accès refusé</h3>
                        <p className="text-gray-400 font-medium">{error}</p>
                    </div>
                    <Link
                        href="/meetings"
                        className="flex items-center justify-center gap-2 w-full py-4 bg-white text-gray-950 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-100 transition-all active:scale-[0.98]"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Retour au Hub
                    </Link>
                </div>
            </div>
        )
    }

    if (meeting?.status === 'ended' && meeting?.signed_url) {
        return (
            <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center p-6 lg:p-12 overflow-y-auto">
                <div className="w-full max-w-5xl space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 pb-12">
                    {/* Replay Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-2">
                            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">{meeting.title}</h1>
                            <div className="flex items-center gap-3">
                                <span className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-lg shadow-lg shadow-indigo-500/20">
                                    Replay Session
                                </span>
                                <p className="text-gray-400 font-bold text-xs">Cette réunion a été enregistrée le {format(new Date(meeting.scheduled_at), "d MMMM yyyy", { locale: fr })}</p>
                            </div>
                        </div>
                        <Link
                            href="/meetings"
                            className="flex items-center gap-3 px-8 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-white font-bold transition-all border border-white/10 active:scale-[0.98]"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            Retour au Hub
                        </Link>
                    </div>

                    {/* Video Player Section */}
                    <div className="aspect-video bg-black rounded-[2.5rem] border border-white/5 shadow-2xl shadow-indigo-500/10 overflow-hidden relative group ring-1 ring-white/10">
                        <video
                            src={meeting.signed_url}
                            controls
                            className="w-full h-full object-contain"
                            autoPlay={false}
                        />
                    </div>

                    {/* Meta Data Section */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-8 bg-white/5 rounded-[2rem] border border-white/5 backdrop-blur-sm space-y-4">
                            <div className="p-3 bg-indigo-500/10 rounded-xl w-fit">
                                <User className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Organisateur</p>
                                <p className="text-white font-black text-lg">{meeting.host?.full_name}</p>
                            </div>
                        </div>

                        <div className="p-8 bg-white/5 rounded-[2rem] border border-white/5 backdrop-blur-sm space-y-4">
                            <div className="p-3 bg-purple-500/10 rounded-xl w-fit">
                                <Clock className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Durée Prévue</p>
                                <p className="text-white font-black text-lg">{meeting.duration || 30} minutes</p>
                            </div>
                        </div>

                        <div className="p-8 bg-white/5 rounded-[2rem] border border-white/5 backdrop-blur-sm space-y-4">
                            <div className="p-3 bg-blue-500/10 rounded-xl w-fit">
                                <Calendar className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Date du meeting</p>
                                <p className="text-white font-black text-lg">{format(new Date(meeting.scheduled_at), "HH:mm", { locale: fr })} heure locale</p>
                            </div>
                        </div>
                    </div>

                    {/* Description if any */}
                    {meeting.description && (
                        <div className="p-8 bg-white/5 rounded-[2rem] border border-white/5 backdrop-blur-sm">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Notes de session</p>
                            <p className="text-gray-300 font-medium leading-relaxed">{meeting.description}</p>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <MeetingRoom
            meetingId={id}
            meeting={meeting}
            currentUser={currentUser}
        />
    )
}
