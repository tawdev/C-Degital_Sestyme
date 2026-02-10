'use client'

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import CallOverlay from '@/components/chat/call-overlay'
import { sendCallNotification } from '@/app/(main)/messages/actions'
import { logCall } from '@/app/(main)/chat/actions'

interface CallParticipant {
    id: string
    name: string
    avatar: string | null
    isCameraOff?: boolean
    isMuted?: boolean
}

interface CallState {
    isActive: boolean
    isIncoming: boolean
    type: 'audio' | 'video'
    caller: CallParticipant | null
    participants: CallParticipant[] // Including everyone (caller + recipients)
    status: 'idle' | 'calling' | 'ringing' | 'connected' | 'ended'
    videoUpgradeRequest: null | 'pending' | 'accepted' | 'rejected'
    videoUpgradeInitiator: string | null
    conversationId: string | null
}

interface CallContextType {
    startCall: (conversationId: string, recipientId: string, recipientName: string, recipientAvatar: string | null, type: 'audio' | 'video') => void
    inviteParticipant: (userId: string, userName: string, userAvatar: string | null) => void
    acceptCall: () => void
    rejectCall: () => void
    endCall: () => void
    callState: CallState
    toggleMute: () => void
    toggleCamera: () => void
    isMuted: boolean
    isCameraOff: boolean
    requestVideoUpgrade: () => void
    acceptVideoUpgrade: () => void
    rejectVideoUpgrade: () => void
}

const CallContext = createContext<CallContextType | undefined>(undefined)

export function CallProvider({ children, currentUser }: { children: React.ReactNode; currentUser: { id: string; full_name: string; avatar_url: string | null } }) {
    const [callState, setCallState] = useState<CallState>({
        isActive: false,
        isIncoming: false,
        type: 'video',
        caller: null,
        participants: [],
        status: 'idle',
        videoUpgradeRequest: null,
        videoUpgradeInitiator: null,
        conversationId: null
    })

    // Call Logging Refs
    const callStartTimeRef = useRef<number | null>(null)
    const callAnswerTimeRef = useRef<number | null>(null)
    const callConversationIdRef = useRef<string | null>(null)

    const ringtoneRef = useRef<HTMLAudioElement | null>(null)
    const notificationRef = useRef<Notification | null>(null)
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)
    const [needsInteraction, setNeedsInteraction] = useState(false)

    const [isMuted, setIsMuted] = useState(false)
    const [isCameraOff, setIsCameraOff] = useState(false)
    const [localStream, setLocalStream] = useState<MediaStream | null>(null)
    const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({})
    const localStreamRef = useRef<MediaStream | null>(null)
    const remoteStreamsRef = useRef<Record<string, MediaStream>>({})

    const supabase = createClient()
    const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map())
    const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
    const channelRef = useRef<any>(null)

    // Perfect Negotiation Refs (Per Connection)
    const makingOffer = useRef<Map<string, boolean>>(new Map())
    const ignoreOffer = useRef<Map<string, boolean>>(new Map())
    const isPolite = useRef<Map<string, boolean>>(new Map())
    const isSettingRemoteAnswerPending = useRef<Map<string, boolean>>(new Map())

    const statusRef = useRef(callState.status)
    const callStateRef = useRef(callState)

    useEffect(() => {
        statusRef.current = callState.status
        callStateRef.current = callState
    }, [callState])

    const configuration: RTCConfiguration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10
    }

    // Initialize Ringtone
    useEffect(() => {
        const ringtone = new Audio('/sounds/call.mp3')
        ringtone.loop = true
        ringtone.volume = 1.0
        ringtoneRef.current = ringtone

        // Interaction listener to "unlock" audio and play if pending
        const handleInteraction = () => {
            if (statusRef.current === 'ringing') {
                console.log('[CallManager] User interacted, attempting to play if needed')
                ringtone.play()
                    .then(() => setNeedsInteraction(false))
                    .catch(e => console.warn('[CallManager] Play after interaction failed:', e))
            }
        }

        window.addEventListener('click', handleInteraction, { once: true })
        window.addEventListener('touchstart', handleInteraction, { once: true })

        return () => {
            window.removeEventListener('click', handleInteraction)
            window.removeEventListener('touchstart', handleInteraction)
            ringtone.pause()
            ringtone.currentTime = 0
            ringtoneRef.current = null
        }
    }, []) // Run once on mount

    const playRingtone = () => {
        if (ringtoneRef.current) {
            // Safeguard: Don't play if already in a call or already connecting
            if (statusRef.current === 'connected' || statusRef.current === 'calling') {
                console.log('[CallManager] Already in call, skipping ringtone')
                return
            }

            console.log('[CallManager] Attempting to play ringtone')
            ringtoneRef.current.currentTime = 0
            ringtoneRef.current.play().catch(err => {
                console.warn('[CallManager] Autoplay blocked, waiting for interaction:', err)
                setNeedsInteraction(true)
            })
        }
    }

    const stopRingtone = () => {
        if (ringtoneRef.current) {
            console.log('[CallManager] Stopping ringtone')
            ringtoneRef.current.pause()
            ringtoneRef.current.currentTime = 0
            setNeedsInteraction(false)
        }
    }

    const showNotification = (callerName: string, type: string) => {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const notification = new Notification(`Appel ${type} entrant`, {
                body: `${callerName} vous appelle...`,
                icon: '/favicon.ico',
                tag: 'incoming-call',
                requireInteraction: true
            })

            notification.onclick = () => {
                window.focus()
                notification.close()
            }

            notificationRef.current = notification
        }
    }

    const hideNotification = () => {
        if (notificationRef.current) {
            notificationRef.current.close()
            notificationRef.current = null
        }
    }

    const broadcastSignal = useCallback((signal: string, from: string, to: string | string[], payload: any = {}) => {
        if (!channelRef.current) return
        const recipients = Array.isArray(to) ? to : [to]
        recipients.forEach(targetId => {
            channelRef.current.send({
                type: 'broadcast',
                event: 'call-signal',
                payload: { signal, from, to: targetId, ...payload }
            })
        })
    }, [])

    const broadcastStatus = useCallback(() => {
        const state = callStateRef.current
        if (!state.isActive || state.status !== 'connected') return
        const targets = state.participants.filter((p: CallParticipant) => p.id !== currentUser.id).map((p: CallParticipant) => p.id)
        if (targets.length > 0) {
            broadcastSignal('status-update', currentUser.id, targets, {
                isMuted, isCameraOff
            })
        }
    }, [currentUser.id, broadcastSignal, isMuted, isCameraOff])

    useEffect(() => {
        if (callState.status === 'connected') broadcastStatus()
    }, [isMuted, isCameraOff, callState.status, broadcastStatus])

    const addVideoTrackToCall = useCallback(async () => {
        try {
            if (localStreamRef.current?.getVideoTracks().length! > 0) return
            const videoStream = await navigator.mediaDevices.getUserMedia({ video: true })
            const videoTrack = videoStream.getVideoTracks()[0]
            if (!videoTrack) return

            const currentStream = localStreamRef.current || new MediaStream()
            currentStream.addTrack(videoTrack)
            localStreamRef.current = currentStream
            setLocalStream(new MediaStream(currentStream.getTracks()))

            peerConnections.current.forEach(pc => pc.addTrack(videoTrack, currentStream))
            setCallState(prev => ({ ...prev, type: 'video', videoUpgradeRequest: null }))
        } catch (err) { console.error('[CallManager] Video track add failed:', err) }
    }, [])

    const cleanupCall = useCallback(() => {
        console.log('[CallManager] Cleaning up call')
        stopRingtone()
        hideNotification()
        if (timeoutRef.current) clearTimeout(timeoutRef.current)

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop())
        }

        peerConnections.current.forEach(pc => pc.close())
        peerConnections.current.clear()

        setIsMuted(false)
        setIsCameraOff(false)
        setLocalStream(null)
        setRemoteStreams({})
        localStreamRef.current = null
        remoteStreamsRef.current = {}

        makingOffer.current.clear()
        ignoreOffer.current.clear()
        isPolite.current.clear()
        pendingCandidates.current.clear()
        isSettingRemoteAnswerPending.current.clear()

        setCallState({
            isActive: false, isIncoming: false, type: 'video', caller: null, participants: [], status: 'idle',
            videoUpgradeRequest: null, videoUpgradeInitiator: null, conversationId: null
        })
    }, [stopRingtone])

    const logCallAttempt = useCallback(async (status: 'answered' | 'missed' | 'rejected', duration: number = 0) => {
        if (!callStartTimeRef.current || !callConversationIdRef.current) return
        try {
            const state = callStateRef.current
            const callerId = state.isIncoming ? state.caller?.id : currentUser.id
            const receiverId = state.participants.find((p: CallParticipant) => p.id !== currentUser.id && p.id !== state.caller?.id)?.id
                || state.participants.find((p: CallParticipant) => p.id !== currentUser.id)?.id

            if (callerId && receiverId) {
                await logCall({
                    conversationId: callConversationIdRef.current, callerId, receiverId, type: state.type,
                    status: status === 'rejected' ? 'missed' : status, duration,
                    startedAt: new Date(callStartTimeRef.current).toISOString(),
                    endedAt: new Date().toISOString()
                })
            }
        } catch (err) { console.error('[CallManager] Failed to log call:', err) }
    }, [currentUser.id])

    const setupPeerConnection = useCallback((otherUserId: string, polite: boolean) => {
        if (peerConnections.current.has(otherUserId)) peerConnections.current.get(otherUserId)?.close()
        const pc = new RTCPeerConnection(configuration)
        isPolite.current.set(otherUserId, polite)

        pc.onicecandidate = ({ candidate }) => {
            if (candidate) broadcastSignal('ice-candidate', currentUser.id, otherUserId, { candidate })
        }

        pc.ontrack = (event) => {
            setRemoteStreams(prev => {
                const stream = prev[otherUserId] || new MediaStream()
                if (!stream.getTracks().find(t => t.id === event.track.id)) stream.addTrack(event.track)
                const newStreams = { ...prev, [otherUserId]: new MediaStream(stream.getTracks()) }
                remoteStreamsRef.current = newStreams
                return newStreams
            })
        }

        pc.onnegotiationneeded = async () => {
            try {
                makingOffer.current.set(otherUserId, true)
                const offer = await pc.createOffer()
                if (pc.signalingState !== 'stable') return
                await pc.setLocalDescription(offer)
                broadcastSignal('offer', currentUser.id, otherUserId, { sdp: pc.localDescription })
            } catch (err) { console.error(`[CallManager] Negotiation error for ${otherUserId}:`, err) }
            finally { makingOffer.current.set(otherUserId, false) }
        }

        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                setCallState(prev => prev.status !== 'connected' ? { ...prev, status: 'connected' } : prev)
            }
        }

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                setTimeout(() => {
                    if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                        setCallState(prev => ({ ...prev, participants: prev.participants.filter((p: CallParticipant) => p.id !== otherUserId) }))
                        pc.close()
                        peerConnections.current.delete(otherUserId)
                        setRemoteStreams(prev => {
                            const newStreams = { ...prev }; delete newStreams[otherUserId]
                            remoteStreamsRef.current = newStreams
                            return newStreams
                        })
                        if (peerConnections.current.size === 0) cleanupCall()
                    }
                }, 3000)
            }
        }

        peerConnections.current.set(otherUserId, pc)
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!))
        }
        return pc
    }, [currentUser.id, broadcastSignal, cleanupCall])

    const handleOffer = useCallback(async (payload: any) => {
        const from = payload.from
        let pc = peerConnections.current.get(from) || setupPeerConnection(from, true)
        const description = new RTCSessionDescription(payload.sdp)
        const readyForOffer = !makingOffer.current.get(from) && (pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer')
        ignoreOffer.current.set(from, !isPolite.current.get(from) && !readyForOffer)
        if (ignoreOffer.current.get(from)) return

        try {
            if (pc.signalingState !== 'stable') await pc.setLocalDescription({ type: 'rollback' })
            await pc.setRemoteDescription(description)
            const candidates = pendingCandidates.current.get(from) || []
            if (candidates.length > 0) {
                await Promise.all(candidates.map(c => pc!.addIceCandidate(new RTCIceCandidate(c))))
                pendingCandidates.current.set(from, [])
            }
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            broadcastSignal('answer', currentUser.id, from, { sdp: pc.localDescription })
        } catch (err) { console.error(`[CallManager] Handle offer error for ${from}:`, err) }
    }, [currentUser.id, broadcastSignal, setupPeerConnection])

    const handleAnswer = useCallback(async (payload: any) => {
        const from = payload.from
        const pc = peerConnections.current.get(from)
        if (!pc || pc.signalingState !== 'have-local-offer' || isSettingRemoteAnswerPending.current.get(from)) return
        try {
            isSettingRemoteAnswerPending.current.set(from, true)
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
            const candidates = pendingCandidates.current.get(from) || []
            if (candidates.length > 0) {
                await Promise.all(candidates.map(c => pc!.addIceCandidate(new RTCIceCandidate(c))))
                pendingCandidates.current.set(from, [])
            }
        } catch (err) { console.error(`[CallManager] Handle answer error for ${from}:`, err) }
        finally { isSettingRemoteAnswerPending.current.set(from, false) }
    }, [])

    const handleIceCandidate = useCallback(async (payload: any) => {
        const from = payload.from
        const pc = peerConnections.current.get(from)
        if (!payload.candidate) return
        if (!pc || !pc.remoteDescription) {
            const candidates = pendingCandidates.current.get(from) || []
            pendingCandidates.current.set(from, [...candidates, payload.candidate])
            return
        }
        try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)) }
        catch (err) { console.error(`[CallManager] ICE candidate error from ${from}:`, err) }
    }, [])

    useEffect(() => {
        const channel = supabase.channel('calls_v5', { config: { broadcast: { ack: true } } })
            .on('broadcast', { event: 'call-signal' }, async ({ payload }: { payload: any }) => {
                const { signal, from, to, type, metadata } = payload
                if (to !== currentUser.id) return
                switch (signal) {
                    case 'initiate':
                        setCallState(prev => {
                            if (prev.isActive) { broadcastSignal('busy', currentUser.id, from); return prev }
                            playRingtone(); showNotification(metadata.name, type)
                            if (timeoutRef.current) clearTimeout(timeoutRef.current)
                            timeoutRef.current = setTimeout(() => rejectCall(), 45000)
                            const callerInfo = { id: from, name: metadata.name, avatar: metadata.avatar }
                            return {
                                isActive: true, isIncoming: true, type, caller: callerInfo,
                                participants: [
                                    { ...callerInfo, isMuted: metadata.isMuted, isCameraOff: metadata.isCameraOff },
                                    { id: currentUser.id, name: currentUser.full_name, avatar: currentUser.avatar_url, isMuted, isCameraOff }
                                ],
                                status: 'ringing', videoUpgradeRequest: null, videoUpgradeInitiator: null, conversationId: payload.conversationId
                            }
                        })
                        callConversationIdRef.current = payload.conversationId; callStartTimeRef.current = Date.now(); callAnswerTimeRef.current = null
                        break
                    case 'invite':
                        setCallState(prev => {
                            if (prev.isActive) return prev
                            playRingtone(); showNotification(metadata.name, type)
                            const inviter = { id: from, name: metadata.name, avatar: metadata.avatar }
                            return {
                                isActive: true, isIncoming: true, type, caller: inviter, participants: [...metadata.participants],
                                status: 'ringing', videoUpgradeRequest: null, videoUpgradeInitiator: null, conversationId: payload.conversationId
                            }
                        })
                        callConversationIdRef.current = payload.conversationId; callStartTimeRef.current = Date.now(); callAnswerTimeRef.current = null
                        break
                    case 'join':
                        stopRingtone() // Stop if ringing and someone else joins first
                        const joiner = {
                            id: from, name: metadata.name, avatar: metadata.avatar,
                            isMuted: metadata.isMuted, isCameraOff: metadata.isCameraOff
                        }
                        setCallState(prev => ({
                            ...prev,
                            participants: prev.participants.some(p => p.id === from)
                                ? prev.participants.map(p => p.id === from ? { ...p, ...joiner } : p)
                                : [...prev.participants, joiner]
                        }))
                        if (statusRef.current === 'connected') setupPeerConnection(from, false)
                        break
                    case 'accept':
                        stopRingtone()
                        if (timeoutRef.current) clearTimeout(timeoutRef.current)
                        setCallState(prev => ({
                            ...prev,
                            participants: prev.participants.some(p => p.id === from)
                                ? prev.participants.map(p => p.id === from ? { ...p, isMuted: metadata.isMuted, isCameraOff: metadata.isCameraOff } : p)
                                : [...prev.participants, { id: from, name: metadata.name, avatar: metadata.avatar, isMuted: metadata.isMuted, isCameraOff: metadata.isCameraOff }]
                        }))
                        setupPeerConnection(from, false)
                        break
                    case 'status-update':
                        setCallState(prev => ({
                            ...prev,
                            participants: prev.participants.map(p => p.id === from ? { ...p, isMuted: payload.isMuted, isCameraOff: payload.isCameraOff } : p)
                        }))
                        break
                    case 'offer': await handleOffer(payload); break
                    case 'answer': await handleAnswer(payload); break
                    case 'ice-candidate': await handleIceCandidate(payload); break
                    case 'video-upgrade-request':
                        if (statusRef.current === 'connected') setCallState(prev => ({ ...prev, videoUpgradeRequest: 'pending', videoUpgradeInitiator: from }))
                        break
                    case 'video-upgrade-response':
                        if (payload.accepted) addVideoTrackToCall()
                        else {
                            setCallState(prev => ({ ...prev, videoUpgradeRequest: 'rejected', videoUpgradeInitiator: null }))
                            setTimeout(() => setCallState(prev => ({ ...prev, videoUpgradeRequest: null })), 3000)
                        }
                        break
                    case 'reject': case 'busy':
                        stopRingtone()
                        if (callStateRef.current.participants.length <= 2) cleanupCall()
                        else {
                            setCallState(prev => ({
                                ...prev,
                                participants: prev.participants.filter(p => p.id !== from)
                            }))
                        }
                        break
                    case 'end':
                        stopRingtone()
                        const pc = peerConnections.current.get(from)
                        if (pc) {
                            pc.close()
                            peerConnections.current.delete(from)
                        }
                        setRemoteStreams(prev => {
                            const newStreams = { ...prev }; delete newStreams[from]
                            remoteStreamsRef.current = newStreams; return newStreams
                        })
                        setCallState(prev => {
                            const remaining = prev.participants.filter(p => p.id !== from)
                            if (remaining.length <= 1) {
                                // Close if only current user left after a delay
                                setTimeout(() => {
                                    if (callStateRef.current.participants.length <= 1) cleanupCall()
                                }, 1000)
                            }
                            return { ...prev, participants: remaining }
                        })
                        break
                }
            })
            .subscribe()
        channelRef.current = channel
        return () => { supabase.removeChannel(channel) }
    }, [currentUser.id, broadcastSignal, setupPeerConnection, handleOffer, handleAnswer, handleIceCandidate, cleanupCall])

    const startCall = useCallback(async (conversationId: string, recipientId: string, recipientName: string, recipientAvatar: string | null, type: 'audio' | 'video') => {
        try {
            cleanupCall()
            callConversationIdRef.current = conversationId; callStartTimeRef.current = Date.now()
            const stream = await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: { echoCancellation: true, noiseSuppression: true } })
            localStreamRef.current = stream; setLocalStream(stream)
            const recipientInfo = { id: recipientId, name: recipientName, avatar: recipientAvatar }
            setCallState({
                isActive: true, isIncoming: false, type, caller: null,
                participants: [
                    { id: currentUser.id, name: currentUser.full_name, avatar: currentUser.avatar_url, isMuted, isCameraOff },
                    recipientInfo
                ],
                status: 'calling', videoUpgradeRequest: null, videoUpgradeInitiator: null, conversationId
            })
            broadcastSignal('initiate', currentUser.id, recipientId, {
                type, conversationId,
                metadata: {
                    name: currentUser.full_name,
                    avatar: currentUser.avatar_url,
                    isMuted, isCameraOff
                }
            })
            sendCallNotification(recipientId, currentUser.full_name, type).catch(err => console.error('[CallManager] Push failed:', err))
        } catch (err) { console.error('[CallManager] Start call failed:', err); cleanupCall() }
    }, [currentUser, broadcastSignal, cleanupCall])

    const inviteParticipant = useCallback(async (userId: string, userName: string, userAvatar: string | null) => {
        const state = callStateRef.current
        if (!state.isActive || !localStreamRef.current) return

        console.log(`[CallManager] Inviting ${userName} to join the call`)
        const newUser = { id: userId, name: userName, avatar: userAvatar }

        const updatedParticipants = state.participants.some(p => p.id === userId)
            ? state.participants
            : [...state.participants, newUser]

        setCallState(prev => ({ ...prev, participants: updatedParticipants }))

        broadcastSignal('invite', currentUser.id, userId, {
            type: state.type,
            conversationId: state.conversationId,
            metadata: {
                name: currentUser.full_name,
                avatar: currentUser.avatar_url,
                participants: updatedParticipants
            }
        })

        sendCallNotification(userId, currentUser.full_name, state.type)
            .catch(err => console.error('[CallManager] Invite push failed:', err))
    }, [currentUser, broadcastSignal])

    const acceptCall = useCallback(async () => {
        const state = callStateRef.current
        if (!state.caller) return
        try {
            stopRingtone(); hideNotification()
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            const stream = await navigator.mediaDevices.getUserMedia({ video: state.type === 'video', audio: { echoCancellation: true, noiseSuppression: true } })
            localStreamRef.current = stream; setLocalStream(stream)
            setCallState(prev => ({
                ...prev,
                status: 'calling',
                participants: prev.participants.map(p => p.id === currentUser.id ? { ...p, isMuted, isCameraOff } : p)
            }))
            callAnswerTimeRef.current = Date.now()
            broadcastSignal('accept', currentUser.id, state.caller.id, {
                metadata: {
                    name: currentUser.full_name,
                    avatar: currentUser.avatar_url,
                    isMuted, isCameraOff
                }
            })

            // IMPORTANT: Broadcast join signal to everyone else in the call
            const others = state.participants.filter((p: CallParticipant) =>
                p.id !== currentUser.id && p.id !== state.caller?.id
            ).map((o: CallParticipant) => o.id)

            if (others.length > 0) {
                broadcastSignal('join', currentUser.id, others, {
                    metadata: {
                        name: currentUser.full_name,
                        avatar: currentUser.avatar_url,
                        isMuted, isCameraOff
                    }
                })
            }
        } catch (err) { console.error('[CallManager] Accept failed:', err); rejectCall() }
    }, [currentUser, broadcastSignal, cleanupCall, isMuted, isCameraOff])

    const rejectCall = useCallback(() => {
        const state = callStateRef.current
        if (state.caller) broadcastSignal('reject', currentUser.id, state.caller.id)
        cleanupCall()
        logCallAttempt('rejected')
    }, [currentUser.id, broadcastSignal, cleanupCall, logCallAttempt])

    const endCall = useCallback(() => {
        const state = callStateRef.current
        const targets = state.participants.filter((p: CallParticipant) => p.id !== currentUser.id).map((p: CallParticipant) => p.id)
        if (targets.length > 0) broadcastSignal('end', currentUser.id, targets)
        const duration = callAnswerTimeRef.current ? Math.floor((Date.now() - callAnswerTimeRef.current) / 1000) : 0
        logCallAttempt(callAnswerTimeRef.current ? 'answered' : 'missed', duration)
        cleanupCall()
    }, [currentUser.id, broadcastSignal, cleanupCall, logCallAttempt])

    const toggleMute = useCallback(() => {
        const audioTrack = localStreamRef.current?.getAudioTracks()[0]
        if (audioTrack) { audioTrack.enabled = !audioTrack.enabled; setIsMuted(!audioTrack.enabled) }
    }, [])

    const toggleCamera = useCallback(() => {
        const videoTrack = localStreamRef.current?.getVideoTracks()[0]
        if (videoTrack) { videoTrack.enabled = !videoTrack.enabled; setIsCameraOff(!videoTrack.enabled) }
    }, [])

    const requestVideoUpgrade = useCallback(() => {
        const state = callStateRef.current
        if (state.type !== 'audio' || state.status !== 'connected') return
        const targets = state.participants.filter((p: CallParticipant) => p.id !== currentUser.id).map((p: CallParticipant) => p.id)
        if (targets.length > 0) broadcastSignal('video-upgrade-request', currentUser.id, targets)
        setCallState(prev => ({ ...prev, videoUpgradeRequest: 'pending', videoUpgradeInitiator: currentUser.id }))
    }, [currentUser.id, broadcastSignal])

    const acceptVideoUpgrade = useCallback(async () => {
        const state = callStateRef.current
        if (!state.videoUpgradeInitiator) return
        await addVideoTrackToCall()
        broadcastSignal('video-upgrade-response', currentUser.id, state.videoUpgradeInitiator, { accepted: true })
        setCallState(prev => ({ ...prev, videoUpgradeRequest: 'accepted', videoUpgradeInitiator: null }))
    }, [currentUser.id, broadcastSignal, addVideoTrackToCall])

    const rejectVideoUpgrade = useCallback(() => {
        const state = callStateRef.current
        if (!state.videoUpgradeInitiator) return
        broadcastSignal('video-upgrade-response', currentUser.id, state.videoUpgradeInitiator, { accepted: false })
        setCallState(prev => ({ ...prev, videoUpgradeRequest: null, videoUpgradeInitiator: null }))
    }, [currentUser.id, broadcastSignal])

    return (
        <CallContext.Provider value={{
            startCall, inviteParticipant, acceptCall, rejectCall, endCall,
            callState, toggleMute, toggleCamera, isMuted, isCameraOff,
            requestVideoUpgrade, acceptVideoUpgrade, rejectVideoUpgrade
        }}>
            {children}
            {callState.isActive && (
                <CallOverlay
                    state={callState} localStream={localStream} remoteStreams={remoteStreams}
                    onEnd={endCall} onAccept={acceptCall} onReject={rejectCall}
                    onMute={toggleMute} onCamera={toggleCamera} isMuted={isMuted} isCameraOff={isCameraOff}
                    onRequestVideoUpgrade={requestVideoUpgrade} onAcceptVideoUpgrade={acceptVideoUpgrade} onRejectVideoUpgrade={rejectVideoUpgrade}
                    onInvite={inviteParticipant} currentUserId={currentUser.id}
                />
            )}
        </CallContext.Provider>
    )
}

export const useCall = () => {
    const context = useContext(CallContext)
    if (!context) throw new Error('useCall must be used within CallProvider')
    return context
}
