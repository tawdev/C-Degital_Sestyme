'use client'

import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import CallOverlay from '@/components/chat/call-overlay'
import { sendCallNotification } from '@/app/(main)/messages/actions'
import { logCall } from '@/app/(main)/chat/actions'

interface CallState {
    isActive: boolean
    isIncoming: boolean
    type: 'audio' | 'video'
    caller: { id: string; name: string; avatar: string | null } | null
    recipient: { id: string; name: string; avatar: string | null } | null
    status: 'idle' | 'calling' | 'ringing' | 'connected' | 'ended'
    videoUpgradeRequest: null | 'pending' | 'accepted' | 'rejected'
    videoUpgradeInitiator: string | null
    conversationId: string | null
}

interface CallContextType {
    startCall: (conversationId: string, recipientId: string, recipientName: string, recipientAvatar: string | null, type: 'audio' | 'video') => void
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
        recipient: null,
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
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
    const localStreamRef = useRef<MediaStream | null>(null)
    const remoteStreamRef = useRef<MediaStream | null>(null)

    const supabase = createClient()
    const peerConnection = useRef<RTCPeerConnection | null>(null)
    const pendingCandidates = useRef<RTCIceCandidateInit[]>([])
    const channelRef = useRef<any>(null)

    // Perfect Negotiation Refs
    const makingOffer = useRef(false)
    const ignoreOffer = useRef(false)
    const isSettingRemoteAnswerPending = useRef(false)
    const isPolite = useRef(false)

    const statusRef = useRef(callState.status)
    useEffect(() => {
        statusRef.current = callState.status
    }, [callState.status])

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
        // Using custom troll sound effect as requested
        const ringtone = new Audio('/sounds/ringtone_custom.mp3?v=500')
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
            ringtoneRef.current = null
        }
    }, []) // Run once on mount

    const playRingtone = () => {
        if (ringtoneRef.current) {
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

    const broadcastSignal = (signal: string, from: string, to: string, payload: any = {}) => {
        if (!channelRef.current) {
            console.error(`[CallManager] Cannot send ${signal}: Channel not initialized`)
            return
        }
        console.log(`[CallManager] Sending ${signal} signal to ${to}`)
        channelRef.current.send({
            type: 'broadcast',
            event: 'call-signal',
            payload: { signal, from, to, ...payload }
        })
    }

    // Stabilize signaling channel - do not depend on callState
    useEffect(() => {
        console.log('[CallManager] Initializing signaling for User ID:', currentUser.id)

        const channel = supabase.channel('calls_v2', {
            config: {
                broadcast: { ack: true }
            }
        })
            .on('broadcast', { event: 'call-signal' }, async ({ payload }: { payload: any }) => {
                const { signal, from, to, type, metadata } = payload
                if (to !== currentUser.id) return

                console.log(`[CallManager] Received ${signal} from ${from} (Current Status: ${statusRef.current})`)

                switch (signal) {
                    case 'initiate':
                        setCallState(prev => {
                            if (prev.isActive) {
                                broadcastSignal('busy', currentUser.id, from)
                                return prev
                            }

                            // Start Ringtone and Notification
                            playRingtone()
                            showNotification(metadata.name, type)

                            // Set auto-timeout (45 seconds)
                            if (timeoutRef.current) clearTimeout(timeoutRef.current)
                            timeoutRef.current = setTimeout(() => {
                                console.log('[CallManager] Call timed out')
                                rejectCall()
                            }, 45000)

                            return {
                                isActive: true,
                                isIncoming: true,
                                type: type as 'audio' | 'video',
                                caller: { id: from, name: metadata.name, avatar: metadata.avatar },
                                recipient: { id: currentUser.id, name: currentUser.full_name, avatar: currentUser.avatar_url },
                                status: 'ringing',
                                videoUpgradeRequest: null,
                                videoUpgradeInitiator: null,
                                conversationId: payload.conversationId
                            } as CallState
                        })

                        // Tracking for logging
                        callConversationIdRef.current = payload.conversationId
                        callStartTimeRef.current = Date.now()
                        callAnswerTimeRef.current = null
                        break

                    case 'accept':
                        stopRingtone()
                        hideNotification()
                        if (timeoutRef.current) clearTimeout(timeoutRef.current)

                        if (statusRef.current === 'calling') {
                            console.log('[CallManager] Remote accepted the call, starting WebRTC setup...')
                            callAnswerTimeRef.current = Date.now()
                            if (from) {
                                const pc = setupPeerConnection(from, false) // Caller is impolite
                                // Add tracks to trigger negotiation
                                const stream = localStreamRef.current
                                if (stream) {
                                    console.log('[CallManager] Adding local tracks to trigger negotiation')
                                    stream.getTracks().forEach(track => pc.addTrack(track, stream))
                                }
                            }
                        }
                        break

                    case 'offer':
                        await handleOffer(payload)
                        break

                    case 'answer':
                        await handleAnswer(payload)
                        break

                    case 'ice-candidate':
                        await handleIceCandidate(payload)
                        break

                    case 'upgrade-to-video-request':
                    case 'video-upgrade-request':
                        console.log('[CallManager] Received video upgrade request from', from)
                        setCallState(prev => ({
                            ...prev,
                            videoUpgradeRequest: 'pending',
                            videoUpgradeInitiator: from
                        }))
                        break

                    case 'upgrade-to-video-accept':
                    case 'upgrade-to-video-reject':
                    case 'video-upgrade-response':
                        const status = signal === 'upgrade-to-video-accept' ? 'accepted' :
                            signal === 'upgrade-to-video-reject' ? 'rejected' :
                                payload.status || (payload.accepted ? 'accepted' : 'rejected')

                        if (status === 'accepted' || status === 'accepted') {
                            console.log('[CallManager] Video upgrade accepted by remote user')
                            setCallState(prev => ({
                                ...prev,
                                videoUpgradeRequest: 'accepted'
                            }))
                            // Both sides need to add their video track
                            await addVideoTrackToCall()
                        } else {
                            console.log('[CallManager] Video upgrade rejected by remote user')
                            setCallState(prev => ({
                                ...prev,
                                videoUpgradeRequest: 'rejected',
                                videoUpgradeInitiator: null
                            }))
                            // Reset after 3 seconds
                            setTimeout(() => {
                                setCallState(prev => ({
                                    ...prev,
                                    videoUpgradeRequest: null
                                }))
                            }, 3000)
                        }
                        break

                    case 'reject':
                    case 'busy':
                    case 'end':
                        stopRingtone()
                        hideNotification()
                        if (timeoutRef.current) clearTimeout(timeoutRef.current)
                        cleanupCall()
                        break
                }
            })
            .subscribe((status: any) => {
                console.log('[CallManager] Signaling channel status:', status)
            })

        channelRef.current = channel

        // Heartbeat to keep session alive
        const interval = setInterval(async () => {
            const { data } = await supabase.auth.getSession()
            if (!data.session) console.warn('[CallManager] Session heartbeat: No session')
        }, 120000)

        return () => {
            console.log('[CallManager] Cleaning up signaling channel')
            clearInterval(interval)
            supabase.removeChannel(channel)
        }
    }, [currentUser.id])

    const setupPeerConnection = (otherUserId: string, polite: boolean) => {
        if (peerConnection.current) {
            console.log('[CallManager] Closing existing PeerConnection')
            peerConnection.current.close()
        }

        console.log(`[CallManager] Setting up PC for ${otherUserId} (Polite: ${polite})`)
        const pc = new RTCPeerConnection(configuration)
        isPolite.current = polite

        pc.onicecandidate = ({ candidate }) => {
            if (candidate) {
                broadcastSignal('ice-candidate', currentUser.id, otherUserId, { candidate })
            }
        }

        pc.ontrack = (event) => {
            console.log(`[CallManager] Remote ${event.track.kind} track received: ${event.track.id}`)
            setRemoteStream(prev => {
                const stream = prev || new MediaStream()
                if (!stream.getTracks().find(t => t.id === event.track.id)) {
                    stream.addTrack(event.track)
                }
                return new MediaStream(stream.getTracks())
            })
        }

        pc.onnegotiationneeded = async () => {
            try {
                makingOffer.current = true
                console.log('[CallManager] Negotiation needed: Creating offer...')
                const offer = await pc.createOffer()
                if (pc.signalingState !== 'stable') return

                await pc.setLocalDescription(offer)
                broadcastSignal('offer', currentUser.id, otherUserId, { sdp: pc.localDescription })
            } catch (err) {
                console.error('[CallManager] Negotiation needed error:', err)
            } finally {
                makingOffer.current = false
            }
        }

        pc.oniceconnectionstatechange = () => {
            console.log('[CallManager] ICE Connection State:', pc.iceConnectionState)
            if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                setCallState(prev => {
                    if (prev.status !== 'connected') {
                        console.log('[CallManager] Call linked and connected!')
                        return { ...prev, status: 'connected' }
                    }
                    return prev
                })
            }
        }

        pc.onconnectionstatechange = () => {
            console.log('[CallManager] Connection State:', pc.connectionState)
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                // Only cleanup if it stays failed for a bit, or if we are idle
                setTimeout(() => {
                    if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                        cleanupCall()
                    }
                }, 3000)
            }
        }

        peerConnection.current = pc
        return pc
    }

    const startCall = async (conversationId: string, recipientId: string, recipientName: string, recipientAvatar: string | null, type: 'audio' | 'video') => {
        try {
            console.log(`[CallManager] Starting ${type} call to ${recipientId} in convo ${conversationId}`)
            cleanupCall()

            // Reset tracking
            callConversationIdRef.current = conversationId
            callStartTimeRef.current = Date.now()
            callAnswerTimeRef.current = null

            const stream = await navigator.mediaDevices.getUserMedia({
                video: type === 'video',
                audio: { echoCancellation: true, noiseSuppression: true }
            })

            localStreamRef.current = stream
            setLocalStream(stream)

            setCallState({
                isActive: true,
                isIncoming: false,
                type: type as 'audio' | 'video',
                caller: null,
                recipient: { id: recipientId, name: recipientName, avatar: recipientAvatar },
                status: 'calling',
                videoUpgradeRequest: null,
                videoUpgradeInitiator: null,
                conversationId
            })

            // IMPORTANT: We do NOT setup PC here yet. 
            // We wait for the 'accept' signal to ensure the other side is ready.
            broadcastSignal('initiate', currentUser.id, recipientId, {
                type,
                conversationId,
                metadata: { name: currentUser.full_name, avatar: currentUser.avatar_url }
            })

            // Also trigger Persistent Push Notification
            sendCallNotification(recipientId, currentUser.full_name, type)
                .catch(err => console.error('[CallManager] Push notification trigger failed:', err))

        } catch (err) {
            console.error('[CallManager] Start call failed:', err)
            cleanupCall()
        }
    }

    const handleOffer = async (payload: any) => {
        let pc = peerConnection.current

        // If no PC exists, we are likely a receiver who just clicked accept or just received an offer
        if (!pc) {
            console.log('[CallManager] Offer received while PC null. Creating PC as Polite...')
            pc = setupPeerConnection(payload.from, true)
        }

        const description = new RTCSessionDescription(payload.sdp)
        const readyForOffer = !makingOffer.current && (pc.signalingState === 'stable' || isSettingRemoteAnswerPending.current)
        const offerCollision = !readyForOffer

        ignoreOffer.current = !isPolite.current && offerCollision
        if (ignoreOffer.current) {
            console.log('[CallManager] Ignoring colliding offer (Impolite)')
            return
        }

        try {
            console.log('[CallManager] Setting remote description (Offer)')
            await pc.setRemoteDescription(description)

            // Process queued candidates
            if (pendingCandidates.current.length > 0) {
                console.log(`[CallManager] Processing ${pendingCandidates.current.length} queued candidates`)
                await Promise.all(pendingCandidates.current.map(c => pc!.addIceCandidate(new RTCIceCandidate(c))))
                pendingCandidates.current = []
            }
            // Add local tracks if we have them
            const stream = localStreamRef.current
            if (stream) {
                stream.getTracks().forEach(track => {
                    const senders = pc!.getSenders()
                    if (!senders.find(s => s.track?.id === track.id)) {
                        pc!.addTrack(track, stream)
                    }
                })
            }

            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            broadcastSignal('answer', currentUser.id, payload.from, { sdp: pc.localDescription })
        } catch (err) {
            console.error('[CallManager] Handle offer error:', err)
        }
    }

    const handleAnswer = async (payload: any) => {
        const pc = peerConnection.current
        if (!pc) return
        try {
            console.log('[CallManager] Setting remote description (Answer)')
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))

            // Process queued candidates
            if (pendingCandidates.current.length > 0) {
                console.log(`[CallManager] Processing ${pendingCandidates.current.length} queued candidates`)
                await Promise.all(pendingCandidates.current.map(c => pc!.addIceCandidate(new RTCIceCandidate(c))))
                pendingCandidates.current = []
            }
        } catch (err) {
            console.error('[CallManager] Handle answer error:', err)
        }
    }

    const handleIceCandidate = async (payload: any) => {
        const pc = peerConnection.current
        if (!payload.candidate) return

        if (!pc || !pc.remoteDescription) {
            console.log('[CallManager] Queuing ICE candidate (PC or RemoteDescription not ready)')
            pendingCandidates.current.push(payload.candidate)
            return
        }

        try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
        } catch (err) {
            if (!ignoreOffer.current) {
                console.error('[CallManager] Handle ICE candidate error:', err)
            }
        }
    }

    const acceptCall = async () => {
        if (!callState.caller) return

        try {
            console.log('[CallManager] Accepting call...')
            const stream = await navigator.mediaDevices.getUserMedia({
                video: callState.type === 'video',
                audio: { echoCancellation: true, noiseSuppression: true }
            })

            localStreamRef.current = stream
            setLocalStream(stream)

            // Setup PC immediately on accept
            const pc = setupPeerConnection(callState.caller.id, true) // Receiver is polite
            stream.getTracks().forEach(track => pc.addTrack(track, stream))

            stopRingtone()
            hideNotification()
            if (timeoutRef.current) clearTimeout(timeoutRef.current)

            setCallState(prev => ({ ...prev, status: 'calling' }))
            callAnswerTimeRef.current = Date.now()
            broadcastSignal('accept', currentUser.id, callState.caller!.id)
        } catch (err) {
            console.error('[CallManager] Accept call failed:', err)
            rejectCall()
        }
    }

    const rejectCall = () => {
        if (callState.caller) {
            broadcastSignal('reject', currentUser.id, callState.caller.id)
        }
        cleanupCall()
    }

    const endCall = () => {
        stopRingtone()
        hideNotification()
        if (timeoutRef.current) clearTimeout(timeoutRef.current)

        const target = callState.isIncoming ? callState.caller?.id : callState.recipient?.id
        if (target) {
            broadcastSignal('end', currentUser.id, target)
        }
        cleanupCall()
    }

    const cleanupCall = () => {
        console.log('[CallManager] Cleaning up call')
        stopRingtone()
        hideNotification()
        if (timeoutRef.current) clearTimeout(timeoutRef.current)

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop())
        }
        if (peerConnection.current) {
            peerConnection.current.close()
        }

        setLocalStream(null)
        setRemoteStream(null)
        localStreamRef.current = null
        remoteStreamRef.current = null
        peerConnection.current = null
        makingOffer.current = false
        ignoreOffer.current = false
        isSettingRemoteAnswerPending.current = false
        pendingCandidates.current = []

        // --- LOGGING LOGIC ---
        if (callStartTimeRef.current && callConversationIdRef.current) {
            const now = Date.now()
            const startedAt = new Date(callStartTimeRef.current).toISOString()
            const endedAt = new Date(now).toISOString()

            const wasConnected = callAnswerTimeRef.current !== null || statusRef.current === 'connected'
            const status = wasConnected ? 'answered' : 'missed'
            const duration = wasConnected ? Math.floor((now - (callAnswerTimeRef.current || callStartTimeRef.current)) / 1000) : 0

            const callerId = callState.isIncoming ? callState.caller?.id : currentUser.id
            const receiverId = callState.isIncoming ? currentUser.id : callState.recipient?.id

            if (callerId && receiverId) {
                console.log(`[CallManager] Logging call: ${status}, duration: ${duration}s`)
                logCall({
                    conversationId: callConversationIdRef.current,
                    callerId,
                    receiverId,
                    type: callState.type,
                    status,
                    duration,
                    startedAt,
                    endedAt
                }).catch(err => console.error('[CallManager] Failed to log call:', err))
            }
        }

        // Reset tracking
        callStartTimeRef.current = null
        callAnswerTimeRef.current = null
        callConversationIdRef.current = null
        // --- END LOGGING ---

        setCallState({
            isActive: false, isIncoming: false, type: 'video', caller: null, recipient: null, status: 'idle',
            videoUpgradeRequest: null,
            videoUpgradeInitiator: null,
            conversationId: null
        })
        setIsMuted(false)
        setIsCameraOff(false)
    }

    const toggleMute = () => {
        const stream = localStreamRef.current
        if (stream) {
            const audioTrack = stream.getAudioTracks()[0]
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled
                setIsMuted(!audioTrack.enabled)
            }
        }
    }

    const toggleCamera = () => {
        const stream = localStreamRef.current
        if (stream) {
            const videoTrack = stream.getVideoTracks()[0]
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled
                setIsCameraOff(!videoTrack.enabled)
            }
        }
    }

    // Video Upgrade Functions
    const requestVideoUpgrade = () => {
        if (callState.type !== 'audio' || callState.status !== 'connected') {
            console.warn('[CallManager] Cannot request video upgrade: not in audio call or not connected')
            return
        }

        const target = callState.isIncoming ? callState.caller?.id : callState.recipient?.id
        if (!target) return

        console.log('[CallManager] Requesting video upgrade')
        setCallState(prev => ({
            ...prev,
            videoUpgradeRequest: 'pending',
            videoUpgradeInitiator: currentUser.id
        }))

        broadcastSignal('video-upgrade-request', currentUser.id, target)
        // Also send old name for compatibility with non-refreshed clients
        setTimeout(() => broadcastSignal('upgrade-to-video-request', currentUser.id, target), 100)
    }

    const acceptVideoUpgrade = async () => {
        if (!callState.videoUpgradeInitiator) return

        try {
            console.log('[CallManager] Accepting video upgrade request')

            // 1. First add our own video track
            await addVideoTrackToCall()

            // 2. Notify the requester that we accepted
            broadcastSignal('video-upgrade-response', currentUser.id, callState.videoUpgradeInitiator, { accepted: true })

            // 3. Update local state
            setCallState(prev => ({
                ...prev,
                videoUpgradeRequest: 'accepted',
                videoUpgradeInitiator: null
            }))
        } catch (err) {
            console.error('[CallManager] Accept video upgrade failed:', err)
            rejectVideoUpgrade()
        }
    }

    const rejectVideoUpgrade = () => {
        if (!callState.videoUpgradeInitiator) return

        console.log('[CallManager] Rejecting video upgrade request')
        broadcastSignal('video-upgrade-response', currentUser.id, callState.videoUpgradeInitiator, { accepted: false })

        setCallState(prev => ({
            ...prev,
            videoUpgradeRequest: null,
            videoUpgradeInitiator: null
        }))
    }

    const addVideoTrackToCall = async () => {
        try {
            console.log('[CallManager] Attempting to add video track to existing call')

            // Check if we already have a video track active to avoid duplicates
            if (localStreamRef.current?.getVideoTracks().length! > 0) {
                console.log('[CallManager] Video track already exists, skipping getUserMedia')
                return
            }

            const videoStream = await navigator.mediaDevices.getUserMedia({
                video: true
            })

            const videoTrack = videoStream.getVideoTracks()[0]
            if (!videoTrack) throw new Error('No video track obtained')

            // Update local stream and ref
            const currentStream = localStreamRef.current || new MediaStream()
            currentStream.addTrack(videoTrack)
            localStreamRef.current = currentStream
            setLocalStream(new MediaStream(currentStream.getTracks()))

            // Add track to PeerConnection
            if (peerConnection.current) {
                console.log('[CallManager] Adding track to RTCPeerConnection')
                peerConnection.current.addTrack(videoTrack, currentStream)
                // This triggers onnegotiationneeded automatically
            }

            setCallState(prev => ({
                ...prev,
                type: 'video',
                videoUpgradeRequest: null
            }))

            console.log('[CallManager] Video track added and call type updated to video')
        } catch (err) {
            console.error('[CallManager] Error in addVideoTrackToCall:', err)
            throw err
        }
    }

    return (
        <CallContext.Provider value={{
            startCall, acceptCall, rejectCall, endCall,
            callState, toggleMute, toggleCamera, isMuted, isCameraOff,
            requestVideoUpgrade, acceptVideoUpgrade, rejectVideoUpgrade
        }}>
            {children}
            {callState.isActive && (
                <CallOverlay
                    state={callState}
                    localStream={localStream}
                    remoteStream={remoteStream}
                    onEnd={endCall}
                    onAccept={acceptCall}
                    onReject={rejectCall}
                    onMute={toggleMute}
                    onCamera={toggleCamera}
                    isMuted={isMuted}
                    isCameraOff={isCameraOff}
                    onRequestVideoUpgrade={requestVideoUpgrade}
                    onAcceptVideoUpgrade={acceptVideoUpgrade}
                    onRejectVideoUpgrade={rejectVideoUpgrade}
                    currentUserId={currentUser.id}
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
