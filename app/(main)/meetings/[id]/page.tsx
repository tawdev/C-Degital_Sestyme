'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import MeetingRoom from '@/components/meetings/meeting-room'
import { getMeetingDetails } from '@/app/(main)/chat/actions'
import { getSession } from '@/app/auth/actions'
import { Loader2, ShieldAlert, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function MeetingPage() {
    const params = useParams()
    const id = params.id as string
    const [meeting, setMeeting] = useState<any>(null)
    const [currentUser, setCurrentUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    useEffect(() => {
        if (id) {
            loadData()
        }
    }, [id])

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
        if (meetingData.status === 'ended') {
            setError('Cette réunion est terminée')
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

    return (
        <MeetingRoom
            meetingId={id}
            meeting={meeting}
            currentUser={currentUser}
        />
    )
}
