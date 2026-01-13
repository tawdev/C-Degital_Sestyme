'use client'

import React, { useEffect, useRef } from 'react'
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Maximize2, Minimize2, User } from 'lucide-react'
import EmployeeAvatar from '@/components/employee-avatar'

interface CallOverlayProps {
    state: any
    localStream: MediaStream | null
    remoteStream: MediaStream | null
    onEnd: () => void
    onAccept: () => void
    onReject: () => void
    onMute: () => void
    onCamera: () => void
    isMuted: boolean
    isCameraOff: boolean
}

export default function CallOverlay({
    state, localStream, remoteStream,
    onEnd, onAccept, onReject, onMute, onCamera,
    isMuted, isCameraOff
}: CallOverlayProps) {
    const localVideoRef = useRef<HTMLVideoElement>(null)
    const remoteVideoRef = useRef<HTMLVideoElement>(null)
    const remoteAudioRef = useRef<HTMLAudioElement>(null)
    const [duration, setDuration] = React.useState(0)

    const lastLocalStream = useRef<string>('')
    const lastRemoteStream = useRef<string>('')

    useEffect(() => {
        const video = localVideoRef.current
        if (video && localStream) {
            const streamId = localStream.id + localStream.getTracks().map(t => t.id).join(',')
            if (lastLocalStream.current !== streamId) {
                console.log('[CallOverlay] Attaching local stream')
                video.srcObject = localStream
                video.play().catch(err => {
                    if (err.name !== 'AbortError') console.error('[CallOverlay] Local video play error:', err)
                })
                lastLocalStream.current = streamId
            }
        }
    }, [localStream])

    useEffect(() => {
        const video = remoteVideoRef.current
        const audio = remoteAudioRef.current

        if (remoteStream) {
            const streamId = remoteStream.id + remoteStream.getTracks().map(t => t.id).join(',')
            if (lastRemoteStream.current !== streamId) {
                const hasAudio = remoteStream.getAudioTracks().length > 0
                const hasVideo = remoteStream.getVideoTracks().length > 0
                console.log(`[CallOverlay] Attaching remote stream: Video=${hasVideo}, Audio=${hasAudio}`)

                if (video && state.type === 'video' && hasVideo) {
                    video.srcObject = remoteStream
                    video.muted = false
                    video.volume = 1.0
                    video.play().catch(err => {
                        if (err.name !== 'AbortError') console.error('[CallOverlay] Remote video play error:', err)
                    })
                }

                if (audio && hasAudio) {
                    audio.srcObject = remoteStream
                    audio.muted = false
                    audio.volume = 1.0
                    audio.play().catch(err => {
                        if (err.name !== 'AbortError') console.error('[CallOverlay] Remote audio play error:', err)
                    })
                }
                lastRemoteStream.current = streamId
            }
        }
    }, [remoteStream, state.type])

    // Timer Logic
    useEffect(() => {
        let interval: any
        if (state.status === 'connected') {
            interval = setInterval(() => {
                setDuration(prev => prev + 1)
            }, 1000)
        } else {
            setDuration(0)
            clearInterval(interval)
        }
        return () => clearInterval(interval)
    }, [state.status])

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    const participant = state.isIncoming ? state.caller : state.recipient
    const isRinging = state.isIncoming && state.status === 'ringing'
    const isConnecting = state.status === 'calling'
    const isConnected = state.status === 'connected'

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-gray-900 w-full max-w-4xl aspect-video rounded-3xl overflow-hidden shadow-2xl border border-white/10 relative flex flex-col">

                {/* Main View (Remote Video or Avatar) */}
                <div className="flex-1 relative bg-gray-800 flex items-center justify-center overflow-hidden">
                    {state.type === 'video' && remoteStream ? (
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="flex flex-col items-center gap-6 animate-pulse">
                            <div className="relative">
                                <EmployeeAvatar
                                    avatarUrl={participant?.avatar || null}
                                    fullName={participant?.name || 'User'}
                                    className="w-32 h-32 text-4xl border-4 border-indigo-500/30"
                                />
                                <div className="absolute -bottom-2 -right-2 bg-indigo-600 p-2 rounded-full shadow-lg">
                                    {state.type === 'video' ? <Video className="w-5 h-5 text-white" /> : <Phone className="w-5 h-5 text-white" />}
                                </div>
                            </div>
                            <div className="text-center">
                                <h2 className="text-2xl font-bold text-white mb-2">{participant?.name || 'Connecting...'}</h2>
                                <p className="text-indigo-400 font-medium">
                                    {isRinging ? 'Incoming Call...' :
                                        isConnecting ? 'Establishing secure connection...' :
                                            isConnected ? 'Secure connection active' : 'Ending...'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Local Video Preview (Picture in Picture) */}
                    {state.type === 'video' && (
                        <div className="absolute top-6 right-6 w-1/4 aspect-video bg-gray-900 rounded-2xl overflow-hidden shadow-xl border border-white/20 z-10">
                            {isCameraOff ? (
                                <div className="w-full h-full flex items-center justify-center bg-gray-800">
                                    <VideoOff className="w-8 h-8 text-gray-600" />
                                </div>
                            ) : (
                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    muted
                                    playsInline
                                    onLoadedMetadata={() => console.log('[CallOverlay] Local video metadata loaded')}
                                    style={{ transform: 'scaleX(-1)' }}
                                    className="w-full h-full object-cover"
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* Controls Bar */}
                <div className="p-6 bg-gradient-to-t from-gray-950 to-gray-900/80 backdrop-blur-md flex items-center justify-center gap-6">
                    {isRinging ? (
                        <>
                            <button
                                onClick={onReject}
                                className="w-16 h-16 flex items-center justify-center bg-red-500 hover:bg-red-600 rounded-full text-white transition-all shadow-lg hover:scale-110 active:scale-95 group"
                            >
                                <PhoneOff className="w-8 h-8" />
                            </button>
                            <button
                                onClick={onAccept}
                                className="w-16 h-16 flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 rounded-full text-white transition-all shadow-lg hover:scale-110 active:scale-95 animate-bounce"
                            >
                                <Phone className="w-8 h-8" />
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={onMute}
                                className={`w-14 h-14 flex items-center justify-center rounded-full transition-all border ${isMuted ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-white/10 border-white/10 text-white hover:bg-white/20'}`}
                            >
                                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                            </button>

                            {state.type === 'video' && (
                                <button
                                    onClick={onCamera}
                                    className={`w-14 h-14 flex items-center justify-center rounded-full transition-all border ${isCameraOff ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-white/10 border-white/10 text-white hover:bg-white/20'}`}
                                >
                                    {isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                                </button>
                            )}

                            <button
                                onClick={onEnd}
                                className="w-16 h-16 flex items-center justify-center bg-red-500 hover:bg-red-600 rounded-full text-white transition-all shadow-lg hover:rotate-[135deg]"
                            >
                                <PhoneOff className="w-8 h-8" />
                            </button>
                        </>
                    )}
                </div>

                {/* Status Indicator */}
                <div className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                        {isConnected ? formatDuration(duration) : state.status}
                    </span>
                </div>

                {/* Hidden Audio for Remote Stream (Covers Audio-only and Video calls) */}
                <audio
                    ref={remoteAudioRef}
                    autoPlay
                    playsInline
                    onLoadedMetadata={() => console.log('[CallOverlay] Remote audio metadata loaded')}
                />
            </div>
        </div>
    )
}
