'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
    Mic, MicOff, Video, VideoOff, ScreenShare, StopCircle,
    MessageSquare, Users, Settings, PhoneOff,
    MoreVertical, Maximize2, Monitor, Loader2,
    Send, CheckCheck, Radio, LayoutGrid, Sidebar
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import VideoCard from './video-card'
import { createClient } from '@/lib/supabase/client'
import { saveMeetingRecording, updateMeetingStatus } from '@/app/(main)/chat/actions'
import EmployeeAvatar from '@/components/employee-avatar'
import { useRouter } from 'next/navigation'

interface MeetingRoomProps {
    meetingId: string
    meeting: any
    currentUser: { id: string; full_name: string; avatar_url: string | null }
}

export default function MeetingRoom({ meetingId, meeting, currentUser }: MeetingRoomProps) {
    const [isMuted, setIsMuted] = useState(false)
    const [isCameraOff, setIsCameraOff] = useState(false)
    const [isScreenSharing, setIsScreenSharing] = useState(false)
    const [sharingUser, setSharingUser] = useState<string | null>(null)
    const [isRecording, setIsRecording] = useState(false)
    const [showChat, setShowChat] = useState(false)
    const [showParticipants, setShowParticipants] = useState(true)
    const [messages, setMessages] = useState<any[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [participants, setParticipants] = useState<any[]>([])
    const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null)
    const [recordingTime, setRecordingTime] = useState(0)
    const [participantStates, setParticipantStates] = useState<Map<string, { isMuted: boolean; isCameraOff: boolean; isRecording: boolean }>>(new Map())

    const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())
    const [connectionStates, setConnectionStates] = useState<Map<string, RTCPeerConnectionState>>(new Map())
    const localStreamRef = useRef<MediaStream | null>(null)
    const screenStreamRef = useRef<MediaStream | null>(null)
    const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map())
    const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const recordingChunks = useRef<Blob[]>([])
    const supabase = createClient()
    const router = useRouter()
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const channelRef = useRef<any>(null)

    // Setup local media
    useEffect(() => {
        let cleanup: (() => void) | undefined

        const init = async () => {
            cleanup = await startLocalStream()
        }
        init()

        return () => {
            cleanup?.()
            stopLocalStream()
            cleanupPeerConnections()
        }
    }, [])

    const startLocalStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            })
            localStreamRef.current = stream
            // Attach to local video element if needed
            const localVideo = document.getElementById('local-video') as HTMLVideoElement
            if (localVideo) localVideo.srcObject = stream

            // Join signal channel and return cleanup
            return joinMeetingSignal()
        } catch (err) {
            console.error('Error accessing media devices:', err)
        }
    }

    const stopLocalStream = () => {
        localStreamRef.current?.getTracks().forEach(track => track.stop())
    }

    const cleanupPeerConnections = () => {
        peerConnections.current.forEach(pc => pc.close())
        peerConnections.current.clear()
    }

    const joinMeetingSignal = () => {
        const channel = supabase.channel(`meeting:${meetingId}`)
        channelRef.current = channel

        channel
            .on('broadcast', { event: 'signal' }, ({ payload }: { payload: any }) => {
                if (payload.to === currentUser.id || payload.to === 'everyone') {
                    handleSignal(payload)
                }
            })
            .on('broadcast', { event: 'chat' }, ({ payload }: { payload: any }) => {
                setMessages(prev => [...prev, payload])
            })
            .on('broadcast', { event: 'media-state' }, ({ payload }: { payload: { from: string; isMuted: boolean; isCameraOff: boolean } }) => {
                setParticipantStates(prev => {
                    const next = new Map(prev)
                    const current = next.get(payload.from) || { isMuted: false, isCameraOff: false, isRecording: false }
                    next.set(payload.from, { ...current, isMuted: payload.isMuted, isCameraOff: payload.isCameraOff })
                    return next
                })
            })
            .on('broadcast', { event: 'recording-state' }, ({ payload }: { payload: { from: string; isRecording: boolean } }) => {
                setIsRecording(payload.isRecording)
                setParticipantStates(prev => {
                    const next = new Map(prev)
                    const current = next.get(payload.from) || { isMuted: false, isCameraOff: false, isRecording: false }
                    next.set(payload.from, { ...current, isRecording: payload.isRecording })
                    return next
                })
            })
            .on('broadcast', { event: 'request-state' }, ({ payload }: { payload: { from: string } }) => {
                const { from } = payload

                // Check if we already have a connection for this user
                const existingPC = peerConnections.current.get(from)
                if (existingPC) {
                    const state = existingPC.connectionState
                    console.log(`[WebRTC] Received request-state from ${from}. Existing PC state: ${state}`)

                    // Only clean up if the connection is actually broken
                    // Do NOT clean up if it's new, connecting, or connected
                    if (state === 'failed' || state === 'disconnected' || state === 'closed') {
                        console.warn(`[WebRTC] Cleaning up broken connection (${state}) for ${from}`)
                        handleParticipantLeave(from)
                    } else {
                        console.log(`[WebRTC] Connection to ${from} is ${state}, keeping it`)
                    }
                }

                // Send current media state to the joining user
                sendSignal(from, {
                    type: 'media-state',
                    isMuted: isMuted,
                    isCameraOff: isCameraOff
                })

                if (isRecording) {
                    sendSignal(from, {
                        type: 'recording-state',
                        isRecording: true
                    })
                }

                // NOTE: Connection initiation is handled by presence sync ONLY
                // This prevents duplicate connection attempts and race conditions
            })
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState()

                // Deduplicate members by original user ID
                const memberMap = new Map()
                Object.values(state).flat().forEach((p: any) => {
                    if (p.user && p.user.id) {
                        memberMap.set(p.user.id, p.user)
                    }
                })

                const uniqueMembers = Array.from(memberMap.values())

                // CRITICAL FIX: Include current user in participants list
                // This ensures all users see the same participant list
                const allParticipants = [
                    ...uniqueMembers,
                    { id: currentUser.id, name: currentUser.full_name, avatar: currentUser.avatar_url }
                ]

                // Deduplicate in case current user is already in the list
                const participantMap = new Map()
                allParticipants.forEach(p => participantMap.set(p.id, p))
                const finalParticipants = Array.from(participantMap.values())

                const memberIds = new Set(uniqueMembers.map(m => m.id))

                console.log(`[WebRTC] Presence Sync: ${finalParticipants.length} total participants (${uniqueMembers.length} remote)`, Array.from(participantMap.keys()))
                setParticipants(finalParticipants)

                // Cleanup connections for people who left
                peerConnections.current.forEach((pc, id) => {
                    if (!memberIds.has(id)) {
                        console.log(`[WebRTC] Cleaning up connection to ${id} (left)`)
                        handleParticipantLeave(id)
                    }
                })

                // Identify members to connect to (ONLY mechanism for connection establishment)
                uniqueMembers.forEach(member => {
                    if (member.id !== currentUser.id && !peerConnections.current.has(member.id)) {
                        // Tie-breaker to decide who initiates (lexicographic comparison)
                        const shouldInitiate = currentUser.id < member.id
                        console.log(`[WebRTC] New peer ${member.id} detected. Me: ${currentUser.id}. Should initiate: ${shouldInitiate}`)

                        if (shouldInitiate) {
                            // Validate before initiating
                            if (!localStreamRef.current) {
                                console.warn(`[WebRTC] Cannot initiate to ${member.id}: local stream not ready`)
                                return
                            }
                            console.log(`[WebRTC] ✓ Initiating connection to ${member.id}`)
                            initiateConnection(member.id)
                        } else {
                            console.log(`[WebRTC] ⏳ Waiting for ${member.id} to initiate connection`)
                        }
                    }
                })
            })
            .on('presence', { event: 'leave' }, async ({ leftPresences }: { leftPresences: any[] }) => {
                leftPresences.forEach(presence => {
                    const userId = presence.user?.id
                    if (userId) handleParticipantLeave(userId)
                })

                // Get current presence state AFTER the leave event
                const currentState = channel.presenceState()
                const remainingUsers = Object.values(currentState).flat()

                console.log(`[WebRTC] After leave event: ${remainingUsers.length} users remaining`)

                // If no one left (including us), terminate meeting
                if (remainingUsers.length === 0) {
                    console.log('[WebRTC] No participants remaining, terminating meeting')
                    await updateMeetingStatus(meetingId, 'ended')
                }
            })
            .subscribe(async (status: string) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[WebRTC] Subscribed to signaling channel')
                    await channel.track({
                        user: {
                            id: currentUser.id,
                            name: currentUser.full_name,
                            avatar: currentUser.avatar_url
                        },
                        online_at: new Date().toISOString()
                    })

                    if (meeting.host_id === currentUser.id && (meeting.status === 'scheduled' || meeting.status === 'live')) {
                        await updateMeetingStatus(meetingId, 'live')
                    }

                    // Request current states from existing participants
                    setTimeout(() => {
                        sendSignal('everyone', { type: 'request-state' })
                    }, 1000)
                }
            })

        return () => {
            console.log('[WebRTC] Leaving signaling channel')
            supabase.removeChannel(channel)
        }
    }

    const handleParticipantLeave = async (userId: string) => {
        console.log(`[WebRTC] Cleaning up participant ${userId}`)

        const pc = peerConnections.current.get(userId)
        if (pc) {
            pc.close()
            peerConnections.current.delete(userId)
        }

        pendingCandidates.current.delete(userId)

        setRemoteStreams(prev => {
            const next = new Map(prev)
            if (next.has(userId)) {
                next.delete(userId)
                return next
            }
            return prev
        })

        setConnectionStates(prev => {
            const next = new Map(prev)
            if (next.has(userId)) {
                next.delete(userId)
                return next
            }
            return prev
        })

        setParticipants(prev => {
            const next = prev.filter(p => p.id !== userId)
            return next
        })

        if (sharingUser === userId) setSharingUser(null)

        // Auto-end meeting if no one is left
        const state = channelRef.current?.presenceState() || {}
        const totalMembers = Object.values(state).flat().length
        if (totalMembers === 0) {
            console.log('[Meeting] Meeting empty, ending...')
            await updateMeetingStatus(meetingId, 'ended')
        }
    }

    const createPeerConnection = (targetId: string) => {
        console.log(`[WebRTC] Creating PeerConnection for ${targetId}`)
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun.services.mozilla.com' }
            ]
        })

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                console.log(`[WebRTC] Sending ICE candidate to ${targetId}`)
                sendSignal(targetId, { type: 'candidate', candidate: event.candidate })
            }
        }

        pc.ontrack = (event) => {
            console.log(`[WebRTC] Received remote track from ${targetId}:`, event.track.kind)
            setRemoteStreams(prev => {
                const next = new Map(prev)
                let stream = next.get(targetId)

                if (!stream) {
                    stream = new MediaStream()
                    next.set(targetId, stream)
                }

                // Add the track to the existing or new stream if not already present
                if (!stream.getTracks().find(t => t.id === event.track.id)) {
                    stream.addTrack(event.track)
                }

                return next
            })
        }

        pc.onconnectionstatechange = () => {
            console.log(`[WebRTC] Connection state with ${targetId}: ${pc.connectionState}`)
            setConnectionStates(prev => {
                const next = new Map(prev)
                next.set(targetId, pc.connectionState)
                return next
            })
        }

        if (localStreamRef.current) {
            console.log(`[WebRTC] Adding local tracks to PC for ${targetId}`)
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current!)
            })
        } else {
            console.warn(`[WebRTC] No local stream to add to PC for ${targetId} at creation time`)
        }

        peerConnections.current.set(targetId, pc)
        return pc
    }

    const initiateConnection = async (targetId: string) => {
        if (!localStreamRef.current) {
            console.warn(`[WebRTC] Delaying connection to ${targetId}: localStream not ready`)
            setTimeout(() => initiateConnection(targetId), 1000)
            return
        }

        const pc = createPeerConnection(targetId)
        try {
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            console.log(`[WebRTC] Sending offer to ${targetId}`)
            sendSignal(targetId, { type: 'offer', sdp: offer })
        } catch (err) {
            console.error(`[WebRTC] Error initiating connection to ${targetId}:`, err)
        }
    }

    const sendSignal = async (to: string, data: any) => {
        if (!channelRef.current) return

        const isSpecialEvent = ['media-state', 'recording-state', 'request-state'].includes(data.type)

        const response = await channelRef.current.send({
            type: 'broadcast',
            event: isSpecialEvent ? data.type : 'signal',
            payload: { to, from: currentUser.id, ...data }
        })

        if (response !== 'ok') {
            console.warn(`[WebRTC] ${data.type} failed to send to ${to}: ${response}`)
        }
    }

    const handleSignal = async (payload: any) => {
        const { from, type, sdp, candidate } = payload
        console.log(`[WebRTC] Received ${type} from ${from}`)

        if (type === 'leave') {
            handleParticipantLeave(from)
            return
        }

        if (type === 'screen-share-start') {
            setSharingUser(from)
            return
        }

        if (type === 'screen-share-stop') {
            setSharingUser(null)
            return
        }

        let pc = peerConnections.current.get(from)

        if (type === 'offer') {
            if (!localStreamRef.current) {
                console.warn(`[WebRTC] Delaying offer response from ${from}: localStream not ready`)
                setTimeout(() => handleSignal(payload), 1000)
                return
            }

            if (!pc) {
                pc = createPeerConnection(from)
            } else {
                // Check if we're already in a stable state with remote description set
                // This prevents duplicate offer processing
                if (pc.signalingState === 'stable' && pc.remoteDescription) {
                    console.warn(`[WebRTC] Ignoring duplicate offer from ${from} (already in stable state)`)
                    return
                }
            }

            try {
                await pc.setRemoteDescription(new RTCSessionDescription(sdp))
                const answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)
                sendSignal(from, { type: 'answer', sdp: answer })

                // Process buffered candidates
                const buffered = pendingCandidates.current.get(from) || []
                console.log(`[WebRTC] Processing ${buffered.length} buffered candidates for ${from}`)
                for (const cand of buffered) {
                    await pc.addIceCandidate(new RTCIceCandidate(cand))
                }
                pendingCandidates.current.delete(from)
            } catch (err) {
                console.error(`[WebRTC] Error handling offer from ${from}:`, err)
            }
        } else if (type === 'answer') {
            if (pc) {
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(sdp))

                    // Process buffered candidates for the initiator side
                    const buffered = pendingCandidates.current.get(from) || []
                    if (buffered.length > 0) {
                        console.log(`[WebRTC] Processing ${buffered.length} buffered candidates for ${from} after answer`)
                        for (const cand of buffered) {
                            await pc.addIceCandidate(new RTCIceCandidate(cand))
                        }
                        pendingCandidates.current.delete(from)
                    }
                } catch (err) {
                    console.error(`[WebRTC] Error handling answer from ${from}:`, err)
                }
            }
        } else if (type === 'candidate') {
            if (pc && pc.remoteDescription) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate))
                } catch (err) {
                    console.error(`[WebRTC] Error adding ICE candidate from ${from}:`, err)
                }
            } else {
                console.log(`[WebRTC] Buffering candidate from ${from}`)
                const current = pendingCandidates.current.get(from) || []
                pendingCandidates.current.set(from, [...current, candidate])
            }
        }
    }

    const toggleScreenShare = async () => {
        if (!isScreenSharing) {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true
                })

                screenStreamRef.current = stream
                const screenTrack = stream.getVideoTracks()[0]

                // Track ending handler (e.g., user clicks "Stop Sharing" in browser bar)
                screenTrack.onended = () => {
                    stopScreenSharing()
                }

                // Replace track on all peer connections
                peerConnections.current.forEach(pc => {
                    const sender = pc.getSenders().find(s => s.track?.kind === 'video')
                    if (sender) {
                        sender.replaceTrack(screenTrack)
                    }
                })

                // Update local UI
                const localVideo = document.getElementById('local-video') as HTMLVideoElement
                if (localVideo) localVideo.srcObject = stream

                setIsScreenSharing(true)
                sendSignal('everyone', { type: 'screen-share-start' })
            } catch (err) {
                console.error('Error sharing screen:', err)
            }
        } else {
            stopScreenSharing()
        }
    }

    const stopScreenSharing = async () => {
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => track.stop())
            screenStreamRef.current = null
        }

        const videoTrack = localStreamRef.current?.getVideoTracks()[0]
        if (videoTrack) {
            // Replace back to camera track
            peerConnections.current.forEach(pc => {
                const sender = pc.getSenders().find(s => s.track?.kind === 'video')
                if (sender) {
                    sender.replaceTrack(videoTrack)
                }
            })

            // Re-attach camera to local video
            const localVideo = document.getElementById('local-video') as HTMLVideoElement
            if (localVideo) localVideo.srcObject = localStreamRef.current
        }

        setIsScreenSharing(false)
        sendSignal('everyone', { type: 'screen-share-stop' })
    }

    const toggleMute = () => {
        if (localStreamRef.current) {
            const nextMuted = !isMuted
            localStreamRef.current.getAudioTracks().forEach(track => {
                track.enabled = !nextMuted
            })
            setIsMuted(nextMuted)
            sendSignal('everyone', { type: 'media-state', isMuted: nextMuted, isCameraOff })
        }
    }

    const toggleCamera = () => {
        if (localStreamRef.current) {
            const nextCameraOff = !isCameraOff
            localStreamRef.current.getVideoTracks().forEach(track => {
                track.enabled = !nextCameraOff
            })
            setIsCameraOff(nextCameraOff)
            sendSignal('everyone', { type: 'media-state', isMuted, isCameraOff: nextCameraOff })
        }
    }

    const startRecording = () => {
        if (!localStreamRef.current) return

        recordingChunks.current = []
        const options = { mimeType: 'video/webm;codecs=vp9,opus' }
        const recorder = new MediaRecorder(localStreamRef.current, options)

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordingChunks.current.push(e.data)
        }

        recorder.onstop = async () => {
            const blob = new Blob(recordingChunks.current, { type: 'video/webm' })
            const formData = new FormData()
            formData.append('meetingId', meetingId)
            formData.append('file', blob, 'recording.webm')
            await saveMeetingRecording(formData)
        }

        recorder.start()
        mediaRecorderRef.current = recorder
        setIsRecording(true)
        sendSignal('everyone', { type: 'recording-state', isRecording: true })

        setRecordingTime(0)
        timerRef.current = setInterval(() => {
            setRecordingTime(prev => prev + 1)
        }, 1000)
    }

    const stopRecording = () => {
        mediaRecorderRef.current?.stop()
        setIsRecording(false)
        sendSignal('everyone', { type: 'recording-state', isRecording: false })
        if (timerRef.current) clearInterval(timerRef.current)
    }

    const sendMessage = () => {
        if (!newMessage.trim()) return

        const msg = {
            id: Date.now().toString(),
            sender_id: currentUser.id,
            sender_name: currentUser.full_name,
            content: newMessage,
            created_at: new Date().toISOString()
        }

        supabase.channel(`meeting:${meetingId}`).send({
            type: 'broadcast',
            event: 'chat',
            payload: msg
        })

        setMessages(prev => [...prev, msg])
        setNewMessage('')
    }

    const leaveMeeting = async () => {
        if (isRecording) stopRecording()

        // Untrack presence FIRST to ensure proper cleanup
        if (channelRef.current) {
            await channelRef.current.untrack()
            console.log('[WebRTC] Untracked presence')
        }

        // Small delay to let presence propagate
        await new Promise(resolve => setTimeout(resolve, 100))

        // Broadcast leave signal for immediate cleanup
        sendSignal('everyone', { type: 'leave' })

        stopLocalStream()
        cleanupPeerConnections()

        // NOTE: Meeting termination is handled by presence leave handler
        // Meeting only ends when the last participant leaves

        router.push('/meetings')
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    return (
        <div className="fixed inset-0 bg-gray-950 flex flex-col overflow-hidden text-white font-sans">
            {/* Top Header */}
            <div className="h-16 px-6 flex items-center justify-between border-b border-white/5 bg-gray-950/50 backdrop-blur-md z-50">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                            <Video className="w-5 h-5" />
                        </div>
                        <h2 className="font-bold text-sm tracking-tight uppercase truncate max-w-[200px]">{meeting.title}</h2>
                    </div>
                    {isRecording && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Rec {formatTime(recordingTime)}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center -space-x-2 mr-4">
                        {participants.slice(0, 3).map((p, idx) => (
                            <EmployeeAvatar
                                key={idx}
                                avatarUrl={p.avatar}
                                fullName={p.name}
                                className="w-8 h-8 border-2 border-gray-950 shadow-xl"
                            />
                        ))}
                        {participants.length > 3 && (
                            <div className="w-8 h-8 rounded-full bg-gray-800 border-2 border-gray-950 flex items-center justify-center text-[10px] font-bold">
                                +{participants.length - 3}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => setShowParticipants(!showParticipants)}
                        className={`p-2.5 rounded-xl transition-all ${showParticipants ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Users className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setShowChat(!showChat)}
                        className={`p-2.5 rounded-xl transition-all ${showChat ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        <MessageSquare className="w-5 h-5" />
                    </button>
                    <button className="p-2.5 rounded-xl text-gray-400 hover:text-white transition-all">
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden relative">
                <div className="flex-1 flex flex-col relative overflow-hidden">
                    {/* Layout Container */}
                    <div className="flex-1 p-4 md:p-6 flex items-center justify-center overflow-y-auto custom-scrollbar">
                        <AnimatePresence mode="popLayout">
                            {sharingUser || isScreenSharing ? (
                                /* PRESENTATION MODE */
                                <motion.div
                                    key="presentation-layout"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="w-full h-full flex flex-col md:flex-row gap-4 max-w-[1600px] mx-auto"
                                >
                                    {/* Main Stage (Screen Share) */}
                                    <div className="flex-1 min-h-[50vh] md:h-full relative flex flex-col">
                                        {(() => {
                                            const presenterId = isScreenSharing ? currentUser.id : sharingUser!
                                            const isLocalPresenter = presenterId === currentUser.id
                                            const presenter = isLocalPresenter ? currentUser : participants.find(p => p.id === presenterId) || { id: presenterId, name: 'Unknown', avatar: null }

                                            // Determine stream for presenter
                                            let presentationStream = null
                                            if (isLocalPresenter) {
                                                presentationStream = screenStreamRef.current
                                            } else {
                                                presentationStream = remoteStreams.get(presenterId) || null
                                            }

                                            const state = participantStates.get(presenterId) || { isMuted: false, isCameraOff: false }

                                            return (
                                                <VideoCard
                                                    key={presenterId}
                                                    participant={{ ...presenter, id: presenterId, name: isLocalPresenter ? currentUser.full_name : (presenter as any).name, avatar: isLocalPresenter ? currentUser.avatar_url : (presenter as any).avatar }}
                                                    stream={presentationStream}
                                                    isLocal={isLocalPresenter}
                                                    isMuted={isLocalPresenter ? isMuted : state.isMuted}
                                                    isCameraOff={false} // Always show screen share
                                                    isSharing={true}
                                                    isHost={meeting.host_id === presenterId}
                                                    connectionState={connectionStates.get(presenterId)}
                                                    isMainStage={true}
                                                    className="w-full h-full"
                                                />
                                            )
                                        })()}
                                    </div>

                                    {/* Sidebar (Other Participants) */}
                                    <div className="h-32 md:h-full md:w-80 flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto md:overflow-x-hidden custom-scrollbar pb-2 md:pb-0 shrink-0">
                                        {participants
                                            .filter(p => !((isScreenSharing && p.id === currentUser.id) || (sharingUser && p.id === sharingUser))) // Exclude presenter
                                            .map((p) => {
                                                const isLocal = p.id === currentUser.id
                                                const stream = isLocal ? localStreamRef.current : (remoteStreams.get(p.id) || null)
                                                const state = isLocal ? { isMuted, isCameraOff } : (participantStates.get(p.id) || { isMuted: false, isCameraOff: false })

                                                return (
                                                    <VideoCard
                                                        key={p.id}
                                                        participant={p.id === currentUser.id ? { ...currentUser, name: currentUser.full_name, avatar: currentUser.avatar_url } : p}
                                                        stream={stream}
                                                        isLocal={isLocal}
                                                        isMuted={state.isMuted}
                                                        isCameraOff={state.isCameraOff}
                                                        isSharing={false}
                                                        isHost={meeting.host_id === p.id}
                                                        connectionState={connectionStates.get(p.id)}
                                                        className="aspect-video w-48 md:w-full shrink-0"
                                                    />
                                                )
                                            })}
                                        {/* If I am NOT presenting, show ME in sidebar */}
                                        {/* The filter above handles this. If I'm screen sharing, I'm excluded. If sharingUser is someone else, I am NOT excluded, so I appear in sidebar. Correct. */}
                                    </div>
                                </motion.div>
                            ) : (
                                /* GRID MODE (Default) */
                                <motion.div
                                    key="grid-layout"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className={`w-full max-w-7xl mx-auto grid gap-4 md:gap-6 items-center justify-center transition-all duration-500 ${participants.length === 1 ? 'grid-cols-1 max-w-4xl' :
                                        participants.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-6xl' :
                                            participants.length === 3 ? 'grid-cols-1 md:grid-cols-2 max-w-6xl' :
                                                participants.length === 4 ? 'grid-cols-1 md:grid-cols-2 max-w-6xl' :
                                                    'grid-cols-2 md:grid-cols-3'
                                        }`}
                                >
                                    {participants.map((p, idx) => {
                                        const isLocal = p.id === currentUser.id
                                        const stream = isLocal ? localStreamRef.current : (remoteStreams.get(p.id) || null)
                                        const state = isLocal ? { isMuted, isCameraOff } : (participantStates.get(p.id) || { isMuted: false, isCameraOff: false })

                                        return (
                                            <VideoCard
                                                key={p.id}
                                                participant={p.id === currentUser.id ? { ...currentUser, name: currentUser.full_name, avatar: currentUser.avatar_url } : p}
                                                stream={stream}
                                                isLocal={isLocal}
                                                isMuted={state.isMuted}
                                                isCameraOff={state.isCameraOff}
                                                isSharing={false}
                                                isHost={meeting.host_id === p.id}
                                                connectionState={connectionStates.get(p.id)}
                                                className={`w-full aspect-video ${participants.length === 3 && idx === 2 ? 'md:col-span-1' : ''}`}
                                            />
                                        )
                                    })}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Right Sidebar (Chat/Participants) */}
                {(showChat || showParticipants) && (
                    <div className="w-80 bg-gray-950/80 border-l border-white/5 flex flex-col z-20 absolute md:static inset-y-0 right-0 h-full backdrop-blur-xl md:backdrop-blur-none shadow-2xl md:shadow-none animate-in slide-in-from-right duration-300">
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="p-6 border-b border-white/5 bg-white/2">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">
                                        Participants
                                    </h3>
                                    <span className="bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-2.5 py-0.5 rounded-full text-[9px] font-black font-mono">
                                        {participants.length.toString().padStart(2, '0')}
                                    </span>
                                </div>

                                <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar max-h-[calc(100vh-250px)]">
                                    {participants.map((p, idx) => {
                                        const state = participantStates.get(p.id) || { isMuted: p.id === currentUser.id ? isMuted : false, isCameraOff: p.id === currentUser.id ? isCameraOff : false }
                                        const isHost = p.id === meeting.host_id

                                        return (
                                            <div key={idx} className="group flex items-center gap-4 p-2 rounded-2xl hover:bg-white/5 transition-all duration-300">
                                                <div className="relative">
                                                    <EmployeeAvatar
                                                        avatarUrl={p.avatar}
                                                        fullName={p.name}
                                                        className={`w-11 h-11 border-2 transition-transform group-hover:scale-105 duration-300 ${isHost ? 'border-amber-500/50 shadow-lg shadow-amber-900/10' : 'border-white/5'}`}
                                                    />
                                                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-gray-950 rounded-full ${remoteStreams.has(p.id) || p.id === currentUser.id ? 'bg-green-500' : 'bg-gray-700'}`} />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-[11px] font-black uppercase tracking-tight text-white truncate group-hover:text-indigo-400 transition-colors">
                                                            {p.id === currentUser.id ? 'Vous' : p.name}
                                                        </p>
                                                        {isHost && (
                                                            <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-[7px] font-black text-amber-500 uppercase tracking-widest">
                                                                Host
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[8px] font-bold text-gray-600 uppercase tracking-widest mt-0.5">
                                                        {p.role || 'Membre'}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-1.5 h-8">
                                                    <div className={`p-1.5 rounded-lg transition-colors ${state.isMuted ? 'bg-red-500/10 text-red-500' : 'bg-gray-800/50 text-gray-600'}`}>
                                                        {state.isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                                                    </div>
                                                    <div className={`p-1.5 rounded-lg transition-colors ${state.isCameraOff ? 'bg-red-500/10 text-red-500' : 'bg-gray-800/50 text-gray-600'}`}>
                                                        {state.isCameraOff ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {showChat && (
                            <div className="flex-1 flex flex-col overflow-hidden border-t border-white/5">
                                <div className="p-4 bg-white/2">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-4">Chat en direct</h3>
                                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 max-h-[400px]">
                                        {messages.map((msg, idx) => (
                                            <div key={idx} className={`flex flex-col ${msg.sender_id === currentUser.id ? 'items-end' : 'items-start'}`}>
                                                <div className={`max-w-[80%] p-3 rounded-2xl text-xs font-medium ${msg.sender_id === currentUser.id
                                                    ? 'bg-indigo-600 shadow-lg shadow-indigo-900/20'
                                                    : 'bg-white/10'
                                                    }`}>
                                                    {msg.content}
                                                </div>
                                                <p className="text-[8px] font-bold text-gray-500 mt-1 uppercase tracking-widest">{msg.sender_name}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="p-4 mt-auto">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                                            placeholder="Tapez un message..."
                                            className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 px-4 pr-12 text-xs focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-gray-600 uppercase font-medium"
                                        />
                                        <button
                                            onClick={sendMessage}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-indigo-500 hover:text-white transition-colors"
                                        >
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Controls Bar */}
            <div className="h-24 px-8 flex items-center justify-center gap-6 bg-gray-950/80 backdrop-blur-xl border-t border-white/5 z-50">
                <div className="flex items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/5 shadow-2xl">
                    <button
                        onClick={toggleMute}
                        className={`p-4 rounded-xl transition-all ${isMuted ? 'bg-red-500 text-white shadow-lg shadow-red-900/20' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                    >
                        {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                    </button>
                    <button
                        onClick={toggleCamera}
                        className={`p-4 rounded-xl transition-all ${isCameraOff ? 'bg-red-500 text-white shadow-lg shadow-red-900/20' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                    >
                        {isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                    </button>
                </div>

                <div className="flex items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/5 shadow-2xl">
                    <button
                        onClick={toggleScreenShare}
                        className={`p-4 rounded-xl transition-all ${isScreenSharing ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                    >
                        <ScreenShare className="w-6 h-6" />
                    </button>
                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`p-4 rounded-xl transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                    >
                        {isRecording ? <StopCircle className="w-6 h-6" /> : <Radio className="w-6 h-6" />}
                    </button>
                </div>

                <button
                    onClick={leaveMeeting}
                    className="flex items-center gap-3 bg-red-600 hover:bg-red-700 text-white px-8 py-5 rounded-2xl font-black shadow-2xl shadow-red-900/40 transition-all active:scale-[0.98]"
                >
                    <PhoneOff className="w-6 h-6" />
                    <span className="hidden md:inline uppercase tracking-[0.2em] text-[10px]">Quitter</span>
                </button>
            </div>
        </div>
    )
}
