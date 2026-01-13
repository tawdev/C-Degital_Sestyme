'use client'

import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import CallOverlay from '@/components/chat/call-overlay'

interface CallState {
    isActive: boolean
    isIncoming: boolean
    type: 'audio' | 'video'
    caller: { id: string; name: string; avatar: string | null } | null
    recipientId: string | null
    status: 'idle' | 'calling' | 'ringing' | 'connected' | 'ended'
}

interface CallContextType {
    startCall: (recipientId: string, recipientName: string, recipientAvatar: string | null, type: 'audio' | 'video') => void
    acceptCall: () => void
    rejectCall: () => void
    endCall: () => void
    callState: CallState
    toggleMute: () => void
    toggleCamera: () => void
    isMuted: boolean
    isCameraOff: boolean
}

const CallContext = createContext<CallContextType | undefined>(undefined)

export function CallProvider({ children, currentUser }: { children: React.ReactNode; currentUser: { id: string; full_name: string; avatar_url: string | null } }) {
    const [callState, setCallState] = useState<CallState>({
        isActive: false,
        isIncoming: false,
        type: 'video',
        caller: null,
        recipientId: null,
        status: 'idle'
    })

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
    const isPolite = useRef(false) // Receiver is polite, Caller is impolite

    const configuration: RTCConfiguration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10
    }

    const broadcastSignal = (signal: string, from: string, to: string, payload: any = {}) => {
        console.log(`[CallManager] Sending ${signal} signal to ${to}`)
        channelRef.current?.send({
            type: 'broadcast',
            event: 'call-signal',
            payload: { signal, from, to, ...payload }
        })
    }

    useEffect(() => {
        const interval = setInterval(async () => {
            const { data } = await supabase.auth.getSession()
            if (!data.session) {
                console.warn('[CallManager] Session expired or invalid')
            }
        }, 300000) // 5 minutes

        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        console.log('[CallManager] Initializing signaling for User ID:', currentUser.id)

        const channel = supabase.channel('calls_v2', {
            config: {
                broadcast: { ack: true }
            }
        })
            .on('broadcast', { event: 'call-signal' }, async ({ payload }) => {
                const { signal, from, to, type, metadata } = payload
                if (to !== currentUser.id) return

                console.log(`[CallManager] Received ${signal} from ${from}`)

                switch (signal) {
                    case 'initiate':
                        setCallState(prev => {
                            if (prev.isActive) {
                                broadcastSignal('busy', currentUser.id, from)
                                return prev
                            }
                            return {
                                isActive: true,
                                isIncoming: true,
                                type,
                                caller: { id: from, name: metadata.name, avatar: metadata.avatar },
                                recipientId: currentUser.id,
                                status: 'ringing'
                            }
                        })
                        break

                    case 'accept':
                        // Only caller receives 'accept'
                        if (callState.status === 'calling') {
                            console.log('[CallManager] Remote accepted the call')
                            // Negotiation will be handled by onnegotiationneeded once we have tracks
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

                    case 'reject':
                    case 'busy':
                    case 'end':
                        cleanupCall()
                        break
                }
            })
            .subscribe((status) => {
                console.log('[CallManager] Signaling channel status:', status)
            })

        channelRef.current = channel

        return () => {
            supabase.removeChannel(channel)
        }
    }, [currentUser.id, callState.status])

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
                    console.log(`[CallManager] Added ${event.track.kind} track to remote stream`)
                }
                return new MediaStream(stream.getTracks())
            })

            if (event.streams[0]) {
                remoteStreamRef.current = event.streams[0]
            }
        }

        pc.onnegotiationneeded = async () => {
            try {
                makingOffer.current = true
                console.log('[CallManager] Creating offer...')
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
                setCallState(prev => prev.status !== 'connected' ? { ...prev, status: 'connected' } : prev)
            }
        }

        pc.onconnectionstatechange = () => {
            console.log('[CallManager] Connection State:', pc.connectionState)
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                cleanupCall()
            }
        }

        peerConnection.current = pc
        return pc
    }

    const startCall = async (recipientId: string, recipientName: string, recipientAvatar: string | null, type: 'audio' | 'video') => {
        try {
            console.log(`[CallManager] Starting ${type} call to ${recipientId}`)
            cleanupCall()

            const stream = await navigator.mediaDevices.getUserMedia({
                video: type === 'video',
                audio: { echoCancellation: true, noiseSuppression: true }
            })

            localStreamRef.current = stream
            setLocalStream(stream)

            setCallState({
                isActive: true, isIncoming: false, type, caller: null, recipientId, status: 'calling'
            })

            broadcastSignal('initiate', currentUser.id, recipientId, {
                type,
                metadata: { name: currentUser.full_name, avatar: currentUser.avatar_url }
            })

            const pc = setupPeerConnection(recipientId, false) // Caller is impolite
            stream.getTracks().forEach(track => pc.addTrack(track, stream))

        } catch (err) {
            console.error('[CallManager] Start call failed:', err)
            cleanupCall()
        }
    }

    const handleOffer = async (payload: any) => {
        const pc = peerConnection.current
        if (!pc) return

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

            // Add local tracks if we have any but haven't added them yet
            const stream = localStreamRef.current
            if (stream) {
                stream.getTracks().forEach(track => {
                    const senders = pc.getSenders()
                    if (!senders.find(s => s.track?.id === track.id)) {
                        pc.addTrack(track, stream)
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
        } catch (err) {
            console.error('[CallManager] Handle answer error:', err)
        }
    }

    const handleIceCandidate = async (payload: any) => {
        const pc = peerConnection.current
        if (!pc || !payload.candidate) return
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

            // Setup PC before sending 'accept' to ensure we are ready for the offer
            const pc = setupPeerConnection(callState.caller.id, true) // Receiver is polite
            stream.getTracks().forEach(track => pc.addTrack(track, stream))

            setCallState(prev => ({ ...prev, status: 'calling' }))
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
        const target = callState.isIncoming ? callState.caller?.id : callState.recipientId
        if (target) {
            broadcastSignal('end', currentUser.id, target)
        }
        cleanupCall()
    }

    const cleanupCall = () => {
        console.log('[CallManager] Cleaning up call')
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
        pendingCandidates.current = []
        makingOffer.current = false
        ignoreOffer.current = false
        isSettingRemoteAnswerPending.current = false

        setCallState({
            isActive: false, isIncoming: false, type: 'video', caller: null, recipientId: null, status: 'idle'
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

    return (
        <CallContext.Provider value={{
            startCall, acceptCall, rejectCall, endCall,
            callState, toggleMute, toggleCamera, isMuted, isCameraOff
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
