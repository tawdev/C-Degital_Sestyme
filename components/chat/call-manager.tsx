'use client'

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import CallOverlay from '@/components/chat/call-overlay'
import { sendCallNotification } from '@/app/(main)/messages/actions'
import { logCall, saveCallRecording } from '@/app/(main)/chat/actions'
import { useAudio } from '@/context/audio-context'
import { useNotifications } from '@/context/notification-context'

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
    screenSharingUserId: string | null // ID of user currently sharing screen
    isScreenSharing: boolean // Is current user sharing screen
}

interface CallContextType {
    startCall: (conversationId: string, recipientId: string, recipientName: string, recipientAvatar: string | null, type: 'audio' | 'video') => void
    startGroupCall: (conversationId: string, members: Array<{ id: string; full_name: string; avatar_url: string | null }>, type: 'audio' | 'video') => void
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
    startScreenShare: () => void
    stopScreenShare: () => void
    kickParticipant: (userId: string) => void
    blockParticipant: (userId: string) => void
    blockedUsers: Set<string>
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
        conversationId: null,
        screenSharingUserId: null,
        isScreenSharing: false
    })

    const { playRingtone, stopRingtone } = useAudio()
    const { showNotification } = useNotifications()

    // Call Logging Refs
    const callStartTimeRef = useRef<number | null>(null)
    const callAnswerTimeRef = useRef<number | null>(null)
    const callConversationIdRef = useRef<string | null>(null)

    const timeoutRef = useRef<NodeJS.Timeout | null>(null)

    const [isMuted, setIsMuted] = useState(false)
    const [isCameraOff, setIsCameraOff] = useState(false)
    const [localStream, setLocalStream] = useState<MediaStream | null>(null)
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
    const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({})
    const localStreamRef = useRef<MediaStream | null>(null)
    const remoteStreamsRef = useRef<Record<string, MediaStream>>({})
    const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set())
    const blockedUsersRef = useRef<Set<string>>(new Set())
    const [recordingStatus, setRecordingStatus] = useState(false)

    // Screen sharing refs
    const screenStreamRef = useRef<MediaStream | null>(null)
    const [remoteScreenStreams, setRemoteScreenStreams] = useState<Record<string, MediaStream>>({})
    const remoteScreenStreamsRef = useRef<Record<string, MediaStream>>({})
    const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null) // Store original camera track

    const supabase = createClient()
    const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map())
    const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
    const channelRef = useRef<any>(null)

    // Perfect Negotiation Refs (Per Connection)
    const makingOffer = useRef<Map<string, boolean>>(new Map())
    const ignoreOffer = useRef<Map<string, boolean>>(new Map())
    const isPolite = useRef<Map<string, boolean>>(new Map())
    const isSettingRemoteAnswerPending = useRef<Map<string, boolean>>(new Map())
    const isRenegotiating = useRef<boolean>(false)
    const isRecording = useRef<boolean>(false)

    // Recording Refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const recordingChunksRef = useRef<Blob[]>([])
    const audioContextRef = useRef<AudioContext | null>(null)
    const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null)
    const audioSourcesRef = useRef<Map<string, MediaStreamAudioSourceNode>>(new Map())
    const recordCanvasRef = useRef<HTMLCanvasElement | null>(null)
    const requestRef = useRef<number | null>(null)
    const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map())

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

    // Emit call active status for Notification manager
    useEffect(() => {
        window.dispatchEvent(new CustomEvent('call-active-change', { detail: { active: callState.isActive } }))
    }, [callState.isActive])

    const hideNotification = useCallback(() => {
        // Handled by NotificationProvider on interaction or timeout
    }, [])

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

            // 🔔 FIX: Lock automatic negotiation to prevent glare
            isRenegotiating.current = true

            const currentStream = localStreamRef.current || new MediaStream()
            currentStream.addTrack(videoTrack)
            localStreamRef.current = currentStream
            setLocalStream(new MediaStream(currentStream.getTracks()))

            // 🔔 FIX: Explicit Renegotiation for Mesh Network
            // Iterate over all peers to add track AND trigger renegotiation
            await Promise.all(Array.from(peerConnections.current.entries()).map(async ([otherUserId, pc]) => {
                const senders = pc.getSenders()
                const existingSender = senders.find(s => s.track?.kind === 'video')

                if (existingSender) {
                    await existingSender.replaceTrack(videoTrack)
                } else {
                    pc.addTrack(videoTrack, currentStream)
                }

                // Create Offer for Renegotiation
                const offer = await pc.createOffer()
                await pc.setLocalDescription(offer)

                // Signal the specific peer
                broadcastSignal('video-renegotiation-offer', currentUser.id, otherUserId, { sdp: offer })
            }))

            setCallState(prev => ({ ...prev, type: 'video', videoUpgradeRequest: null }))
        } catch (err) { console.error('[CallManager] Video track add failed:', err) }
        finally {
            // Release lock after a short delay to allow signals to propagate
            setTimeout(() => { isRenegotiating.current = false }, 2000)
        }
    }, [currentUser.id, broadcastSignal])

    const addStreamToMixer = useCallback((uid: string, stream: MediaStream) => {
        if (!isRecording.current || !audioContextRef.current || !audioDestinationRef.current) return
        if (audioSourcesRef.current.has(uid)) return

        try {
            const ctx = audioContextRef.current
            const dest = audioDestinationRef.current
            const audioTracks = stream.getAudioTracks()

            if (audioTracks.length > 0) {
                console.log(`[CallManager] Adding ${uid} to audio mixer`)
                const source = ctx.createMediaStreamSource(new MediaStream([audioTracks[0]]))
                source.connect(dest)
                audioSourcesRef.current.set(uid, source)
            }
        } catch (err) {
            console.error(`[CallManager] Failed to add ${uid} to mixer:`, err)
        }
    }, [])

    const removeStreamFromMixer = useCallback((uid: string) => {
        const source = audioSourcesRef.current.get(uid)
        if (source) {
            console.log(`[CallManager] Removing ${uid} from audio mixer`)
            source.disconnect()
            audioSourcesRef.current.delete(uid)
        }
    }, [])

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
            video.play().catch(e => console.warn('[CallManager] Video play failed for mixer:', e))
        }
        return video
    }, [])

    const renderRecordingFrame = useCallback(() => {
        if (!isRecording.current || !recordCanvasRef.current) return

        const canvas = recordCanvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const state = callStateRef.current
        const activeParticipants = state.participants.filter(p => {
            if (p.id === currentUser.id) return localStreamRef.current?.getVideoTracks().length! > 0 && !isCameraOff
            return remoteStreamsRef.current[p.id]?.getVideoTracks().length! > 0 && !p.isCameraOff
        })

        // Background
        ctx.fillStyle = '#0f172a' // Slate-900
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        if (state.isScreenSharing) {
            // Priority to Screen Share
            const sharerId = state.screenSharingUserId!
            let stream: MediaStream | null = null
            if (sharerId === currentUser.id) stream = screenStreamRef.current
            else stream = remoteStreamsRef.current[sharerId] // For now assume screen share comes through main stream or we need a way to identify it

            if (stream) {
                const video = getOrCreateVideoElement(sharerId + '-screen', stream)
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
                
                // Draw participants as small overlays on the side? 
                // For simplicity let's stick to screen share only if active, or a small grid at bottom
                const thumbs = activeParticipants.filter(p => p.id !== sharerId)
                if (thumbs.length > 0) {
                    const thumbWidth = 240
                    const thumbHeight = 135
                    thumbs.forEach((p, i) => {
                        const s = p.id === currentUser.id ? localStreamRef.current : remoteStreamsRef.current[p.id]
                        if (s) {
                            const v = getOrCreateVideoElement(p.id, s)
                            ctx.drawImage(v, canvas.width - thumbWidth - 20, 20 + i * (thumbHeight + 10), thumbWidth, thumbHeight)
                            // Draw name
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
                const stream = p.id === currentUser.id ? localStreamRef.current : remoteStreamsRef.current[p.id]
                if (stream) {
                    const video = getOrCreateVideoElement(p.id, stream)
                    const x = (i % cols) * w
                    const y = Math.floor(i / cols) * h
                    ctx.drawImage(video, x, y, w, h)

                    // Overlay name
                    ctx.fillStyle = 'rgba(0,0,0,0.5)'
                    ctx.fillRect(x, y + h - 30, w, 30)
                    ctx.fillStyle = 'white'
                    ctx.font = 'bold 16px Inter, sans-serif'
                    ctx.fillText(p.name, x + 10, y + h - 10)
                }
            })
        } else {
            // No video, just placeholder text
            ctx.fillStyle = '#1e293b'
            ctx.textAlign = 'center'
            ctx.font = 'bold 24px Inter, sans-serif'
            ctx.fillText('Appel en cours (Audio uniquement)', canvas.width / 2, canvas.height / 2)
        }

        requestRef.current = requestAnimationFrame(renderRecordingFrame)
    }, [currentUser.id, getOrCreateVideoElement, isCameraOff])

    const startRecording = useCallback(() => {
        if (isRecording.current) return
        // Only the initiator records to save bandwidth/processing and avoid duplicates
        if (callStateRef.current.isIncoming) return

        console.log('[CallManager] Starting automatic multi-participant recording (Initiator mode)')
        setRecordingStatus(true)

        try {
            // 1. Initialize Audio Context
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
                audioDestinationRef.current = audioContextRef.current.createMediaStreamDestination()
            }

            const ctx = audioContextRef.current
            const dest = audioDestinationRef.current!

            // Resume context if suspended (browser policy)
            if (ctx.state === 'suspended') ctx.resume()

            // 2. Mix Local Audio (if not already added)
            if (!audioSourcesRef.current.has('local') && localStreamRef.current?.getAudioTracks().length! > 0) {
                const source = ctx.createMediaStreamSource(new MediaStream([localStreamRef.current!.getAudioTracks()[0]]))
                source.connect(dest)
                audioSourcesRef.current.set('local', source)
            }

            // 3. Mix existing Remote Audios
            Object.entries(remoteStreamsRef.current).forEach(([uid, stream]) => {
                addStreamToMixer(uid, stream)
            })

            // 4. Combine with Video for Recording
            if (!recordCanvasRef.current) {
                const canvas = document.createElement('canvas')
                canvas.width = 1280
                canvas.height = 720
                recordCanvasRef.current = canvas
            }

            // Start mixing loop
            isRecording.current = true
            renderRecordingFrame()

            const videoStream = recordCanvasRef.current.captureStream(30)
            const combinedStream = new MediaStream([
                ...dest.stream.getAudioTracks(),
                ...videoStream.getVideoTracks()
            ])

            // 5. Setup MediaRecorder
            const options = { mimeType: 'video/webm;codecs=vp8,opus' }
            if (!MediaRecorder.isTypeSupported(options.mimeType)) options.mimeType = 'video/webm'

            mediaRecorderRef.current = new MediaRecorder(combinedStream, options)
            recordingChunksRef.current = []

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) recordingChunksRef.current.push(e.data)
            }

            mediaRecorderRef.current.onstop = async () => {
                console.log('[CallManager] Recording stopped, finalized blob size:', new Blob(recordingChunksRef.current).size)
                const blob = new Blob(recordingChunksRef.current, { type: 'video/webm' })
                if (blob.size < 5000) return // Ignore very short/empty files

                const formData = new FormData()
                formData.append('file', blob)
                formData.append('conversationId', callConversationIdRef.current || '')
                formData.append('callerId', currentUser.id)
                formData.append('type', callStateRef.current.type)
                formData.append('participants', JSON.stringify(callStateRef.current.participants.map(p => p.id)))
                formData.append('duration', (callAnswerTimeRef.current ? Math.floor((Date.now() - callAnswerTimeRef.current) / 1000) : 0).toString())
                formData.append('status', 'completed')

                const result = await saveCallRecording(formData)
                if (result.success) console.log('[CallManager] Recording saved successfully:', result.callId)
            }

            mediaRecorderRef.current.start(1000)
            isRecording.current = true
        } catch (err) {
            console.error('[CallManager] Failed to start recording:', err)
        }
    }, [currentUser.id, addStreamToMixer])

    const stopRecording = useCallback(() => {
        if (!isRecording.current) return
        console.log('[CallManager] Stopping recording session')
        setRecordingStatus(false)

        if (requestRef.current) {
            cancelAnimationFrame(requestRef.current)
            requestRef.current = null
        }

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop()
        }

        // Cleanup Video elements
        videoElementsRef.current.forEach(v => {
            v.srcObject = null
            v.remove()
        })
        videoElementsRef.current.clear()

        // Cleanup Audio Nodes but keep Context for potential restart? 
        // Better clean everything.
        audioSourcesRef.current.forEach(source => source.disconnect())
        audioSourcesRef.current.clear()

        isRecording.current = false
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

        stopRecording()

        setCallState({
            isActive: false, isIncoming: false, type: 'video', caller: null, participants: [], status: 'idle',
            videoUpgradeRequest: null, videoUpgradeInitiator: null, conversationId: null,
            screenSharingUserId: null, isScreenSharing: false
        })
    }, [stopRingtone, stopRecording])

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
            console.log(`[CallManager] Received remote track from ${otherUserId}:`, event.track.kind)
            if (event.streams && event.streams[0]) {
                const remoteStream = event.streams[0]
                setRemoteStreams(prev => {
                    return { ...prev, [otherUserId]: remoteStream }
                })
                remoteStreamsRef.current = { ...remoteStreamsRef.current, [otherUserId]: remoteStream }

                // Dynamic Audio Mixing
                if (event.track.kind === 'audio') {
                    addStreamToMixer(otherUserId, remoteStream)
                }
            }
        }

        pc.onnegotiationneeded = async () => {
            // 🔔 FIX: Suppress automatic negotiation if we are manually upgrading
            if (isRenegotiating.current) {
                console.log(`[CallManager] Skipping onnegotiationneeded for ${otherUserId} due to manual renegotiation`)
                return
            }

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
                setCallState(prev => {
                    if (prev.status !== 'connected') {
                        // START RECORDING when first peer connects
                        setTimeout(startRecording, 1000) // Delay to ensure tracks are ready
                        return { ...prev, status: 'connected' }
                    }
                    return prev
                })
            }
        }

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                setTimeout(() => {
                    if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                        setCallState(prev => ({ ...prev, participants: prev.participants.filter((p: CallParticipant) => p.id !== otherUserId) }))

                        // Dynamic Audio Mixer Cleanup
                        removeStreamFromMixer(otherUserId)

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
        const polite = currentUser.id < from // Deterministic politeness
        let pc = peerConnections.current.get(from) || setupPeerConnection(from, polite)
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
                status: 'calling', videoUpgradeRequest: null, videoUpgradeInitiator: null, conversationId,
                screenSharingUserId: null, isScreenSharing: false
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
    }, [currentUser.id, currentUser.full_name, currentUser.avatar_url, broadcastSignal, cleanupCall, isMuted, isCameraOff])

    const startGroupCall = useCallback(async (conversationId: string, members: Array<{ id: string; full_name: string; avatar_url: string | null }>, type: 'audio' | 'video') => {
        try {
            cleanupCall()
            callConversationIdRef.current = conversationId
            callStartTimeRef.current = Date.now()
            const stream = await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: { echoCancellation: true, noiseSuppression: true } })
            localStreamRef.current = stream
            setLocalStream(stream)

            // Build participants list: current user + all group members
            const allParticipants = [
                { id: currentUser.id, name: currentUser.full_name, avatar: currentUser.avatar_url, isMuted, isCameraOff },
                ...members.filter(m => m.id !== currentUser.id).map(m => ({
                    id: m.id,
                    name: m.full_name,
                    avatar: m.avatar_url
                }))
            ]

            setCallState({
                isActive: true,
                isIncoming: false,
                type,
                caller: null,
                participants: allParticipants,
                status: 'calling',
                videoUpgradeRequest: null,
                videoUpgradeInitiator: null,
                conversationId,
                screenSharingUserId: null,
                isScreenSharing: false
            })

            // Send initiate signal to ALL group members (except current user)
            const otherMembers = members.filter(m => m.id !== currentUser.id)
            otherMembers.forEach(member => {
                broadcastSignal('initiate', currentUser.id, member.id, {
                    type,
                    conversationId,
                    metadata: {
                        name: currentUser.full_name,
                        avatar: currentUser.avatar_url,
                        isMuted,
                        isCameraOff
                    }
                })
                sendCallNotification(member.id, currentUser.full_name, type).catch(err => console.error('[CallManager] Push failed:', err))
            })
        } catch (err) {
            console.error('[CallManager] Start group call failed:', err)
            cleanupCall()
        }
    }, [currentUser.id, currentUser.full_name, currentUser.avatar_url, broadcastSignal, cleanupCall, isMuted, isCameraOff])

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
    }, [currentUser.id, currentUser.full_name, currentUser.avatar_url, broadcastSignal])

    const rejectCall = useCallback(() => {
        const state = callStateRef.current
        if (state.caller) broadcastSignal('reject', currentUser.id, state.caller.id)
        cleanupCall()
        logCallAttempt('rejected')
    }, [currentUser.id, broadcastSignal, cleanupCall, logCallAttempt])

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

            // 🔔 FIX: Ensure tracks are added if connection exists (though usually it's created after)
            const pc = peerConnections.current.get(state.caller.id)
            if (pc && localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => {
                    const senders = pc.getSenders()
                    const existingSender = senders.find(s => s.track?.kind === track.kind)
                    if (!existingSender) {
                        pc.addTrack(track, localStreamRef.current!)
                    } else {
                        existingSender.replaceTrack(track)
                    }
                })
            }

            // IMPORTANT: Broadcast join signal to everyone else in the call
            const others = state.participants.filter((p: CallParticipant) =>
                p.id !== currentUser.id && p.id !== state.caller?.id
            ).map((o: CallParticipant) => o.id)

            if (others.length > 0) {
                // 🔔 FIX: usage of array for 'others' is now correctly handled by the listener
                broadcastSignal('join', currentUser.id, others, {
                    metadata: {
                        name: currentUser.full_name,
                        avatar: currentUser.avatar_url,
                        isMuted, isCameraOff
                    }
                })
            }
        } catch (err) { console.error('[CallManager] Accept failed:', err); rejectCall() }
    }, [currentUser.id, currentUser.full_name, currentUser.avatar_url, broadcastSignal, isMuted, isCameraOff, stopRingtone, hideNotification, rejectCall])

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

    const startScreenShare = useCallback(async () => {
        const state = callStateRef.current
        if (!state.isActive || state.status !== 'connected') {
            console.warn('[CallManager] Screen share only available in connected calls')
            return
        }

        try {
            // Request screen sharing permission
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false // Can be enabled if needed
            })

            const screenTrack = screenStream.getVideoTracks()[0]
            if (!screenTrack) {
                console.error('[CallManager] No video track in screen stream')
                return
            }

            // If it was an audio call, we are now effectively in a video-capable call
            if (state.type === 'audio') {
                setCallState(prev => ({ ...prev, type: 'video' }))
            }

            // Store original camera track
            const currentVideoTrack = localStreamRef.current?.getVideoTracks()[0]
            if (currentVideoTrack) {
                originalVideoTrackRef.current = currentVideoTrack
            }

            // Replace video track in all peer connections or add it
            await Promise.all(Array.from(peerConnections.current.entries()).map(async ([otherUserId, pc]) => {
                const senders = pc.getSenders()
                const videoSender = senders.find(s => s.track?.kind === 'video')

                if (videoSender) {
                    await videoSender.replaceTrack(screenTrack)
                    console.log(`[CallManager] Replaced video track with screen share for ${otherUserId}`)
                } else {
                    // If no video sender exists (audio call), add the track
                    pc.addTrack(screenTrack, screenStream)
                    console.log(`[CallManager] Added screen share track for ${otherUserId}`)
                }
            }))

            // Update local stream
            if (localStreamRef.current) {
                const audioTrack = localStreamRef.current.getAudioTracks()[0]
                const newStream = new MediaStream()
                if (audioTrack) newStream.addTrack(audioTrack)
                newStream.addTrack(screenTrack)
                localStreamRef.current = newStream
                setLocalStream(newStream)
            }

            screenStreamRef.current = screenStream
            setScreenStream(screenStream)

            // Broadcast screen share start to all participants
            const targets = state.participants.filter((p: CallParticipant) => p.id !== currentUser.id).map((p: CallParticipant) => p.id)
            if (targets.length > 0) {
                broadcastSignal('screen-share-start', currentUser.id, targets)
            }

            // Update state
            setCallState(prev => ({ ...prev, isScreenSharing: true, screenSharingUserId: currentUser.id }))

            // Listen for when user stops sharing via browser UI
            screenTrack.onended = () => {
                console.log('[CallManager] Screen share stopped by user')
                stopScreenShare()
            }

            console.log('[CallManager] Screen sharing started successfully')
        } catch (err: any) {
            console.error('[CallManager] Screen share failed:', err)
            if (err.name === 'NotAllowedError') {
                console.warn('[CallManager] User denied screen share permission')
            }
        }
    }, [currentUser.id, broadcastSignal])

    const stopScreenShare = useCallback(async () => {
        const state = callStateRef.current
        if (!state.isScreenSharing) return

        try {
            // Stop screen stream tracks
            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach(track => track.stop())
                screenStreamRef.current = null
                setScreenStream(null)
            }

            // Restore original camera track if it was replaced in all peer connections
            const originalTrack = originalVideoTrackRef.current
            if (originalTrack && localStreamRef.current) {
                // Replace screen track with camera track in all peer connections
                await Promise.all(Array.from(peerConnections.current.entries()).map(async ([otherUserId, pc]) => {
                    const senders = pc.getSenders()
                    const videoSender = senders.find(s => s.track?.kind === 'video')

                    if (videoSender) {
                        await videoSender.replaceTrack(originalTrack)
                        console.log(`[CallManager] Restored camera track for ${otherUserId}`)
                    }
                }))
            }

            // Broadcast screen share stop to all participants
            const targets = state.participants.filter((p: CallParticipant) => p.id !== currentUser.id).map((p: CallParticipant) => p.id)
            if (targets.length > 0) {
                broadcastSignal('screen-share-stop', currentUser.id, targets)
            }

            // Update state
            setCallState(prev => ({ ...prev, isScreenSharing: false, screenSharingUserId: null }))
            setScreenStream(null)

            console.log('[CallManager] Screen sharing stopped successfully')
        } catch (err) {
            console.error('[CallManager] Stop screen share failed:', err)
        }
    }, [currentUser.id, broadcastSignal])

    const kickParticipant = useCallback((userId: string) => {
        const state = callStateRef.current
        // Only host (initiator) can kick
        if (state.isIncoming) {
            console.warn('[CallManager] Only host can kick participants')
            return
        }

        console.log(`[CallManager] Kicking participant: ${userId}`)
        broadcastSignal('kick', currentUser.id, userId)
        
        // Remove from local state immediately
        setCallState(prev => ({
            ...prev,
            participants: prev.participants.filter(p => p.id !== userId)
        }))
        
        // Close connection
        const pc = peerConnections.current.get(userId)
        if (pc) {
            pc.close()
            peerConnections.current.delete(userId)
        }
    }, [currentUser.id, broadcastSignal])

    const blockParticipant = useCallback((userId: string) => {
        console.log(`[CallManager] Blocking participant: ${userId}`)
        blockedUsersRef.current.add(userId)
        setBlockedUsers(new Set(blockedUsersRef.current))
        kickParticipant(userId)
    }, [kickParticipant])

    useEffect(() => {
        const channel = supabase.channel('calls_v5', { config: { broadcast: { ack: true } } })
            .on('broadcast', { event: 'call-signal' }, async ({ payload }: { payload: any }) => {
                const { signal, from, to, type, metadata } = payload

                // 🔔 FIX: Handle both single string and array targets
                const isForMe = Array.isArray(to) ? to.includes(currentUser.id) : to === currentUser.id
                if (!isForMe) return

                switch (signal) {
                    case 'initiate':
                        if (blockedUsersRef.current.has(from)) {
                            console.warn(`[CallManager] Ignoring initiate from blocked user: ${from}`)
                            broadcastSignal('busy', currentUser.id, from)
                            return
                        }
                        setCallState(prev => {
                            if (prev.isActive) { broadcastSignal('busy', currentUser.id, from); return prev }
                            playRingtone(); showNotification(`Appel ${type} entrant`, { body: `${metadata.name} vous appelle...`, isCall: true, tag: 'incoming-call' })
                            if (timeoutRef.current) clearTimeout(timeoutRef.current)
                            timeoutRef.current = setTimeout(() => rejectCall(), 45000)
                            const callerInfo = { id: from, name: metadata.name, avatar: metadata.avatar }
                            return {
                                isActive: true, isIncoming: true, type, caller: callerInfo,
                                participants: [
                                    { ...callerInfo, isMuted: metadata.isMuted, isCameraOff: metadata.isCameraOff },
                                    { id: currentUser.id, name: currentUser.full_name, avatar: currentUser.avatar_url, isMuted, isCameraOff }
                                ],
                                status: 'ringing', videoUpgradeRequest: null, videoUpgradeInitiator: null, conversationId: payload.conversationId,
                                screenSharingUserId: null, isScreenSharing: false
                            }
                        })
                        callConversationIdRef.current = payload.conversationId; callStartTimeRef.current = Date.now(); callAnswerTimeRef.current = null
                        break
                    case 'invite':
                        if (blockedUsersRef.current.has(from)) {
                            console.warn(`[CallManager] Ignoring invite from blocked user: ${from}`)
                            return
                        }
                        setCallState(prev => {
                            if (prev.isActive) return prev
                            playRingtone(); showNotification(`Appel ${type} entrant`, { body: `${metadata.name} vous appelle...`, isCall: true, tag: 'incoming-call' })
                            const inviter = { id: from, name: metadata.name, avatar: metadata.avatar }
                            return {
                                isActive: true, isIncoming: true, type, caller: inviter, participants: [...metadata.participants],
                                status: 'ringing', videoUpgradeRequest: null, videoUpgradeInitiator: null, conversationId: payload.conversationId,
                                screenSharingUserId: null, isScreenSharing: false
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
                        if (statusRef.current === 'connected') setupPeerConnection(from, currentUser.id < from)
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
                        setupPeerConnection(from, currentUser.id < from)
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
                    case 'video-renegotiation-offer':
                        console.log('[CallManager] Handling legacy video-renegotiation-offer as standard offer')
                        await handleOffer(payload)
                        break
                    case 'video-renegotiation-answer':
                        console.log('[CallManager] Handling legacy video-renegotiation-answer as standard answer')
                        await handleAnswer(payload)
                        break
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
                    case 'screen-share-start':
                        console.log(`[CallManager] ${from} started screen sharing`)
                        setCallState(prev => ({ ...prev, isScreenSharing: true, screenSharingUserId: from }))
                        break
                    case 'screen-share-stop':
                        console.log(`[CallManager] ${from} stopped screen sharing`)
                        setCallState(prev => ({ ...prev, isScreenSharing: false, screenSharingUserId: null }))
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
                    case 'kick':
                        console.log('[CallManager] Kicked from call by host')
                        showNotification('Expulsé de l\'appel', { body: 'Le responsable vous a retiré de l\'appel.' })
                        cleanupCall()
                        // Redirect to dashboard
                        window.location.href = '/dashboard'
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
    }, [currentUser.id, broadcastSignal, setupPeerConnection, handleOffer, handleAnswer, handleIceCandidate, cleanupCall, playRingtone, stopRingtone, showNotification, rejectCall])

    return (
        <CallContext.Provider value={{
            startCall, startGroupCall, inviteParticipant, acceptCall, rejectCall, endCall,
            callState, toggleMute, toggleCamera, isMuted, isCameraOff,
            requestVideoUpgrade, acceptVideoUpgrade, rejectVideoUpgrade,
            startScreenShare, stopScreenShare,
            kickParticipant, blockParticipant, blockedUsers
        }}>
            {children}
            {callState.isActive && (
                <CallOverlay
                    state={callState} localStream={localStream} remoteStreams={remoteStreams}
                    onEnd={endCall} onAccept={acceptCall} onReject={rejectCall}
                    onMute={toggleMute} onCamera={toggleCamera} isMuted={isMuted} isCameraOff={isCameraOff}
                    onRequestVideoUpgrade={requestVideoUpgrade} onAcceptVideoUpgrade={acceptVideoUpgrade} onRejectVideoUpgrade={rejectVideoUpgrade}
                    onInvite={inviteParticipant} currentUserId={currentUser.id}
                    onStartScreenShare={startScreenShare} onStopScreenShare={stopScreenShare}
                    isScreenSharing={callState.isScreenSharing} screenSharingUserId={callState.screenSharingUserId}
                    screenStream={screenStream}
                    isRecording={recordingStatus}
                    onKick={kickParticipant}
                    onBlock={blockParticipant}
                    isCurrentUserHost={!callState.isIncoming}
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
