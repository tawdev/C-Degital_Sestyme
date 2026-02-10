'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Maximize2, Minimize2, User, PictureInPicture, MoveDownLeft, UserPlus } from 'lucide-react'
import InviteParticipantModal from './invite-participant-modal'
import EmployeeAvatar from '@/components/employee-avatar'

interface CallOverlayProps {
    state: any
    localStream: MediaStream | null
    remoteStreams: Record<string, MediaStream>
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
    onInvite: (userId: string, userName: string, userAvatar: string | null) => void
    currentUserId: string
}

export default function CallOverlay({
    state,
    localStream,
    remoteStreams, // Object keyed by userId
    onEnd,
    onAccept,
    onReject,
    onMute,
    onCamera,
    isMuted,
    isCameraOff,
    onRequestVideoUpgrade,
    onAcceptVideoUpgrade,
    onRejectVideoUpgrade,
    onInvite,
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
    const remoteVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({})
    const remoteAudioRefs = useRef<Record<string, HTMLAudioElement | null>>({})
    const [duration, setDuration] = useState(0)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [isMinimized, setIsMinimized] = useState(false)
    const [showInviteModal, setShowInviteModal] = useState(false)

    const lastLocalStream = useRef<string>('')

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

    // Remote streams attachment
    useEffect(() => {
        Object.entries(remoteStreams).forEach(([userId, stream]) => {
            const video = remoteVideoRefs.current[userId]
            const audio = remoteAudioRefs.current[userId]

            if (stream) {
                const hasAudio = stream.getAudioTracks().length > 0
                const hasVideo = stream.getVideoTracks().length > 0

                if (video && state.type === 'video' && hasVideo) {
                    if (video.srcObject !== stream) {
                        video.srcObject = stream
                    }
                    video.muted = false
                    video.volume = 1.0
                    video.play().catch(err => {
                        if (err.name !== 'AbortError') console.error(`[CallOverlay] Remote video play error (${userId}):`, err)
                    })
                }

                if (audio && hasAudio) {
                    if (audio.srcObject !== stream) {
                        audio.srcObject = stream
                    }
                    audio.muted = false
                    audio.volume = 1.0
                    audio.play().catch(err => {
                        if (err.name !== 'AbortError') console.error(`[CallOverlay] Remote audio play error (${userId}):`, err)
                    })
                }
            }
        })
    }, [remoteStreams, state.type, isMinimized])

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

    const togglePiP = async (userId: string) => {
        const video = remoteVideoRefs.current[userId]
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

    const participant = state.isIncoming ? state.caller : state.participants.find((p: any) => p.id !== currentUserId)
    const isRinging = state.isIncoming && state.status === 'ringing'
    const isConnecting = state.status === 'calling'
    const isConnected = state.status === 'connected'
    const remoteCount = Object.keys(remoteStreams).length
    const totalParticipants = state.participants.length

    const showVideoUpgradeRequest = state.videoUpgradeRequest === 'pending' && state.videoUpgradeInitiator !== null && state.videoUpgradeInitiator !== currentUserId
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

                    {/* Main View (Remote Video Grid or Avatar) */}
                    <div className={`flex-1 relative bg-gray-800 p-2 overflow-hidden group`}>
                        <div className={`grid h-full w-full gap-2 transition-all duration-500 
                            ${remoteCount === 1 ? 'grid-cols-1' :
                                remoteCount === 2 ? 'grid-cols-2' :
                                    remoteCount <= 4 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-3'}`}>

                            {/* Remote Participants */}
                            {Object.entries(remoteStreams).map(([userId, stream]) => {
                                const participantInfo = state.participants.find((p: any) => p.id === userId)
                                const remoteVideoOff = participantInfo?.isCameraOff
                                const remoteMuted = participantInfo?.isMuted

                                return (
                                    <div key={userId} className="relative bg-gray-900 rounded-2xl overflow-hidden group/video border border-white/5">
                                        {state.type === 'video' && !remoteVideoOff ? (
                                            <video
                                                ref={el => { remoteVideoRefs.current[userId] = el }}
                                                autoPlay
                                                playsInline
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-gray-800 to-gray-950">
                                                <EmployeeAvatar
                                                    avatarUrl={participantInfo?.avatar || null}
                                                    fullName={participantInfo?.name || 'User'}
                                                    className="w-24 h-24 text-2xl border-2 border-indigo-500/20 shadow-xl"
                                                />
                                                <div className="text-center">
                                                    <p className="text-white font-medium">{participantInfo?.name || 'Inconnu'}</p>
                                                    <p className="text-indigo-400 text-[10px] uppercase tracking-widest font-bold">
                                                        {remoteVideoOff ? 'Caméra désactivée' : 'Audio uniquement'}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Status Overlays */}
                                        <div className="absolute top-4 right-4 flex gap-2">
                                            {remoteMuted && (
                                                <div className="p-2 bg-red-500/80 backdrop-blur-md rounded-lg border border-red-400/50 shadow-lg">
                                                    <MicOff className="w-4 h-4 text-white" />
                                                </div>
                                            )}
                                            {remoteVideoOff && state.type === 'video' && (
                                                <div className="p-2 bg-gray-800/80 backdrop-blur-md rounded-lg border border-white/10 shadow-lg">
                                                    <VideoOff className="w-4 h-4 text-white" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Name Tag */}
                                        <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                            <p className="text-white text-[11px] font-bold uppercase tracking-wider">{participantInfo?.name}</p>
                                        </div>

                                        <audio ref={el => { remoteAudioRefs.current[userId] = el }} autoPlay playsInline />
                                    </div>
                                )
                            })}

                            {/* Local Video in Grid for Group Calls (3+ participants total) */}
                            {isConnected && totalParticipants > 2 && state.type === 'video' && (
                                <div className="relative bg-gray-900 rounded-2xl overflow-hidden group/video border-2 border-indigo-500/30 shadow-inner">
                                    {!isCameraOff ? (
                                        <video
                                            ref={localVideoRef}
                                            autoPlay
                                            muted
                                            playsInline
                                            style={{ transform: 'scaleX(-1)' }}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gray-800">
                                            <EmployeeAvatar
                                                avatarUrl={null}
                                                fullName="Moi"
                                                className="w-20 h-20 text-xl border-2 border-indigo-500/20"
                                            />
                                            <p className="text-gray-400 text-xs font-bold uppercase">Ma caméra est coupée</p>
                                        </div>
                                    )}
                                    <div className="absolute top-4 right-4 flex gap-2">
                                        {isMuted && (
                                            <div className="p-2 bg-red-500/80 backdrop-blur-md rounded-lg border border-red-400/50 shadow-lg">
                                                <MicOff className="w-4 h-4 text-white" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-indigo-600/60 backdrop-blur-md rounded-xl border border-indigo-400/30">
                                        <p className="text-white text-[11px] font-bold uppercase tracking-wider">Moi (Aperçu)</p>
                                    </div>
                                </div>
                            )}

                            {/* Show placeholder if no remote streams connected yet OR if ringing */}
                            {(remoteCount === 0 || isRinging) && (
                                <div className="flex flex-col items-center justify-center h-full w-full gap-6">
                                    <div className="relative">
                                        <EmployeeAvatar
                                            avatarUrl={participant?.avatar || null}
                                            fullName={participant?.name || 'User'}
                                            className={`${isMinimized ? 'w-16 h-16' : 'w-32 h-32'} text-4xl border-4 border-indigo-500/30 animate-pulse`}
                                        />
                                        <div className="absolute -bottom-2 -right-2 bg-indigo-600 p-2 rounded-full shadow-lg border-2 border-gray-900">
                                            {state.type === 'video' ? <Video className="w-5 h-5 text-white" /> : <Phone className="w-5 h-5 text-white" />}
                                        </div>
                                    </div>
                                    {!isMinimized && (
                                        <div className="text-center max-w-md px-6">
                                            <h2 className="text-2xl font-black text-white mb-2 leading-tight uppercase tracking-tight">
                                                {totalParticipants > 2 ? 'Appel de groupe' : participant?.name || 'Connexion...'}
                                            </h2>
                                            <p className="text-indigo-400 font-bold uppercase text-xs tracking-[0.2em] animate-pulse">
                                                {isRinging ? (totalParticipants > 2 ? '📞 On vous appelle pour rejoindre un appel en cours' : 'Appel entrant...') :
                                                    isConnecting ? 'Sécurisation de la connexion...' :
                                                        isConnected ? 'En attente des autres...' : 'Fin de l\'appel...'}
                                            </p>
                                            {totalParticipants > 2 && isRinging && (
                                                <div className="mt-4 flex flex-wrap justify-center gap-2">
                                                    {state.participants.map((p: any) => (
                                                        <div key={p.id} className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-full border border-white/10">
                                                            <div className="w-1 h-1 rounded-full bg-indigo-400"></div>
                                                            <span className="text-[10px] text-gray-300 font-medium">{p.name}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Local Video Preview (PICTURE IN PICTURE) - Only for 1-to-1 calls */}
                        {!isMinimized && state.type === 'video' && totalParticipants <= 2 && (
                            <div className="absolute top-6 right-6 w-1/4 aspect-video bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 z-10 transition-all hover:scale-105 active:scale-95">
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

                                    {state.type === 'video' && Object.keys(remoteStreams).length === 1 && (
                                        <button
                                            onClick={() => togglePiP(Object.keys(remoteStreams)[0])}
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

                                    {/* Add Participant Button */}
                                    {isConnected && (
                                        <button
                                            onClick={() => setShowInviteModal(true)}
                                            className="w-14 h-14 flex items-center justify-center rounded-full transition-all border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500 hover:text-emerald-300"
                                            title="Ajouter un participant"
                                        >
                                            <UserPlus className="w-6 h-6" />
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

                    {/* Invite Modal */}
                    {showInviteModal && (
                        <InviteParticipantModal
                            onClose={() => setShowInviteModal(false)}
                            onInvite={onInvite}
                            currentParticipants={state.participants}
                        />
                    )}

                    {/* Status Indicator (Simplified when minimized) */}
                    <div className={`absolute top-6 left-6 flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 z-50 ${isMinimized ? 'scale-75 origin-top-left' : ''}`}>
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
                        <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                            {isConnected ? formatDuration(duration) : state.status}
                        </span>
                    </div>

                    {/* Status Indicator (Simplified when minimized) */}

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
