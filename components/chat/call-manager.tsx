'use client'

import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import CallOverlay from './call-overlay'

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

    const supabase = createClient()
    const peerConnection = useRef<RTCPeerConnection | null>(null)
    const localStream = useRef<MediaStream | null>(null)
    const remoteStream = useRef<MediaStream | null>(null)
    const channelRef = useRef<any>(null)

    const configuration = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    }

    useEffect(() => {
        console.log('[CallManager] Initializing signaling for User ID:', currentUser.id)

        // Using a clean channel name
        const channel = supabase.channel('calls_v1', {
            config: {
                broadcast: { ack: true }
            }
        })
            .on('broadcast', { event: 'call-signal' }, async ({ payload }) => {
                const { signal, from, to, type, metadata } = payload

                // CRITICAL: Log every signal received
                console.log(`[CallManager] Received ${signal} from ${from} to ${to}. (Our ID: ${currentUser.id})`)

                if (to !== currentUser.id) {
                    return
                }

                console.log(`[CallManager] Signal accepted! Processing ${signal}...`)

                switch (signal) {
                    case 'initiate':
                        setCallState(prev => {
                            if (prev.isActive) {
                                console.log('[CallManager] Already in call, sending busy to:', from)
                                broadcastSignal('busy', currentUser.id, from)
                                return prev
                            }
                            console.log('[CallManager] Triggering incoming call UI for:', metadata.name)
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
                                console.log('[CallManager] Remote accepted, sending WebRTC offer')
                                sendOffer(from)
                                return { ...prev, status: 'connected' }
                            }
                            return prev
                        })
                        break

                    case 'offer':
                        console.log('[CallManager] Handling WebRTC offer')
                        await handleOffer(payload)
                        break

                    case 'answer':
                        console.log('[CallManager] Handling WebRTC answer')
                        await handleAnswer(payload)
                        break

                    case 'ice-candidate':
                        await handleIceCandidate(payload)
                        break

                    case 'reject':
                    case 'busy':
                    case 'end':
                        console.log(`[CallManager] Termination signal: ${signal}`)
                        cleanupCall()
                        break
                }
            })
            .subscribe((status) => {
                console.log('[CallManager] Signaling channel subscription status:', status)
            })

        channelRef.current = channel

        return () => {
            console.log('[CallManager] Cleaning up signaling sub')
            supabase.removeChannel(channel)
        }
    }, [currentUser.id])

    const broadcastSignal = (signal: string, from: string, to: string, payload: any = {}) => {
        console.log(`[CallManager] Broadcasting signal: ${signal} to: ${to}`)
        channelRef.current?.send({
            type: 'broadcast',
            event: 'call-signal',
            payload: { signal, from, to, ...payload }
        })
    }

    const startCall = async (recipientId: string, recipientName: string, recipientAvatar: string | null, type: 'audio' | 'video') => {
        try {
            console.log(`[CallManager] Starting ${type} call to:`, recipientId)
            cleanupCall()

            setCallState({
                isActive: true,
                isIncoming: false,
                type,
                caller: null,
                recipientId,
                status: 'calling'
            })

            const stream = await navigator.mediaDevices.getUserMedia({
                video: type === 'video',
                audio: true
            })
            localStream.current = stream

            broadcastSignal('initiate', currentUser.id, recipientId, {
                type,
                metadata: { name: currentUser.full_name, avatar: currentUser.avatar_url }
            })

            setupPeerConnection(recipientId)
            stream.getTracks().forEach(track => {
                if (localStream.current) peerConnection.current?.addTrack(track, localStream.current)
            })

        } catch (err) {
            console.error('[CallManager] Failed to start call:', err)
            cleanupCall()
        }
    }

    const sendOffer = async (recipientId: string) => {
        if (!peerConnection.current) return
        try {
            const offer = await peerConnection.current.createOffer()
            await peerConnection.current.setLocalDescription(offer)
            broadcastSignal('offer', currentUser.id, recipientId, { sdp: offer })
        } catch (err) {
            console.error('[CallManager] Error sending offer:', err)
        }
    }

    const setupPeerConnection = (otherUserId: string) => {
        console.log('[CallManager] Setting up RTCPeerConnection for:', otherUserId)
        const pc = new RTCPeerConnection(configuration)

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                broadcastSignal('ice-candidate', currentUser.id, otherUserId, { candidate: event.candidate })
            }
        }

        pc.ontrack = (event) => {
            console.log('[CallManager] Remote track received')
            remoteStream.current = event.streams[0]
            setCallState(prev => ({ ...prev }))
        }

        peerConnection.current = pc
    }

    const handleOffer = async (payload: any) => {
        if (!peerConnection.current) {
            setupPeerConnection(payload.from)
            localStream.current?.getTracks().forEach(track => {
                if (localStream.current) peerConnection.current?.addTrack(track, localStream.current)
            })
        }

        try {
            await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(payload.sdp))
            const answer = await peerConnection.current?.createAnswer()
            await peerConnection.current?.setLocalDescription(answer!)
            broadcastSignal('answer', currentUser.id, payload.from, { sdp: answer })
        } catch (err) {
            console.error('[CallManager] Error handling offer:', err)
        }
    }

    const handleAnswer = async (payload: any) => {
        if (peerConnection.current) {
            try {
                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.sdp))
            } catch (err) {
                console.error('[CallManager] Error handling answer:', err)
            }
        }
    }

    const handleIceCandidate = async (payload: any) => {
        if (peerConnection.current && peerConnection.current.remoteDescription) {
            try {
                await peerConnection.current.addIceCandidate(new RTCIceCandidate(payload.candidate))
            } catch (e) {
                console.error('[CallManager] Error adding ice candidate', e)
            }
        }
    }

    const acceptCall = async () => {
        if (!callState.caller) return

        try {
            console.log('[CallManager] Accepting call...')
            const stream = await navigator.mediaDevices.getUserMedia({
                video: callState.type === 'video',
                audio: true
            })
            localStream.current = stream

            setCallState(prev => ({ ...prev, status: 'connected' }))
            broadcastSignal('accept', currentUser.id, callState.caller!.id)
        } catch (err) {
            console.error('[CallManager] Failed to accept call:', err)
            rejectCall()
        }
    }

    const rejectCall = () => {
        if (callState.caller) {
            console.log('[CallManager] Rejecting call from:', callState.caller.id)
            broadcastSignal('reject', currentUser.id, callState.caller.id)
        }
        cleanupCall()
    }

    const endCall = () => {
        const target = callState.isIncoming ? callState.caller?.id : callState.recipientId
        if (target) {
            console.log('[CallManager] Ending call with:', target)
            broadcastSignal('end', currentUser.id, target)
        }
        cleanupCall()
    }

    const cleanupCall = () => {
        console.log('[CallManager] Cleaning up call state and stream')
        localStream.current?.getTracks().forEach(track => track.stop())
        if (peerConnection.current) {
            peerConnection.current.close()
        }

        localStream.current = null
        remoteStream.current = null
        peerConnection.current = null

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
        if (localStream.current) {
            const audioTrack = localStream.current.getAudioTracks()[0]
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled
                setIsMuted(!audioTrack.enabled)
            }
        }
    }

    const toggleCamera = () => {
        if (localStream.current) {
            const videoTrack = localStream.current.getVideoTracks()[0]
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
                    localStream={localStream.current}
                    remoteStream={remoteStream.current}
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
