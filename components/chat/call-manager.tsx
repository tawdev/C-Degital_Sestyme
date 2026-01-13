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

    const configuration: RTCConfiguration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10
    }

    const broadcastSignal = (signal: string, from: string, to: string, payload: any = {}) => {
        console.log(`[CallManager] Signal: ${signal} -> ${to}`)
        channelRef.current?.send({
            type: 'broadcast',
            event: 'call-signal',
            payload: { signal, from, to, ...payload }
        })
    }

    useEffect(() => {
        console.log('[CallManager] Initializing signaling for User ID:', currentUser.id)

        const channel = supabase.channel('calls_v1', {
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
                        setCallState(prev => {
                            if (prev.status === 'calling') {
                                console.log('[CallManager] Remote accepted, sending offer')
                                sendOffer(from)
                                return prev
                            }
                            return prev
                        })
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
            .subscribe()

        channelRef.current = channel

        return () => {
            supabase.removeChannel(channel)
        }
    }, [currentUser.id])

    const setupPeerConnection = (otherUserId: string) => {
        console.log('[CallManager] Setting up RTCPeerConnection for:', otherUserId)
        const pc = new RTCPeerConnection(configuration)

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                broadcastSignal('ice-candidate', currentUser.id, otherUserId, { candidate: event.candidate })
            }
        }

        pc.ontrack = (event) => {
            console.log(`[CallManager] Remote ${event.track.kind} track received`)

            setRemoteStream(prev => {
                const stream = prev || new MediaStream()
                if (!stream.getTracks().find(t => t.id === event.track.id)) {
                    stream.addTrack(event.track)
                    console.log(`[CallManager] Added ${event.track.kind} track to remote stream`)
                }
                // Force a new MediaStream object to trigger React update
                return new MediaStream(stream.getTracks())
            })

            if (event.streams[0]) {
                remoteStreamRef.current = event.streams[0]
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
                cleanupCall()
            }
        }

        peerConnection.current = pc
        return pc
    }

    const startCall = async (recipientId: string, recipientName: string, recipientAvatar: string | null, type: 'audio' | 'video') => {
        try {
            console.log(`[CallManager] Starting ${type} call to:`, recipientId)
            cleanupCall()

            const stream = await navigator.mediaDevices.getUserMedia({
                video: type === 'video',
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            })

            console.log('[CallManager] Local stream tracks:', stream.getTracks().map(t => t.kind))
            localStreamRef.current = stream
            setLocalStream(stream)

            setCallState({
                isActive: true,
                isIncoming: false,
                type,
                caller: null,
                recipientId,
                status: 'calling'
            })

            broadcastSignal('initiate', currentUser.id, recipientId, {
                type,
                metadata: { name: currentUser.full_name, avatar: currentUser.avatar_url }
            })

            const pc = setupPeerConnection(recipientId)
            stream.getTracks().forEach(track => {
                console.log(`[CallManager] Adding local ${track.kind} track to PC`)
                pc.addTrack(track, stream)
            })

        } catch (err) {
            console.error('[CallManager] Failed to start call:', err)
            cleanupCall()
        }
    }

    const sendOffer = async (recipientId: string) => {
        const pc = peerConnection.current
        if (!pc) return
        try {
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            broadcastSignal('offer', currentUser.id, recipientId, { sdp: offer })
        } catch (err) {
            console.error('[CallManager] Error sending offer:', err)
        }
    }

    const handleOffer = async (payload: any) => {
        console.log('[CallManager] Handling WebRTC offer')
        let pc = peerConnection.current
        if (!pc) {
            pc = setupPeerConnection(payload.from)
            const stream = localStreamRef.current
            if (stream) {
                stream.getTracks().forEach(track => pc!.addTrack(track, stream))
            }
        }

        try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))

            while (pendingCandidates.current.length > 0) {
                const candidate = pendingCandidates.current.shift()
                await pc.addIceCandidate(new RTCIceCandidate(candidate!))
            }

            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            broadcastSignal('answer', currentUser.id, payload.from, { sdp: answer })
        } catch (err) {
            console.error('[CallManager] Error handling offer:', err)
        }
    }

    const handleAnswer = async (payload: any) => {
        const pc = peerConnection.current
        if (pc) {
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
                while (pendingCandidates.current.length > 0) {
                    const candidate = pendingCandidates.current.shift()
                    await pc.addIceCandidate(new RTCIceCandidate(candidate!))
                }
            } catch (err) {
                console.error('[CallManager] Error handling answer:', err)
            }
        }
    }

    const handleIceCandidate = async (payload: any) => {
        const pc = peerConnection.current
        if (pc && pc.remoteDescription) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
            } catch (e) {
                console.error('[CallManager] Error adding ice candidate', e)
            }
        } else {
            pendingCandidates.current.push(payload.candidate)
        }
    }

    const acceptCall = async () => {
        if (!callState.caller) return

        try {
            console.log('[CallManager] Accepting call...')
            const stream = await navigator.mediaDevices.getUserMedia({
                video: callState.type === 'video',
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            })

            console.log('[CallManager] Local stream tracks (Accept):', stream.getTracks().map(t => t.kind))
            localStreamRef.current = stream
            setLocalStream(stream)

            setCallState(prev => ({ ...prev, status: 'calling' }))
            broadcastSignal('accept', currentUser.id, callState.caller!.id)
        } catch (err) {
            console.error('[CallManager] Failed to accept call:', err)
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

        setCallState({
            isActive: false,
            isIncoming: false,
            type: 'video',
            caller: null,
            recipientId: null,
            status: 'idle'
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
