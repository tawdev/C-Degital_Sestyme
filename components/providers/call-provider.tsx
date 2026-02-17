'use client'

import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { saveMeetingRecording, updateMeetingStatus } from '@/app/(main)/chat/actions'
import { useRouter, usePathname } from 'next/navigation'

interface Participant {
    id: string
    name: string
    avatar: string | null
    role?: string
}

interface ParticipantState {
    isMuted: boolean
    isCameraOff: boolean
    isRecording: boolean
}

interface CallContextType {
    meetingId: string | null
    meeting: any
    currentUser: any
    participants: Participant[]
    activeSpeaker: string | null
    isMuted: boolean
    isCameraOff: boolean
    isScreenSharing: boolean
    isRecording: boolean
    recordingTime: number
    showChat: boolean
    messages: any[]
    remoteStreams: Map<string, MediaStream>
    connectionStates: Map<string, RTCPeerConnectionState>
    participantStates: Map<string, ParticipantState>
    localStream: MediaStream | null
    screenStream: MediaStream | null
    sharingUser: string | null

    joinMeeting: (meetingId: string, meeting: any, user: any) => Promise<void>
    leaveMeeting: (shouldEndMeeting?: boolean) => Promise<void>
    toggleMute: () => void
    toggleCamera: () => void
    toggleScreenShare: () => Promise<void>
    startRecording: () => void
    stopRecording: () => void
    sendMessage: (content: string) => void
    setShowChat: (show: boolean) => void
    endCall: () => Promise<void>
    isInCall: boolean
}

const CallContext = createContext<CallContextType | null>(null)

export function useCall() {
    const context = useContext(CallContext)
    if (!context) {
        throw new Error('useCall must be used within a CallProvider')
    }
    return context
}

export function CallProvider({ children }: { children: React.ReactNode }) {
    const [meetingId, setMeetingId] = useState<string | null>(null)
    const [meeting, setMeeting] = useState<any>(null)
    const [currentUser, setCurrentUser] = useState<any>(null)
    const [isInCall, setIsInCall] = useState(false)

    const [isMuted, setIsMuted] = useState(false)
    const [isCameraOff, setIsCameraOff] = useState(false)
    const [isScreenSharing, setIsScreenSharing] = useState(false)
    const [sharingUser, setSharingUser] = useState<string | null>(null)
    const [isRecording, setIsRecording] = useState(false)
    const [showChat, setShowChat] = useState(false)
    const [messages, setMessages] = useState<any[]>([])
    const [participants, setParticipants] = useState<Participant[]>([])
    const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null)
    const [recordingTime, setRecordingTime] = useState(0)
    const [participantStates, setParticipantStates] = useState<Map<string, ParticipantState>>(new Map())

    const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())
    const [connectionStates, setConnectionStates] = useState<Map<string, RTCPeerConnectionState>>(new Map())

    const [localStream, setLocalStream] = useState<MediaStream | null>(null)
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null)

    const localStreamRef = useRef<MediaStream | null>(null)
    const screenStreamRef = useRef<MediaStream | null>(null)

    const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map())
    const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const recordingChunks = useRef<Blob[]>([])
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const channelRef = useRef<any>(null)

    const supabase = createClient()
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        // Cleanup on unmount (only if provider unmounts, e.g. hard refresh)
        return () => {
            if (isInCall) {
                leaveMeeting()
            }
        }
    }, [])

    const startLocalStream = async () => {
        try {
            if (localStreamRef.current) return localStreamRef.current

            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            })
            localStreamRef.current = stream
            setLocalStream(stream)
            return stream
        } catch (err) {
            console.error('Error accessing media devices:', err)
            throw err
        }
    }

    const stopLocalStream = () => {
        localStreamRef.current?.getTracks().forEach(track => track.stop())
        localStreamRef.current = null
        setLocalStream(null)

        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => track.stop())
            screenStreamRef.current = null
            setScreenStream(null)
        }
    }

    const cleanupPeerConnections = () => {
        peerConnections.current.forEach(pc => pc.close())
        peerConnections.current.clear()

        // Clear all pending timeouts
        leaveTimeouts.current.forEach(timeout => clearTimeout(timeout))
        leaveTimeouts.current.clear()

        setConnectionStates(new Map())
        setRemoteStreams(new Map())
        setParticipants([])
    }

    // Track leave timestamps to handle jitter
    const leaveTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map())
    const GRACE_PERIOD = 2000 // 2 seconds leeway for navigation jitter

    const handleParticipantPresenceLeave = (userId: string) => {
        console.log(`[Presence] Participant ${userId} left. Starting ${GRACE_PERIOD}ms grace period.`)

        // Clear any existing timeout for this user
        if (leaveTimeouts.current.has(userId)) {
            clearTimeout(leaveTimeouts.current.get(userId))
        }

        const timeout = setTimeout(() => {
            // Check if user re-appeared in presence before cleaning up
            const currentState = channelRef.current?.presenceState() || {}
            const isBack = Object.values(currentState).flat().some((p: any) => p.user?.id === userId)

            if (!isBack) {
                console.log(`[Presence] Grace period expired for ${userId}. Cleaning up.`)
                handleParticipantLeave(userId)
            } else {
                console.log(`[Presence] ${userId} re-appeared during grace period. Cleanup cancelled.`)
            }
            leaveTimeouts.current.delete(userId)
        }, GRACE_PERIOD)

        leaveTimeouts.current.set(userId, timeout)
    }

    const joinMeeting = async (mid: string, mData: any, user: any) => {
        if (isInCall && meetingId === mid) {
            console.log('Already in this call, maintaining state')
            return
        }

        if (isInCall && meetingId !== mid) {
            await leaveMeeting()
        }

        setMeetingId(mid)
        setMeeting(mData)
        setCurrentUser(user)
        setIsInCall(true)

        // Reset states for NEW calls only
        if (meetingId !== mid) {
            setMessages([])
            setIsMuted(false)
            setIsCameraOff(false)
            setIsScreenSharing(false)
            setSharingUser(null)
        }

        await startLocalStream()

        // Join signal channel
        const channel = supabase.channel(`meeting:${mid}`)
        channelRef.current = channel

        channel
            .on('broadcast', { event: 'signal' }, ({ payload }: { payload: any }) => {
                if (payload.to === user.id || payload.to === 'everyone') {
                    handleSignal(payload, user.id)
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

                // If they are asking for state, it means they might have re-joined. 
                // Clear any pending leave timeout for them.
                if (leaveTimeouts.current.has(from)) {
                    clearTimeout(leaveTimeouts.current.get(from))
                    leaveTimeouts.current.delete(from)
                }

                sendSignal(from, {
                    type: 'media-state',
                    isMuted: isMutedRef.current,
                    isCameraOff: isCameraOffRef.current
                }, user.id)
            })
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState()
                const memberMap = new Map()
                Object.values(state).flat().forEach((p: any) => {
                    if (p.user && p.user.id) {
                        memberMap.set(p.user.id, p.user)
                    }
                })

                const uniqueMembers = Array.from(memberMap.values())
                const allParticipants = [
                    ...uniqueMembers,
                    { id: user.id, name: user.full_name, avatar: user.avatar_url }
                ]

                const participantMap = new Map()
                allParticipants.forEach(p => participantMap.set(p.id, p))
                const finalParticipants = Array.from(participantMap.values()) as Participant[]
                const memberIds = new Set(uniqueMembers.map((m: any) => m.id))

                setParticipants(finalParticipants)

                // Only cleanup if NOT in grace period
                peerConnections.current.forEach((pc, id) => {
                    if (!memberIds.has(id)) {
                        handleParticipantPresenceLeave(id)
                    }
                })

                uniqueMembers.forEach((member: any) => {
                    if (member.id !== user.id && !peerConnections.current.has(member.id)) {
                        const shouldInitiate = user.id < member.id
                        if (shouldInitiate) {
                            initiateConnection(member.id, user.id)
                        }
                    }
                })
            })
            .on('presence', { event: 'leave' }, async ({ leftPresences }: { leftPresences: any[] }) => {
                leftPresences.forEach((presence: any) => {
                    const userId = presence.user?.id
                    if (userId) handleParticipantPresenceLeave(userId)
                })

                const currentState = channel.presenceState()
                const remainingUsers = Object.values(currentState).flat()
                if (remainingUsers.length === 0) {
                    updateMeetingStatus(mid, 'ended')
                }
            })
            .subscribe(async (status: string) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        user: {
                            id: user.id,
                            name: user.full_name,
                            avatar: user.avatar_url
                        },
                        online_at: new Date().toISOString()
                    })

                    if (mData.host_id === user.id && (mData.status === 'scheduled' || mData.status === 'live')) {
                        updateMeetingStatus(mid, 'live')
                    }

                    // Ensure we have a stream before asking others to connect
                    if (!localStreamRef.current) {
                        try {
                            await startLocalStream()
                        } catch (err) {
                            console.error('Failed to start local stream in subscription:', err)
                        }
                    }

                    setTimeout(() => {
                        console.log('[WebRTC] Requesting state from everyone')
                        sendSignal('everyone', { type: 'request-state' }, user.id)
                    }, 500) // Reduced delay
                }
            })
    }

    // Refs for state that is accessed in callbacks
    const isMutedRef = useRef(isMuted)
    const isCameraOffRef = useRef(isCameraOff)
    const isRecordingRef = useRef(isRecording)

    useEffect(() => { isMutedRef.current = isMuted }, [isMuted])
    useEffect(() => { isCameraOffRef.current = isCameraOff }, [isCameraOff])
    useEffect(() => { isRecordingRef.current = isRecording }, [isRecording])

    const sendSignal = async (to: string, data: any, fromId: string) => {
        if (!channelRef.current) return

        // Inject current media state if sending media-state
        if (data.type === 'media-state') {
            data.isMuted = isMutedRef.current
            data.isCameraOff = isCameraOffRef.current
        }

        const isSpecialEvent = ['media-state', 'recording-state', 'request-state'].includes(data.type)

        await channelRef.current.send({
            type: 'broadcast',
            event: isSpecialEvent ? data.type : 'signal',
            payload: { to, from: fromId, ...data }
        })
    }

    const createPeerConnection = (targetId: string, currentUserId: string) => {
        console.log(`[WebRTC] Creating PC for ${targetId}`)
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun.services.mozilla.com' }
            ]
        })

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignal(targetId, { type: 'candidate', candidate: event.candidate }, currentUserId)
            }
        }

        pc.ontrack = (event) => {
            console.log(`[WebRTC] ontrack from ${targetId}:`, event.streams)
            if (event.streams && event.streams[0]) {
                const stream = event.streams[0]
                setRemoteStreams(prev => {
                    const next = new Map(prev)
                    if (next.get(targetId) !== stream) {
                        next.set(targetId, stream)
                        return next
                    }
                    return prev
                })
            }
        }

        pc.oniceconnectionstatechange = () => {
            console.log(`[WebRTC] ICE state for ${targetId}: ${pc.iceConnectionState}`)
            setConnectionStates(prev => {
                const next = new Map(prev)
                next.set(targetId, pc.iceConnectionState as any)
                return next
            })
        }

        pc.onconnectionstatechange = () => {
            console.log(`[WebRTC] Connection state for ${targetId}: ${pc.connectionState}`)
            setConnectionStates(prev => {
                const next = new Map(prev)
                next.set(targetId, pc.connectionState)
                return next
            })
        }

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                console.log(`[WebRTC] Adding local track ${track.kind} to PC for ${targetId}`)
                pc.addTrack(track, localStreamRef.current!)
            })
        }

        peerConnections.current.set(targetId, pc)
        return pc
    }

    const initiateConnection = async (targetId: string, currentUserId: string) => {
        // Wait for local stream
        if (!localStreamRef.current) {
            setTimeout(() => initiateConnection(targetId, currentUserId), 1000)
            return
        }

        const pc = createPeerConnection(targetId, currentUserId)
        try {
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            sendSignal(targetId, { type: 'offer', sdp: offer }, currentUserId)
        } catch (err) {
            console.error(`Error initiating connection to ${targetId}:`, err)
        }
    }

    const handleSignal = async (payload: any, currentUserId: string) => {
        const { from, type, sdp, candidate } = payload
        console.log(`[WebRTC] Received signal ${type} from ${from}`)

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
                console.log(`[WebRTC] Deferring offer from ${from} (local stream not ready)`)
                setTimeout(() => handleSignal(payload, currentUserId), 1000)
                return
            }
            if (!pc) pc = createPeerConnection(from, currentUserId)
            else if (pc.signalingState === 'stable' && pc.remoteDescription) {
                console.log(`[WebRTC] Ignoring redundant offer from ${from}`)
                return
            }

            try {
                console.log(`[WebRTC] Setting remote description (offer) from ${from}`)
                await pc.setRemoteDescription(new RTCSessionDescription(sdp))
                const answer = await pc.createAnswer()
                console.log(`[WebRTC] Creating and sending answer to ${from}`)
                await pc.setLocalDescription(answer)
                sendSignal(from, { type: 'answer', sdp: answer }, currentUserId)

                const buffered = pendingCandidates.current.get(from) || []
                console.log(`[WebRTC] Processing ${buffered.length} buffered candidates for ${from}`)
                for (const cand of buffered) await pc.addIceCandidate(new RTCIceCandidate(cand))
                pendingCandidates.current.delete(from)
            } catch (err) {
                console.error(`[WebRTC] Error handling offer from ${from}:`, err)
            }
        } else if (type === 'answer') {
            if (pc) {
                try {
                    console.log(`[WebRTC] Setting remote description (answer) from ${from}`)
                    await pc.setRemoteDescription(new RTCSessionDescription(sdp))
                    const buffered = pendingCandidates.current.get(from) || []
                    console.log(`[WebRTC] Processing ${buffered.length} buffered candidates for ${from}`)
                    for (const cand of buffered) await pc.addIceCandidate(new RTCIceCandidate(cand))
                    pendingCandidates.current.delete(from)
                } catch (err) { console.error(`[WebRTC] Error handling answer from ${from}:`, err) }
            }
        } else if (type === 'candidate') {
            if (!candidate) return
            if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                try {
                    console.log(`[WebRTC] Adding ICE candidate from ${from}`)
                    await pc.addIceCandidate(new RTCIceCandidate(candidate))
                } catch (err) { console.error(`[WebRTC] Error adding ICE candidate from ${from}:`, err) }
            } else {
                console.log(`[WebRTC] Buffering ICE candidate from ${from}`)
                const current = pendingCandidates.current.get(from) || []
                pendingCandidates.current.set(from, [...current, candidate])
            }
        }
    }

    const handleParticipantLeave = (userId: string) => {
        const pc = peerConnections.current.get(userId)
        if (pc) {
            pc.close()
            peerConnections.current.delete(userId)
        }
        pendingCandidates.current.delete(userId)

        setRemoteStreams(prev => {
            const next = new Map(prev)
            next.delete(userId)
            return next
        })
        setConnectionStates(prev => {
            const next = new Map(prev)
            next.delete(userId)
            return next
        })
        setParticipants(prev => prev.filter(p => p.id !== userId))

        if (sharingUser === userId) setSharingUser(null)
    }

    const leaveMeeting = async (shouldEndMeeting = false) => {
        if (isRecording) stopRecording()

        if (channelRef.current) {
            await channelRef.current.untrack()
            if (currentUser) sendSignal('everyone', { type: 'leave' }, currentUser.id)
            supabase.removeChannel(channelRef.current)
            channelRef.current = null
        }

        stopLocalStream()
        cleanupPeerConnections()
        setIsInCall(false)
        setMeetingId(null)
        setMeeting(null)
    }

    const endCall = async () => {
        await leaveMeeting(true)
        if (pathname.includes('/meetings/') && meetingId && pathname.includes(meetingId)) {
            router.push('/meetings')
        }
    }

    const toggleMute = () => {
        if (localStreamRef.current) {
            const nextMuted = !isMuted
            localStreamRef.current.getAudioTracks().forEach(track => track.enabled = !nextMuted)
            setIsMuted(nextMuted)
            if (currentUser) sendSignal('everyone', { type: 'media-state', isMuted: nextMuted, isCameraOff: isCameraOffRef.current }, currentUser.id)
        }
    }

    const toggleCamera = () => {
        if (localStreamRef.current) {
            const nextCameraOff = !isCameraOff
            localStreamRef.current.getVideoTracks().forEach(track => track.enabled = !nextCameraOff)
            setIsCameraOff(nextCameraOff)
            if (currentUser) sendSignal('everyone', { type: 'media-state', isMuted: isMutedRef.current, isCameraOff: nextCameraOff }, currentUser.id)
        }
    }

    const toggleScreenShare = async () => {
        if (!isScreenSharing) {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
                screenStreamRef.current = stream
                setScreenStream(stream)

                const screenTrack = stream.getVideoTracks()[0]

                screenTrack.onended = () => {
                    stopScreenSharing()
                }

                peerConnections.current.forEach(pc => {
                    const sender = pc.getSenders().find(s => s.track?.kind === 'video')
                    if (sender) sender.replaceTrack(screenTrack)
                })

                setIsScreenSharing(true)
                if (currentUser) sendSignal('everyone', { type: 'screen-share-start' }, currentUser.id)
            } catch (err) {
                console.error(err)
            }
        } else {
            stopScreenSharing()
        }
    }

    const stopScreenSharing = async () => {
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => track.stop())
            screenStreamRef.current = null
            setScreenStream(null)
        }

        const videoTrack = localStreamRef.current?.getVideoTracks()[0]
        if (videoTrack) {
            peerConnections.current.forEach(pc => {
                const sender = pc.getSenders().find(s => s.track?.kind === 'video')
                if (sender) sender.replaceTrack(videoTrack)
            })
        }

        setIsScreenSharing(false)
        if (currentUser) sendSignal('everyone', { type: 'screen-share-stop' }, currentUser.id)
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
            if (meetingId) formData.append('meetingId', meetingId)
            formData.append('file', blob, 'recording.webm')
            await saveMeetingRecording(formData)
        }

        recorder.start()
        mediaRecorderRef.current = recorder
        setIsRecording(true)
        if (currentUser) sendSignal('everyone', { type: 'recording-state', isRecording: true }, currentUser.id)

        setRecordingTime(0)
        timerRef.current = setInterval(() => {
            setRecordingTime(prev => prev + 1)
        }, 1000)
    }

    const stopRecording = () => {
        mediaRecorderRef.current?.stop()
        setIsRecording(false)
        if (currentUser) sendSignal('everyone', { type: 'recording-state', isRecording: false }, currentUser.id)
        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }
    }

    const sendMessage = (content: string) => {
        if (!currentUser || !meetingId) return

        const msg = {
            id: Date.now().toString(),
            sender_id: currentUser.id,
            sender_name: currentUser.full_name,
            content: content,
            created_at: new Date().toISOString()
        }

        if (channelRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'chat',
                payload: msg
            })
        }
        setMessages(prev => [...prev, msg])
    }

    return (
        <CallContext.Provider value={{
            meetingId,
            meeting,
            currentUser,
            participants,
            activeSpeaker,
            isMuted,
            isCameraOff,
            isScreenSharing,
            isRecording,
            recordingTime,
            showChat,
            messages,
            remoteStreams,
            connectionStates,
            participantStates,
            localStream,
            screenStream,
            sharingUser,
            joinMeeting,
            leaveMeeting: endCall,
            toggleMute,
            toggleCamera,
            toggleScreenShare,
            startRecording,
            stopRecording,
            sendMessage,
            setShowChat,
            endCall,
            isInCall
        }}>
            {children}
        </CallContext.Provider>
    )
}
