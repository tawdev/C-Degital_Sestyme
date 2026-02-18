'use client'

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
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

interface Poll {
    id: string
    question: string
    options: string[]
    votes: Map<string, number> // userId -> optionIndex
    isOpen: boolean
    creatorId: string
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
    remoteScreenStreams: Map<string, MediaStream>
    connectionStates: Map<string, RTCPeerConnectionState>
    participantStates: Map<string, ParticipantState>
    localStream: MediaStream | null
    screenStream: MediaStream | null
    sharingUser: string | null
    viewMode: 'grid' | 'speaker'
    setViewMode: (mode: 'grid' | 'speaker') => void
    joinRequests: Participant[]
    admitParticipant: (userId: string) => void
    isWaiting: boolean
    polls: Poll[]
    createPoll: (question: string, options: string[]) => void
    voteInPoll: (pollId: string, optionIndex: number) => void
    closePoll: (pollId: string) => void

    joinMeeting: (meetingId: string, meeting: any, user: any) => Promise<void>
    leaveMeeting: (shouldEndMeeting?: boolean) => Promise<void>
    toggleMute: () => void
    toggleCamera: () => void
    toggleScreenShare: () => Promise<void>
    startRecording: () => void
    stopRecording: () => void
    sendMessage: (content: string) => void
    setShowChat: (show: boolean) => void
    muteParticipant: (userId: string) => void
    kickParticipant: (userId: string) => void
    toggleRaiseHand: () => void
    sendReaction: (emoji: string) => void
    handsRaised: Set<string>
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
    const [handsRaised, setHandsRaised] = useState<Set<string>>(new Set())
    const [startTime, setStartTime] = useState<number | null>(null)

    const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())
    const [remoteScreenStreams, setRemoteScreenStreams] = useState<Map<string, MediaStream>>(new Map())
    const [connectionStates, setConnectionStates] = useState<Map<string, RTCPeerConnectionState>>(new Map())

    const [localStream, setLocalStream] = useState<MediaStream | null>(null)
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
    const [viewMode, setViewMode] = useState<'grid' | 'speaker'>('grid')
    const [joinRequests, setJoinRequests] = useState<Participant[]>([])
    const [isWaiting, setIsWaiting] = useState(false)
    const [polls, setPolls] = useState<Poll[]>([])

    const localStreamRef = useRef<MediaStream | null>(null)
    const screenStreamRef = useRef<MediaStream | null>(null)

    const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map())
    const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const recordingChunks = useRef<Blob[]>([])
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const channelRef = useRef<any>(null)
    const audioContextRef = useRef<AudioContext | null>(null)
    const analysersRef = useRef<Map<string, AnalyserNode>>(new Map())
    const volumeIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const statsIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const recordingDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null)

    const supabase = createClient()
    const router = useRouter()
    const pathname = usePathname()

    const leaveTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map())
    const GRACE_PERIOD = 2000

    // Refs for state that is accessed in callbacks
    const isMutedRef = useRef(isMuted)
    const isCameraOffRef = useRef(isCameraOff)
    const isRecordingRef = useRef(isRecording)

    useEffect(() => { isMutedRef.current = isMuted }, [isMuted])
    useEffect(() => { isCameraOffRef.current = isCameraOff }, [isCameraOff])
    useEffect(() => { isRecordingRef.current = isRecording }, [isRecording])

    const startLocalStream = async () => {
        try {
            if (localStreamRef.current) return localStreamRef.current
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
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
            setSharingUser(null)
            setIsScreenSharing(false)
        }
    }

    const cleanupPeerConnections = () => {
        peerConnections.current.forEach(pc => pc.close())
        peerConnections.current.clear()
        leaveTimeouts.current.forEach(timeout => clearTimeout(timeout))
        leaveTimeouts.current.clear()
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close()
            audioContextRef.current = null
        }
        if (statsIntervalRef.current) {
            clearInterval(statsIntervalRef.current)
            statsIntervalRef.current = null
        }
        setConnectionStates(new Map())
        setRemoteStreams(new Map())
        setParticipants([])
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
        if (sharingUser === userId) {
            setSharingUser(null)
            setRemoteScreenStreams(prev => {
                const next = new Map(prev)
                next.delete(userId)
                return next
            })
        }
    }

    const handleParticipantPresenceLeave = (userId: string) => {
        if (leaveTimeouts.current.has(userId)) clearTimeout(leaveTimeouts.current.get(userId))
        const timeout = setTimeout(() => {
            const currentState = channelRef.current?.presenceState() || {}
            const isBack = Object.values(currentState).flat().some((p: any) => p.user?.id === userId)
            if (!isBack) handleParticipantLeave(userId)
            leaveTimeouts.current.delete(userId)
        }, GRACE_PERIOD)
        leaveTimeouts.current.set(userId, timeout)
    }

    const sendSignal = async (to: string, data: any, fromId: string) => {
        if (!channelRef.current) return
        if (data.type === 'media-state') {
            data.isMuted = isMutedRef.current
            data.isCameraOff = isCameraOffRef.current
        }
        const isSpecialEvent = ['media-state', 'recording-state', 'request-state', 'command', 'hand-raised', 'reaction', 'lobby', 'poll'].includes(data.type)
        await channelRef.current.send({
            type: 'broadcast',
            event: isSpecialEvent ? data.type : 'signal',
            payload: { to, from: fromId, ...data }
        })
    }

    const createPeerConnection = (targetId: string, currentUserId: string) => {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        })
        pc.onicecandidate = (e) => {
            if (e.candidate) sendSignal(targetId, { type: 'candidate', candidate: e.candidate }, currentUserId)
        }
        pc.ontrack = (e) => {
            if (e.streams && e.streams[0]) {
                const stream = e.streams[0]
                const streamId = stream.id

                // We need to know if this is a screen stream or camera stream
                // We'll rely on the 'screen-sharing' broadcast signal to distinguish
                // But for now, we'll check if we already have a stream for this user
                setRemoteStreams(prev => {
                    if (prev.has(targetId) && prev.get(targetId)?.id !== streamId) {
                        // If we already have a camera stream, this might be the screen
                        setRemoteScreenStreams(s => new Map(s).set(targetId, stream))
                        return prev
                    }
                    const next = new Map(prev)
                    next.set(targetId, stream)
                    return next
                })
            }
        }
        pc.onconnectionstatechange = () => {
            setConnectionStates(prev => {
                const next = new Map(prev)
                next.set(targetId, pc.connectionState)
                return next
            })
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!))
        }
        peerConnections.current.set(targetId, pc)
        return pc
    }

    const initiateConnection = async (targetId: string, currentUserId: string) => {
        if (!localStreamRef.current) {
            setTimeout(() => initiateConnection(targetId, currentUserId), 1000)
            return
        }
        const pc = createPeerConnection(targetId, currentUserId)
        try {
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            sendSignal(targetId, { type: 'offer', sdp: offer }, currentUserId)
        } catch (err) { console.error(err) }
    }

    const handleSignal = async (payload: any, currentUserId: string) => {
        const { from, type, sdp, candidate } = payload
        let pc = peerConnections.current.get(from)

        if (type === 'offer') {
            if (!localStreamRef.current) {
                setTimeout(() => handleSignal(payload, currentUserId), 1000)
                return
            }
            if (!pc) pc = createPeerConnection(from, currentUserId)
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(sdp))
                const answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)
                sendSignal(from, { type: 'answer', sdp: answer }, currentUserId)
                const buffered = pendingCandidates.current.get(from) || []
                for (const cand of buffered) await pc.addIceCandidate(new RTCIceCandidate(cand))
                pendingCandidates.current.delete(from)
            } catch (err) { console.error(err) }
        } else if (type === 'answer' && pc) {
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(sdp))
                const buffered = pendingCandidates.current.get(from) || []
                for (const cand of buffered) await pc.addIceCandidate(new RTCIceCandidate(cand))
                pendingCandidates.current.delete(from)
            } catch (err) { console.error(err) }
        } else if (type === 'candidate') {
            if (!candidate) return
            if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) } catch (err) { console.error(err) }
            } else {
                const current = pendingCandidates.current.get(from) || []
                pendingCandidates.current.set(from, [...current, candidate])
            }
        } else if (type === 'leave') {
            handleParticipantLeave(from)
        } else if (type === 'screen-sharing') {
            if (payload.active) {
                setSharingUser(from)
            } else {
                setSharingUser(null)
                setRemoteScreenStreams(prev => {
                    const next = new Map(prev)
                    next.delete(from)
                    return next
                })
            }
        }
    }

    const joinMeeting = async (mid: string, mData: any, user: any) => {
        if (isInCall && meetingId === mid) return
        if (isInCall) await leaveMeeting()

        setMeetingId(mid)
        setCurrentUser(user)
        setMeeting(mData)

        const isHost = mData.host_id === user.id || user.role === 'Administrator'
        if (isHost) {
            setIsInCall(true)
            setIsWaiting(false)
        } else {
            setIsWaiting(true)
        }

        setStartTime(Date.now())
        localStorage.setItem('active-meeting', JSON.stringify({ mid, mData, user }))
        await startLocalStream()

        const channel = supabase.channel(`meeting:${mid}`)
        channelRef.current = channel

        channel
            .on('broadcast', { event: 'signal' }, ({ payload }: { payload: any }) => {
                if (payload.to === user.id || payload.to === 'everyone') handleSignal(payload, user.id)
            })
            .on('broadcast', { event: 'chat' }, ({ payload }: { payload: any }) => {
                setMessages(prev => [...prev, payload])
            })
            .on('broadcast', { event: 'media-state' }, ({ payload }: { payload: any }) => {
                setParticipantStates(prev => {
                    const next = new Map(prev)
                    const current = next.get(payload.from) || { isMuted: false, isCameraOff: false, isRecording: false }
                    next.set(payload.from, { ...current, isMuted: payload.isMuted, isCameraOff: payload.isCameraOff })
                    return next
                })
            })
            .on('broadcast', { event: 'reaction' }, ({ payload }: { payload: any }) => {
                window.dispatchEvent(new CustomEvent('meeting-reaction', { detail: { userId: payload.from, emoji: payload.emoji } }))
            })
            .on('broadcast', { event: 'hand-raised' }, ({ payload }: { payload: any }) => {
                setHandsRaised(prev => {
                    const next = new Set(prev)
                    if (payload.raised) next.add(payload.from)
                    else next.delete(payload.from)
                    return next
                })
            })
            .on('broadcast', { event: 'lobby' }, ({ payload }: { payload: any }) => {
                const isAdmin = user.role === 'Administrator'
                const isHost = mData.host_id === user.id || isAdmin

                if (payload.actionType === 'request' && isHost) {
                    setJoinRequests(prev => {
                        if (prev.find(r => r.id === payload.from)) return prev
                        return [...prev, { ...payload.user, id: payload.from }]
                    })
                } else if (payload.actionType === 'admit' && (payload.from === mData.host_id || payload.role === 'Administrator')) {
                    setIsWaiting(false)
                    setIsInCall(true)
                }
            })
            .on('broadcast', { event: 'poll' }, ({ payload }: { payload: any }) => {
                setPolls(prev => {
                    const next = [...prev]
                    if (payload.pollAction === 'create' && payload.poll) {
                        return [...next, { ...payload.poll, votes: new Map() }]
                    } else if (payload.pollAction === 'vote') {
                        return next.map(p => {
                            if (p.id === payload.pollId) {
                                const v = new Map(p.votes)
                                v.set(payload.from, payload.optionIndex)
                                return { ...p, votes: v }
                            }
                            return p
                        })
                    } else if (payload.pollAction === 'close') {
                        return next.map(p => p.id === payload.pollId ? { ...p, isOpen: false } : p)
                    }
                    return next
                })
            })
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState()
                const memberMap = new Map()
                Object.values(state).flat().forEach((p: any) => {
                    if (p.user?.id) memberMap.set(p.user.id, p.user)
                })
                const uniqueMembers = Array.from(memberMap.values())
                const allParticipants = [...uniqueMembers, { id: user.id, name: user.full_name, avatar: user.avatar_url }]
                const participantMap = new Map()
                allParticipants.forEach(p => participantMap.set(p.id, p))
                setParticipants(Array.from(participantMap.values()) as Participant[])

                const memberIds = new Set(uniqueMembers.map((m: any) => m.id))
                peerConnections.current.forEach((pc, id) => { if (!memberIds.has(id)) handleParticipantPresenceLeave(id) })
                uniqueMembers.forEach((member: any) => {
                    if (member.id !== user.id && !peerConnections.current.has(member.id)) {
                        if (user.id < member.id) initiateConnection(member.id, user.id)
                    }
                })
            })
            .on('presence', { event: 'leave' }, ({ leftPresences }: { leftPresences: any[] }) => {
                leftPresences.forEach((p: any) => { if (p.user?.id) handleParticipantPresenceLeave(p.user.id) })
            })
            .subscribe(async (status: string) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        user: { id: user.id, name: user.full_name, avatar: user.avatar_url },
                        online_at: new Date().toISOString()
                    })
                    if (isHost) updateMeetingStatus(mid, 'live')
                    if (!isHost && !isInCall) {
                        sendSignal(mData.host_id, { type: 'lobby', actionType: 'request', user: { name: user.full_name, avatar: user.avatar_url } }, user.id)
                    }
                }
            })
    }

    const leaveMeeting = async () => {
        if (channelRef.current) {
            await channelRef.current.untrack()
            if (currentUser) sendSignal('everyone', { type: 'leave' }, currentUser.id)
            supabase.removeChannel(channelRef.current)
            channelRef.current = null
        }
        stopLocalStream()
        cleanupPeerConnections()
        setIsInCall(false)
        setIsWaiting(false)
        setMeetingId(null)
        setMeeting(null)
        localStorage.removeItem('active-meeting')
    }

    const toggleMute = () => {
        if (localStreamRef.current) {
            const track = localStreamRef.current.getAudioTracks()[0]
            if (track) {
                track.enabled = !track.enabled
                setIsMuted(!track.enabled)
                if (currentUser) sendSignal('everyone', { type: 'media-state' }, currentUser.id)
            }
        }
    }

    const toggleCamera = () => {
        if (localStreamRef.current) {
            const track = localStreamRef.current.getVideoTracks()[0]
            if (track) {
                track.enabled = !track.enabled
                setIsCameraOff(!track.enabled)
                if (currentUser) sendSignal('everyone', { type: 'media-state' }, currentUser.id)
            }
        }
    }

    const createPoll = (question: string, options: string[]) => {
        if (!currentUser) return
        const newPoll: Poll = { id: Math.random().toString(36).substring(7), question, options, votes: new Map(), isOpen: true, creatorId: currentUser.id }
        setPolls(prev => [...prev, newPoll])
        sendSignal('everyone', { type: 'poll', pollAction: 'create', poll: { ...newPoll, votes: [] } }, currentUser.id)
    }

    const voteInPoll = (pollId: string, optionIndex: number) => {
        if (!currentUser) return
        sendSignal('everyone', { type: 'poll', pollAction: 'vote', pollId, optionIndex }, currentUser.id)
        setPolls(prev => prev.map(p => {
            if (p.id === pollId) {
                const v = new Map(p.votes)
                v.set(currentUser.id, optionIndex)
                return { ...p, votes: v }
            }
            return p
        }))
    }

    const closePoll = (pollId: string) => {
        if (!currentUser) return
        sendSignal('everyone', { type: 'poll', pollAction: 'close', pollId }, currentUser.id)
        setPolls(prev => prev.map(p => p.id === pollId ? { ...p, isOpen: false } : p))
    }

    const admitParticipant = (userId: string) => {
        sendSignal(userId, { type: 'lobby', actionType: 'admit' }, currentUser.id)
        setJoinRequests(prev => prev.filter(r => r.id !== userId))
    }

    const endCall = async () => {
        if (meeting?.host_id === currentUser?.id) await updateMeetingStatus(meetingId!, 'ended')
        await leaveMeeting()
        router.push('/chat')
    }

    // Unimplemented placeholders for the context type compatibility
    const toggleScreenShare = async () => {
        if (!isScreenSharing) {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
                screenStreamRef.current = stream
                setScreenStream(stream)
                setIsScreenSharing(true)
                setSharingUser(currentUser.id)

                // Add screen tracks to all existing peer connections
                stream.getTracks().forEach(track => {
                    track.onended = () => {
                        stopScreenShare()
                    }
                    peerConnections.current.forEach(pc => {
                        pc.addTrack(track, stream)
                    })
                })

                // Broadcast to others
                sendSignal('everyone', { type: 'screen-sharing', active: true }, currentUser.id)

                // Trigger renegotiation
                peerConnections.current.forEach(async (pc, targetId) => {
                    const offer = await pc.createOffer()
                    await pc.setLocalDescription(offer)
                    sendSignal(targetId, { type: 'offer', sdp: offer }, currentUser.id)
                })

            } catch (err) {
                console.error('Error starting screen share:', err)
            }
        } else {
            stopScreenShare()
        }
    }

    const stopScreenShare = () => {
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => track.stop())
            screenStreamRef.current = null
            setScreenStream(null)
        }
        setIsScreenSharing(false)
        setSharingUser(null)

        // Notify others
        sendSignal('everyone', { type: 'screen-sharing', active: false }, currentUser.id)

        // Renegotiate to remove tracks
        peerConnections.current.forEach(async (pc, targetId) => {
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            sendSignal(targetId, { type: 'offer', sdp: offer }, currentUser.id)
        })
    }
    const startRecording = () => { }
    const stopRecording = () => { }
    const sendMessage = (content: string) => {
        if (!currentUser) return
        const msg = { id: Date.now().toString(), sender: currentUser.id, name: currentUser.full_name, avatar: currentUser.avatar_url, content, timestamp: new Date().toISOString() }
        setMessages(prev => [...prev, msg])
        sendSignal('everyone', { type: 'chat', ...msg }, currentUser.id)
    }
    const muteParticipant = (userId: string) => sendSignal(userId, { type: 'command', action: 'mute' }, currentUser.id)
    const kickParticipant = (userId: string) => sendSignal(userId, { type: 'command', action: 'kick' }, currentUser.id)
    const toggleRaiseHand = () => {
        const raised = !handsRaised.has(currentUser.id)
        setHandsRaised(prev => {
            const next = new Set(prev)
            if (raised) next.add(currentUser.id)
            else next.delete(currentUser.id)
            return next
        })
        sendSignal('everyone', { type: 'hand-raised', raised }, currentUser.id)
    }
    const sendReaction = (emoji: string) => sendSignal('everyone', { type: 'reaction', emoji }, currentUser.id)

    return (
        <CallContext.Provider value={{
            meetingId, meeting, currentUser, participants, activeSpeaker, isMuted, isCameraOff, isScreenSharing,
            isRecording, recordingTime, showChat, messages, remoteStreams, remoteScreenStreams, connectionStates, participantStates,
            localStream, screenStream, sharingUser, viewMode, setViewMode, joinRequests, admitParticipant,
            isWaiting, polls, createPoll, voteInPoll, closePoll, joinMeeting, leaveMeeting, toggleMute,
            toggleCamera, toggleScreenShare, startRecording, stopRecording, sendMessage, setShowChat,
            muteParticipant, kickParticipant, toggleRaiseHand, sendReaction, handsRaised, endCall, isInCall
        }}>
            {children}
        </CallContext.Provider>
    )
}
