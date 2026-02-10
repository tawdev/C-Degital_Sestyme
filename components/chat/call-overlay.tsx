'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Maximize2, Minimize2, User, PictureInPicture, MoveDownLeft } from 'lucide-react'
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
    onRequestVideoUpgrade: () => void
    onAcceptVideoUpgrade: () => void
    onRejectVideoUpgrade: () => void
    currentUserId: string
}

export default function CallOverlay({
    state, localStream, remoteStream,
    onEnd, onAccept, onReject, onMute, onCamera,
    isMuted, isCameraOff,
    onRequestVideoUpgrade, onAcceptVideoUpgrade, onRejectVideoUpgrade,
    currentUserId
}: CallOverlayProps) {
    useEffect(() => {
        if (state.videoUpgradeRequest === 'pending') {
            console.log('[CallOverlay] Video upgrade state:', {
                request: state.videoUpgradeRequest,
                initiator: state.videoUpgradeInitiator,
                currentUserId,
                isRequester: state.videoUpgradeInitiator === currentUserId,
                isReceiver: state.videoUpgradeInitiator !== currentUserId
            })
        }
    }, [state.videoUpgradeRequest, state.videoUpgradeInitiator, currentUserId])

    const containerRef = useRef<HTMLDivElement>(null)
    const localVideoRef = useRef<HTMLVideoElement>(null)
    const remoteVideoRef = useRef<HTMLVideoElement>(null)
    const remoteAudioRef = useRef<HTMLAudioElement>(null)
    const [duration, setDuration] = useState(0)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [isMinimized, setIsMinimized] = useState(false)

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
    }, [localStream, isMinimized]) // Re-run when minimizing toggles visibility of local video

    useEffect(() => {
        const video = remoteVideoRef.current
        const audio = remoteAudioRef.current

        if (remoteStream) {
            const streamId = remoteStream.id + remoteStream.getTracks().map(t => t.id).join(',')
            // Always attempt to play if refs are valid, even if streamId hasn't changed (in case of remount)
            const hasAudio = remoteStream.getAudioTracks().length > 0
            const hasVideo = remoteStream.getVideoTracks().length > 0

            if (video && state.type === 'video' && hasVideo) {
                if (video.srcObject !== remoteStream) {
                    video.srcObject = remoteStream
                }
                video.muted = false
                video.volume = 1.0
                video.play().catch(err => {
                    if (err.name !== 'AbortError') console.error('[CallOverlay] Remote video play error:', err)
                })
            }

            if (audio && hasAudio) {
                if (audio.srcObject !== remoteStream) {
                    audio.srcObject = remoteStream
                }
                audio.muted = false
                audio.volume = 1.0
                audio.play().catch(err => {
                    if (err.name !== 'AbortError') console.error('[CallOverlay] Remote audio play error:', err)
                })
            }
        }
    }, [remoteStream, state.type, isMinimized])

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

    // Monitor Fullscreen Changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement)
        }
        document.addEventListener('fullscreenchange', handleFullscreenChange)
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }, [])

    const toggleFullscreen = async () => {
        if (!containerRef.current) return
        try {
            if (!document.fullscreenElement) {
                await containerRef.current.requestFullscreen()
            } else {
                await document.exitFullscreen()
            }
        } catch (err) {
            console.error('[CallOverlay] Fullscreen error:', err)
        }
    }

    const togglePiP = async () => {
        const video = remoteVideoRef.current
        if (!video) return
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture()
            } else if (document.pictureInPictureEnabled && video.readyState >= 1) {
                await video.requestPictureInPicture()
            } else {
                console.warn('[CallOverlay] PiP not implemented or supported in this state')
            }
        } catch (err) {
            console.error('[CallOverlay] PiP error:', err)
        }
    }

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    const participant = state.isIncoming ? state.caller : state.recipient
    const isRinging = state.isIncoming && state.status === 'ringing'
    const isConnecting = state.status === 'calling'
    const isConnected = state.status === 'connected'

    // Video upgrade UI states
    // showVideoUpgradeRequest (Accept/Reject popup) should show for the receiver of the request
    // The receiver is the user who did NOT initiate the upgrade
    const showVideoUpgradeRequest = state.videoUpgradeRequest === 'pending' && state.videoUpgradeInitiator !== null && state.videoUpgradeInitiator !== currentUserId

    // showVideoUpgradePending (Waiting message) should show for the requester
    // The requester is the user who initiated the upgrade
    const showVideoUpgradePending = state.videoUpgradeRequest === 'pending' && state.videoUpgradeInitiator !== null && state.videoUpgradeInitiator === currentUserId
    const showVideoUpgradeRejected = state.videoUpgradeRequest === 'rejected'

    return (
        <>
            {/* Video Upgrade Request Modal */}
            {showVideoUpgradeRequest && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-gray-900 border border-white/20 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex flex-col items-center gap-6">
                            <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center">
                                <Video className="w-10 h-10 text-indigo-400 animate-pulse" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-2xl font-bold text-white mb-2">Demande d'appel vidéo</h3>
                                <p className="text-gray-400">
                                    <span className="text-white font-semibold">{participant?.name}</span> souhaite passer en appel vidéo
                                </p>
                            </div>
                            <div className="flex gap-4 w-full">
                                <button
                                    onClick={onRejectVideoUpgrade}
                                    className="flex-1 px-6 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500 text-red-400 rounded-xl font-semibold transition-all hover:scale-105"
                                >
                                    Refuser
                                </button>
                                <button
                                    onClick={onAcceptVideoUpgrade}
                                    className="flex-1 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition-all hover:scale-105 shadow-lg"
                                >
                                    Accepter
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className={`fixed inset-0 z-[100] transition-all duration-300 ${isMinimized ? 'pointer-events-none bg-transparent' : 'flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm'}`}>
                <div
                    ref={containerRef}
                    className={`
                    bg-gray-900 border-white/10 overflow-hidden shadow-2xl relative flex flex-col transition-all duration-300 ease-in-out
                    ${isMinimized
                            ? 'fixed bottom-4 right-4 w-80 aspect-video rounded-xl pointer-events-auto border-2 border-indigo-500/50 hover:border-indigo-500'
                            : isFullscreen
                                ? 'w-full h-full max-w-none rounded-none'
                                : 'w-full max-w-4xl aspect-video rounded-3xl border'
                        }
                `}
                >

                    {/* Main View (Remote Video or Avatar) */}
                    <div className="flex-1 relative bg-gray-800 flex items-center justify-center overflow-hidden group">
                        {state.type === 'video' && remoteStream ? (
                            <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className={`flex flex-col items-center gap-6 animate-pulse ${isMinimized ? 'scale-75' : ''}`}>
                                <div className="relative">
                                    <EmployeeAvatar
                                        avatarUrl={participant?.avatar || null}
                                        fullName={participant?.name || 'User'}
                                        className={`${isMinimized ? 'w-16 h-16' : 'w-32 h-32'} text-4xl border-4 border-indigo-500/30`}
                                    />
                                    <div className="absolute -bottom-2 -right-2 bg-indigo-600 p-2 rounded-full shadow-lg">
                                        {state.type === 'video' ? <Video className="w-5 h-5 text-white" /> : <Phone className="w-5 h-5 text-white" />}
                                    </div>
                                </div>
                                {!isMinimized && (
                                    <div className="text-center">
                                        <h2 className="text-2xl font-bold text-white mb-2">{participant?.name || 'Connecting...'}</h2>
                                        <p className="text-indigo-400 font-medium">
                                            {isRinging ? 'Incoming Call...' :
                                                isConnecting ? 'Establishing secure connection...' :
                                                    isConnected ? 'Secure connection active' : 'Ending...'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Local Video Preview (Picture in Picture) - Hidden when Minimized */}
                        {!isMinimized && state.type === 'video' && (
                            <div className="absolute top-6 right-6 w-1/4 aspect-video bg-gray-900 rounded-2xl overflow-hidden shadow-xl border border-white/20 z-10 transition-all hover:scale-105">
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

                        {/* Mini Controls Overlay (Only visible when minimized on hover) */}
                        {isMinimized && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                                <button
                                    onClick={() => setIsMinimized(false)}
                                    className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all hover:scale-110"
                                    title="Maximize"
                                >
                                    <Maximize2 className="w-6 h-6" />
                                </button>
                                <button
                                    onClick={onEnd}
                                    className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all hover:scale-110"
                                    title="End Call"
                                >
                                    <PhoneOff className="w-6 h-6" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Controls Bar - Hidden when Minimized */}
                    {!isMinimized && (
                        <div className="p-6 bg-gradient-to-t from-gray-950 to-gray-900/80 backdrop-blur-md flex items-center justify-center gap-6 relative animate-in slide-in-from-bottom-4 duration-300">
                            {/* Extra Utility Buttons (PiP / Fullscreen / Minimize) */}
                            {isConnected && (
                                <div className="absolute right-6 flex items-center gap-3">
                                    {/* Minimize works for both Video and Audio calls now */}
                                    <button
                                        onClick={toggleMinimize}
                                        className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all flex items-center justify-center"
                                        title="Minimize (Mini Player)"
                                    >
                                        <Minimize2 className="w-5 h-5" />
                                    </button>

                                    {state.type === 'video' && (
                                        <button
                                            onClick={togglePiP}
                                            className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all flex items-center justify-center"
                                            title="System Picture in Picture"
                                        >
                                            <PictureInPicture className="w-5 h-5" />
                                        </button>
                                    )}
                                    <button
                                        onClick={toggleFullscreen}
                                        className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all flex items-center justify-center"
                                        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                                    >
                                        {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                                    </button>
                                </div>
                            )}

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

                                    {/* Video Upgrade Button - Only visible during audio calls */}
                                    {state.type === 'audio' && state.status === 'connected' && !state.videoUpgradeRequest && (
                                        <button
                                            onClick={onRequestVideoUpgrade}
                                            className="w-14 h-14 flex items-center justify-center rounded-full transition-all border bg-indigo-500/20 border-indigo-500 text-indigo-400 hover:bg-indigo-500/30 hover:border-indigo-400 hover:text-indigo-300 animate-pulse"
                                            title="Passer en appel vidéo"
                                        >
                                            <Video className="w-6 h-6" />
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
                    )}

                    {/* Status Indicator (Simplified when minimized) */}
                    <div className={`absolute top-6 left-6 flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 z-50 ${isMinimized ? 'scale-75 origin-top-left' : ''}`}>
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

                    {/* Video Upgrade Status Indicators */}
                    {showVideoUpgradePending && !isMinimized && (
                        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 px-6 py-3 bg-indigo-500/90 backdrop-blur-md rounded-full border border-indigo-400 shadow-lg animate-in slide-in-from-bottom-4">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                <span className="text-sm font-semibold text-white">Demande de vidéo en cours...</span>
                            </div>
                        </div>
                    )}

                    {showVideoUpgradeRejected && !isMinimized && (
                        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 px-6 py-3 bg-red-500/90 backdrop-blur-md rounded-full border border-red-400 shadow-lg animate-in slide-in-from-bottom-4">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-semibold text-white">Demande refusée</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    )

    // Helper function for minimizing
    function toggleMinimize() {
        setIsMinimized(!isMinimized)
    }
}
