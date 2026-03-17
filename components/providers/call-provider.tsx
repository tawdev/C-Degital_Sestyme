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
    isScreenSharing: boolean
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
    blockParticipant: (userId: string) => void
    blockedUsers: Set<string>
    toggleRaiseHand: () => void
    sendReaction: (emoji: string) => void
    handsRaised: Set<string>
    endCall: () => Promise<void>
    isInCall: boolean
    isMinimized: boolean
    setIsMinimized: (minimized: boolean) => void
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
    const [isMinimized, setIsMinimized] = useState(false)

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
    const makingOffer = useRef<Map<string, boolean>>(new Map())
    const isSettingRemoteDescription = useRef<Map<string, boolean>>(new Map())
    const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const recordingChunks = useRef<Blob[]>([])
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const channelRef = useRef<any>(null)
    const lobbyIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const isWaitingRef = useRef(false)
    const blockedUsersRef = useRef<Set<string>>(new Set())
    const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set())
    const audioContextRef = useRef<AudioContext | null>(null)
    const analysersRef = useRef<Map<string, AnalyserNode>>(new Map())
    const statsIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const recordingDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null)
    const recordCanvasRef = useRef<HTMLCanvasElement | null>(null)
    const requestRef = useRef<number | null>(null)
    const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map())
    const audioSourcesRef = useRef<Map<string, MediaStreamAudioSourceNode>>(new Map())

    // Refs for state that need to be accessed in closures without stale values
    const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map())
    const remoteScreenStreamsRef = useRef<Map<string, MediaStream>>(new Map())
    const sharingStreamIdsRef = useRef<Map<string, string>>(new Map())

    useEffect(() => { remoteStreamsRef.current = remoteStreams }, [remoteStreams])
    useEffect(() => { remoteScreenStreamsRef.current = remoteScreenStreams }, [remoteScreenStreams])

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

    // Synchronize local tracks with all peer connections
    useEffect(() => {
        if (!localStream) return

        peerConnections.current.forEach((pc, userId) => {
            const senders = pc.getSenders()
            localStream.getTracks().forEach(track => {
                const existingSender = senders.find(s => s.track?.kind === track.kind)
                if (existingSender) {
                    if (existingSender.track !== track) {
                        existingSender.replaceTrack(track)
                    }
                } else {
                    pc.addTrack(track, localStream)
                }
            })
        })
    }, [localStream])

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
        makingOffer.current.delete(userId)
        isSettingRemoteDescription.current.delete(userId)
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
        setParticipantStates(prev => {
            const next = new Map(prev)
            next.delete(userId)
            return next
        })
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

    const getOrCreateVideoElement = useCallback((uid: string, stream: MediaStream) => {
        let video = videoElementsRef.current.get(uid)
        if (!video) {
            video = document.createElement('video')
            video.muted = true
            video.playsInline = true
            video.autoplay = true
            videoElementsRef.current.set(uid, video)
        }
        if (video.srcObject !== stream) {
            video.srcObject = stream
            video.play().catch(e => console.warn('[CallProvider] Video play failed for mixer:', e))
        }
        return video
    }, [])

    const renderRecordingFrame = useCallback(() => {
        if (!isRecordingRef.current || !recordCanvasRef.current) return

        const canvas = recordCanvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const state = participantStates

        // Background
        ctx.fillStyle = '#0f172a' // Slate-900
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        const activeParticipants = participants.filter(p => {
            if (p.id === currentUser?.id) return localStreamRef.current?.getVideoTracks().length! > 0 && !isCameraOffRef.current
            const s = state.get(p.id)
            return remoteStreamsRef.current.get(p.id)?.getVideoTracks().length! > 0 && !s?.isCameraOff
        })

        if (sharingUser) {
            // Priority to Screen Share
            let stream: MediaStream | null = null
            if (sharingUser === currentUser?.id) stream = screenStreamRef.current
            else stream = remoteScreenStreamsRef.current.get(sharingUser) || remoteStreamsRef.current.get(sharingUser) || null

            if (stream) {
                const video = getOrCreateVideoElement(sharingUser + '-screen', stream)
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
                
                // Small overlays for participants
                const thumbs = activeParticipants.filter(p => p.id !== sharingUser)
                if (thumbs.length > 0) {
                    const thumbWidth = 240
                    const thumbHeight = 135
                    thumbs.forEach((p, i) => {
                        const s = p.id === currentUser?.id ? localStreamRef.current : remoteStreamsRef.current.get(p.id)
                        if (s) {
                            const v = getOrCreateVideoElement(p.id, s)
                            ctx.drawImage(v, canvas.width - thumbWidth - 20, 20 + i * (thumbHeight + 10), thumbWidth, thumbHeight)
                            ctx.fillStyle = 'rgba(0,0,0,0.5)'
                            ctx.fillRect(canvas.width - thumbWidth - 20, 20 + i * (thumbHeight + 10) + thumbHeight - 20, thumbWidth, 20)
                            ctx.fillStyle = 'white'
                            ctx.font = 'bold 12px Inter, sans-serif'
                            ctx.fillText(p.name, canvas.width - thumbWidth - 15, 20 + i * (thumbHeight + 10) + thumbHeight - 5)
                        }
                    })
                }
            }
        } else if (activeParticipants.length > 0) {
            // Grid Layout
            const count = activeParticipants.length
            const cols = Math.ceil(Math.sqrt(count))
            const rows = Math.ceil(count / cols)
            const w = canvas.width / cols
            const h = canvas.height / rows

            activeParticipants.forEach((p, i) => {
                const stream = p.id === currentUser?.id ? localStreamRef.current : remoteStreamsRef.current.get(p.id)
                if (stream) {
                    const video = getOrCreateVideoElement(p.id, stream)
                    const x = (i % cols) * w
                    const y = Math.floor(i / cols) * h
                    ctx.drawImage(video, x, y, w, h)

                    ctx.fillStyle = 'rgba(0,0,0,0.5)'
                    ctx.fillRect(x, y + h - 30, w, 30)
                    ctx.fillStyle = 'white'
                    ctx.font = 'bold 16px Inter, sans-serif'
                    ctx.fillText(p.name, x + 10, y + h - 10)
                }
            })
        } else {
            ctx.fillStyle = '#1e293b'
            ctx.textAlign = 'center'
            ctx.font = 'bold 24px Inter, sans-serif'
            ctx.fillText('Meeting en cours (Audio uniquement)', canvas.width / 2, canvas.height / 2)
        }

        requestRef.current = requestAnimationFrame(renderRecordingFrame)
    }, [currentUser, participants, participantStates, sharingUser, getOrCreateVideoElement])

    const sendSignal = async (to: string, data: any, fromId: string) => {
        if (!channelRef.current) return
        if (data.type === 'media-state') {
            data.isMuted = isMutedRef.current
            data.isCameraOff = isCameraOffRef.current
        }

        // Ensure role is sent with lobby/admission signals
        if (data.type === 'lobby' || data.type === 'admit') {
            data.role = currentUser?.role
        }

        const isSpecialEvent = ['media-state', 'recording-state', 'request-state', 'command', 'hand-raised', 'reaction', 'lobby', 'poll', 'chat', 'screen-sharing'].includes(data.type)

        console.log(`[CallProvider] Sending ${isSpecialEvent ? data.type : 'signal'} to ${to}`, data)

        await channelRef.current.send({
            type: 'broadcast',
            event: isSpecialEvent ? data.type : 'signal',
            payload: { to, from: fromId, ...data }
        })
    }

    const createPeerConnection = (targetId: string, currentUserId: string) => {
        if (peerConnections.current.has(targetId)) return peerConnections.current.get(targetId)!

        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ]
        })

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                sendSignal(targetId, { type: 'candidate', candidate: e.candidate }, currentUserId)
            }
        }

        pc.ontrack = (e) => {
            console.log(`[CallProvider] Track received from ${targetId}:`, e.track.kind, 'Stream ID:', e.streams?.[0]?.id)
            const stream = e.streams[0]
            const sharingId = sharingStreamIdsRef.current.get(targetId)

            // Logic to determine where to put the stream
            setRemoteStreams(prev => {
                const next = new Map(prev)
                const existing = next.get(targetId)

                // If this is explicitly known as the screen share stream
                if (sharingId && stream.id === sharingId) {
                    console.log(`[CallProvider] Matched explicit screen share stream ID for ${targetId}:`, stream.id)
                    setRemoteScreenStreams(prevScreen => new Map(prevScreen).set(targetId, stream))
                    return prev
                }

                // If we have an existing stream and this is a different one, it's a secondary stream (likely screen)
                if (existing && existing.id !== stream.id) {
                    console.log(`[CallProvider] Detected secondary stream for ${targetId} (likely screen share):`, stream.id)
                    setRemoteScreenStreams(prevScreen => new Map(prevScreen).set(targetId, stream))
                    return prev
                }

                // Primary stream (or first one to arrive)
                next.set(targetId, stream)
                return next
            })

            stream.onremovetrack = () => {
                if (stream.getTracks().length === 0) {
                    setRemoteStreams(prev => {
                        const next = new Map(prev)
                        if (next.get(targetId)?.id === stream.id) next.delete(targetId)
                        return next
                    })
                    setRemoteScreenStreams(prev => {
                        const next = new Map(prev)
                        if (next.get(targetId)?.id === stream.id) next.delete(targetId)
                        return next
                    })
                }
            }
        }

        pc.onconnectionstatechange = () => {
            setConnectionStates(prev => {
                const next = new Map(prev)
                next.set(targetId, pc.connectionState)
                return next
            })
            if (pc.connectionState === 'failed') {
                pc.restartIce()
            }
        }

        pc.onnegotiationneeded = async () => {
            try {
                makingOffer.current.set(targetId, true)
                await pc.setLocalDescription() // Modern WebRTC automatically creates and sets offer
                sendSignal(targetId, { type: 'offer', sdp: pc.localDescription }, currentUserId)
            } catch (err) {
                console.error('[CallProvider] Negotiation error:', err)
            } finally {
                makingOffer.current.set(targetId, false)
            }
        }

        // Add all available local tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current!)
            })
        }
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, screenStreamRef.current!)
            })
        }

        peerConnections.current.set(targetId, pc)
        return pc
    }

    const initiateConnection = (targetId: string, currentUserId: string) => {
        // Just create the PC, negotiationneeded will take care of the rest if polite
        createPeerConnection(targetId, currentUserId)
        if (currentUserId < targetId) {
            sendSignal(targetId, { type: 'initiate' }, currentUserId)
        }
    }

    const handleSignal = async (payload: any, currentUserId: string) => {
        const { from, type, sdp, candidate } = payload
        let pc = peerConnections.current.get(from)
        if (!pc && (type === 'offer' || type === 'initiate')) {
            pc = createPeerConnection(from, currentUserId)
        }
        if (!pc) return

        const isPolite = currentUserId < from

        try {
            if (type === 'offer' || type === 'initiate') {
                if (type === 'initiate') return

                const offerCollision = makingOffer.current.get(from) || pc.signalingState !== 'stable'
                const ignoreOffer = !isPolite && offerCollision

                if (ignoreOffer) {
                    console.log('[CallProvider] Ignoring offer (collision on impolite side)')
                    return
                }

                isSettingRemoteDescription.current.set(from, true)
                await pc.setRemoteDescription(new RTCSessionDescription(sdp))
                isSettingRemoteDescription.current.delete(from)

                if (type === 'offer') {
                    await pc.setLocalDescription()
                    sendSignal(from, { type: 'answer', sdp: pc.localDescription }, currentUserId)
                }

                // Flush pending candidates
                const buffered = pendingCandidates.current.get(from) || []
                for (const cand of buffered) {
                    await pc.addIceCandidate(new RTCIceCandidate(cand))
                }
                pendingCandidates.current.delete(from)

            } else if (type === 'answer') {
                await pc.setRemoteDescription(new RTCSessionDescription(sdp))
            } else if (type === 'candidate') {
                if (!candidate) return
                try {
                    if (pc.remoteDescription && pc.remoteDescription.type && !isSettingRemoteDescription.current.get(from)) {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate))
                    } else {
                        const current = pendingCandidates.current.get(from) || []
                        pendingCandidates.current.set(from, [...current, candidate])
                    }
                } catch (err) {
                    // Ignore candidate errors on impolite side during collision
                    if (isPolite && pc.remoteDescription && pc.remoteDescription.type === 'offer') {
                        console.warn('[CallProvider] Candidate error (polite side during offer collision):', err)
                    } else {
                        console.warn('[CallProvider] Candidate error:', err)
                    }
                }
            } else if (type === 'leave') {
                handleParticipantLeave(from)
            } else if (type === 'command') {
                const { action } = payload
                if (action === 'kick') {
                    console.log('[CallProvider] I was kicked by host!')
                    leaveMeeting()
                    router.push('/chat')
                } else if (action === 'block') {
                    console.log('[CallProvider] I was blocked and kicked by host!')
                    leaveMeeting()
                    router.push('/chat')
                }
            }
        } catch (err) {
            console.error('[CallProvider] Signaling error:', err, 'Type:', type)
        }
    }

    const joinMeeting = async (mid: string, mData: any, user: any) => {
        if (isInCall && meetingId === mid) {
            console.log('[CallProvider] Already in this meeting, skipping join.')
            return
        }
        if (isInCall) await leaveMeeting()

        console.log('[CallProvider] Joining meeting:', mid)
        setMeetingId(mid)
        setCurrentUser(user)
        setMeeting(mData)

        const isHost = mData.host_id === user.id || user.role?.toLowerCase() === 'administrator'
        if (isHost) {
            setIsInCall(true)
            setIsWaiting(false)
            isWaitingRef.current = false
        } else {
            setIsWaiting(true)
            isWaitingRef.current = true
        }

        setStartTime(Date.now())
        localStorage.setItem('active-meeting', JSON.stringify({ mid, mData, user }))
        await startLocalStream()

        const channel = supabase.channel(`meeting:${mid}`)
        channelRef.current = channel

        channel
            .on('broadcast', { event: 'signal' }, ({ payload }: { payload: any }) => {
                const isBlocked = blockedUsersRef.current.has(payload.from)
                if (isBlocked) {
                    console.warn('[CallProvider] Ignoring signal from blocked user:', payload.from)
                    return
                }
                if (payload.to === user.id || payload.to === 'everyone') handleSignal(payload, user.id)
            })
            .on('broadcast', { event: 'command' }, ({ payload }: { payload: any }) => {
                if (payload.to === user.id) {
                    if (payload.action === 'kick' || payload.action === 'block') {
                        leaveMeeting()
                        router.push('/chat')
                    }
                }
            })
            .on('broadcast', { event: 'chat' }, ({ payload }: { payload: any }) => {
                setMessages(prev => {
                    const exists = prev.some(m => m.id === payload.id)
                    if (exists) return prev
                    return [...prev, payload]
                })
            })
            .on('broadcast', { event: 'media-state' }, ({ payload }: { payload: any }) => {
                setParticipantStates(prev => {
                    const next = new Map(prev)
                    const current = next.get(payload.from) || { isMuted: false, isCameraOff: false, isRecording: false, isScreenSharing: false }
                    next.set(payload.from, { ...current, isMuted: payload.isMuted, isCameraOff: payload.isCameraOff })
                    return next
                })
            })
            .on('broadcast', { event: 'recording-state' }, ({ payload }: { payload: any }) => {
                setParticipantStates(prev => {
                    const next = new Map(prev)
                    const current = next.get(payload.from) || { isMuted: false, isCameraOff: false, isRecording: false, isScreenSharing: false }
                    next.set(payload.from, { ...current, isRecording: payload.isRecording })
                    return next
                })
            })
            .on('broadcast', { event: 'screen-sharing' }, ({ payload }: { payload: any }) => {
                setParticipantStates(prev => {
                    const next = new Map(prev)
                    const current = next.get(payload.from) || { isMuted: false, isCameraOff: false, isRecording: false, isScreenSharing: false }
                    next.set(payload.from, { ...current, isScreenSharing: payload.active })
                    return next
                })

                if (payload.active) {
                    setSharingUser(payload.from)
                    if (payload.streamId) {
                        sharingStreamIdsRef.current.set(payload.from, payload.streamId)
                    }

                    // Proactively check if the stream already exists in remoteStreams but was miscategorized
                    const currentPrimary = remoteStreamsRef.current.get(payload.from)
                    if (currentPrimary && (payload.streamId ? currentPrimary.id === payload.streamId : true)) {
                        console.log(`[CallProvider] Screen share signal received, moving stream to remoteScreenStreams for ${payload.from}`)
                        setRemoteScreenStreams(prev => new Map(prev).set(payload.from, currentPrimary))
                    }
                } else {
                    setSharingUser(null)
                    sharingStreamIdsRef.current.delete(payload.from)
                    setRemoteScreenStreams(prev => {
                        const next = new Map(prev)
                        next.delete(payload.from)
                        return next
                    })
                }
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
                const isAdmin = user.role?.toLowerCase() === 'administrator'
                const isHost = mData.host_id === user.id || isAdmin

                console.log('[CallProvider] Lobby signal received:', payload.actionType, {
                    isHost,
                    isAdmin,
                    from: payload.from,
                    to: payload.to
                })

                if (payload.actionType === 'request' && isHost) {
                    console.log('[CallProvider] Adding join request from:', payload.from)
                    setJoinRequests(prev => {
                        if (prev.find(r => r.id === payload.from)) return prev
                        return [...prev, { ...payload.user, id: payload.from }]
                    })
                } else if (payload.actionType === 'admit') {
                    const isAuthorized = payload.from === mData.host_id || payload.role?.toLowerCase() === 'administrator'
                    const isForMe = payload.to === user.id || payload.to === 'everyone'

                    if (isAuthorized && isForMe) {
                        if (isInCall) return // Already admitted
                        console.log('[CallProvider] Admitted by:', payload.from)
                        setIsWaiting(false)
                        isWaitingRef.current = false
                        if (lobbyIntervalRef.current) {
                            clearInterval(lobbyIntervalRef.current)
                            lobbyIntervalRef.current = null
                        }
                        setIsInCall(true)
                    }
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
                    console.log('[CallProvider] Subscribed to meeting channel:', mid)
                    await channel.track({
                        user: { id: user.id, name: user.full_name, avatar: user.avatar_url },
                        online_at: new Date().toISOString()
                    })
                    if (!isHost && !isInCall) {
                        const sendLobbyRequest = () => {
                            if (isWaitingRef.current) {
                                console.log('[CallProvider] Sending lobby request...')
                                sendSignal('everyone', { type: 'lobby', actionType: 'request', user: { name: user.full_name, avatar: user.avatar_url } }, user.id)
                            }
                        }
                        sendLobbyRequest()
                        if (lobbyIntervalRef.current) clearInterval(lobbyIntervalRef.current)
                        lobbyIntervalRef.current = setInterval(sendLobbyRequest, 5000)
                    }

                    // Fetch existing messages
                    try {
                        const { data: existingMsgs, error: fetchError } = await supabase
                            .from('meeting_messages')
                            .select('*')
                            .eq('meeting_id', mid)
                            .order('created_at', { ascending: true })

                        if (fetchError) {
                            console.warn('[CallProvider] Could not fetch messages (table might be missing):', fetchError.message)
                        } else if (existingMsgs) {
                            setMessages(existingMsgs.map((m: any) => ({
                                id: m.id,
                                sender: m.sender_id,
                                name: m.sender_name,
                                avatar: m.sender_avatar,
                                content: m.content,
                                timestamp: m.created_at
                            })))
                        }
                    } catch (err) {
                        console.warn('[CallProvider] Exception during message fetch:', err)
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
        setMessages([]) // Reset messages for the next call
        setParticipants([])
        setRemoteStreams(new Map())
        setRemoteScreenStreams(new Map())
        setConnectionStates(new Map())
        setParticipantStates(new Map())
        setHandsRaised(new Set())
        setJoinRequests([])
        if (lobbyIntervalRef.current) {
            clearInterval(lobbyIntervalRef.current)
            lobbyIntervalRef.current = null
        }
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
        sendSignal(userId, { type: 'lobby', actionType: 'admit', role: currentUser?.role }, currentUser.id)
        setJoinRequests(prev => prev.filter(r => r.id !== userId))
    }

    const endCall = async () => {
        if (meeting?.host_id === currentUser?.id) await updateMeetingStatus(meetingId!, 'ended')
        await leaveMeeting()
        router.push('/chat')
    }

    const toggleScreenShare = async () => {
        if (!isScreenSharing) {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        cursor: "always"
                    } as any,
                    audio: false
                })

                const screenTrack = stream.getVideoTracks()[0]
                if (!screenTrack) return

                screenStreamRef.current = stream
                setScreenStream(stream)
                setIsScreenSharing(true)
                setSharingUser(currentUser?.id || null)

                // Replace the video track for all participants
                peerConnections.current.forEach(async (pc) => {
                    const sender = pc.getSenders().find(s => s.track?.kind === 'video')
                    if (sender) {
                        try {
                            await sender.replaceTrack(screenTrack)
                        } catch (err) {
                            console.error('[CallProvider] Error replacing track:', err)
                        }
                    }
                })

                // Disable local camera track if active
                if (localStreamRef.current) {
                    const cameraTrack = localStreamRef.current.getVideoTracks()[0]
                    if (cameraTrack) {
                        cameraTrack.enabled = false
                        setIsCameraOff(true)
                        // Broadcast state change
                        sendSignal('everyone', { type: 'camera-toggle', enabled: false }, currentUser?.id)
                    }
                }

                screenTrack.onended = () => {
                    stopScreenShare()
                }

                // Local state update (Supabase broadcast won't echo back to us)
                setScreenStream(stream)
                setIsScreenSharing(true)
                setSharingUser(currentUser?.id)
                setParticipantStates(prev => {
                    const next = new Map(prev)
                    const current = next.get(currentUser?.id) || { isMuted: false, isCameraOff: false, isRecording: false, isScreenSharing: false }
                    next.set(currentUser?.id, { ...current, isScreenSharing: true, isCameraOff: true })
                    return next
                })

                // Broadcast sharing status for UI (Main Stage)
                sendSignal('everyone', {
                    type: 'screen-sharing',
                    active: true,
                    streamId: stream.id
                }, currentUser?.id)
            } catch (err) {
                console.error('[CallProvider] Error starting screen share:', err)
                stopScreenShare()
            }
        } else {
            stopScreenShare()
        }
    }

    const stopScreenShare = async () => {
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => track.stop())
            screenStreamRef.current = null
            setScreenStream(null)
        }

        // Restore camera track to all senders
        if (localStreamRef.current) {
            const cameraVideoTrack = localStreamRef.current.getVideoTracks()[0]
            if (cameraVideoTrack) {
                cameraVideoTrack.enabled = true
                setIsCameraOff(false)
                // Broadcast state change
                sendSignal('everyone', { type: 'camera-toggle', enabled: true }, currentUser?.id)

                peerConnections.current.forEach(async (pc) => {
                    const sender = pc.getSenders().find(s => s.track?.kind === 'video')
                    if (sender) {
                        try {
                            await sender.replaceTrack(cameraVideoTrack)
                        } catch (err) {
                            console.error('[CallProvider] Error restoring camera track:', err)
                        }
                    }
                })
            }
        }

        setIsScreenSharing(false)
        setSharingUser(null)
        setParticipantStates(prev => {
            const next = new Map(prev)
            const current = next.get(currentUser?.id) || { isMuted: false, isCameraOff: false, isRecording: false, isScreenSharing: false }
            next.set(currentUser?.id, { ...current, isScreenSharing: false })
            return next
        })

        // Notify others
        sendSignal('everyone', { type: 'screen-sharing', active: false }, currentUser?.id)
    }
    const startRecording = async () => {
        if (isRecording) return
        console.log('[CallProvider] Starting advanced recording...')

        try {
            // 1. Initialize Audio Context for mixing
            if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
            const ctx = audioContextRef.current
            const dest = ctx.createMediaStreamDestination()
            recordingDestinationRef.current = dest

            // 2. Add Local Audio
            if (localStreamRef.current) {
                const source = ctx.createMediaStreamSource(localStreamRef.current)
                source.connect(dest)
            }

            // 3. Add Remote Audios
            remoteStreamsRef.current.forEach((stream, uid) => {
                if (stream.getAudioTracks().length > 0) {
                    const source = ctx.createMediaStreamSource(stream)
                    source.connect(dest)
                }
            })

            // 4. Initialize Canvas for video mixing
            if (!recordCanvasRef.current) {
                const canvas = document.createElement('canvas')
                canvas.width = 1280
                canvas.height = 720
                recordCanvasRef.current = canvas
            }

            setIsRecording(true)
            renderRecordingFrame()

            const videoStream = recordCanvasRef.current.captureStream(30)
            const combinedStream = new MediaStream([
                ...dest.stream.getAudioTracks(),
                ...videoStream.getVideoTracks()
            ])

            // 5. Setup MediaRecorder
            const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp9,opus' })
            mediaRecorderRef.current = recorder
            recordingChunks.current = []

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) recordingChunks.current.push(e.data)
            }

            recorder.onstop = async () => {
                console.log('[CallProvider] Recording stopped, saving...')
                const blob = new Blob(recordingChunks.current, { type: 'video/webm' })
                const file = new File([blob], `meeting-${meetingId}.webm`, { type: 'video/webm' })

                const formData = new FormData()
                formData.append('meetingId', meetingId!)
                formData.append('file', file)

                const result = await saveMeetingRecording(formData)
                if (result.success) {
                    console.log('[CallProvider] Meeting recording saved successfully')
                } else {
                    console.error('[CallProvider] Failed to save meeting recording:', result.error)
                }
            }

            recorder.start(1000)
            setRecordingTime(0)
            if (timerRef.current) clearInterval(timerRef.current)
            timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000)

            // Notify others if needed (optional)
            sendSignal('everyone', { type: 'recording-state', isRecording: true }, currentUser.id)

        } catch (err) {
            console.error('[CallProvider] Recording failed to start:', err)
            setIsRecording(false)
        }
    }

    const stopRecording = () => {
        if (!isRecording) return
        console.log('[CallProvider] Stopping recording session')
        setIsRecording(false)

        if (requestRef.current) {
            cancelAnimationFrame(requestRef.current)
            requestRef.current = null
        }

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop()
        }

        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }

        // Cleanup video elements for next time
        videoElementsRef.current.forEach(v => {
            v.srcObject = null
            v.remove()
        })
        videoElementsRef.current.clear()

        sendSignal('everyone', { type: 'recording-state', isRecording: false }, currentUser.id)
    }
    const sendMessage = async (content: string) => {
        if (!currentUser || !meetingId) return
        const msg = {
            id: Math.random().toString(36).substring(7),
            sender: currentUser.id,
            name: currentUser.full_name,
            avatar: currentUser.avatar_url,
            content,
            timestamp: new Date().toISOString()
        }

        // Optimistic update
        setMessages(prev => [...prev, msg])

        // Broadcast
        sendSignal('everyone', { type: 'chat', ...msg }, currentUser.id)

        // Save to DB
        try {
            await supabase.from('meeting_messages').insert({
                meeting_id: meetingId,
                sender_id: currentUser.id,
                sender_name: currentUser.full_name,
                sender_avatar: currentUser.avatar_url,
                content: content
            })
        } catch (err) {
            console.error('Error saving meeting message:', err)
        }
    }
    const muteParticipant = (userId: string) => sendSignal(userId, { type: 'command', action: 'mute' }, currentUser.id)
    
    const kickParticipant = async (userId: string) => {
        // Security check
        const isHost = meeting?.host_id === currentUser?.id || currentUser?.role?.toLowerCase() === 'administrator'
        if (!isHost) return

        console.log('[CallProvider] Kicking participant:', userId)
        await sendSignal(userId, { type: 'command', action: 'kick' }, currentUser.id)
        handleParticipantLeave(userId) // Optimistic UI
    }

    const blockParticipant = async (userId: string) => {
        const isHost = meeting?.host_id === currentUser?.id || currentUser?.role?.toLowerCase() === 'administrator'
        if (!isHost) return

        console.log('[CallProvider] Blocking participant:', userId)
        blockedUsersRef.current.add(userId)
        setBlockedUsers(new Set(blockedUsersRef.current))
        
        await sendSignal(userId, { type: 'command', action: 'block' }, currentUser.id)
        handleParticipantLeave(userId)
    }

    const kickParticipantRefactored = (userId: string) => kickParticipant(userId)

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
            muteParticipant, kickParticipant, blockParticipant, blockedUsers, toggleRaiseHand, sendReaction, handsRaised, endCall, isInCall,
            isMinimized, setIsMinimized
        }}>
            {children}
        </CallContext.Provider>
    )
}
