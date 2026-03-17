'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Maximize2, Minimize2, User, PictureInPicture, MoveDownLeft, UserPlus, Monitor, MonitorOff, MoreVertical, Ban, UserX } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import InviteParticipantModal from './invite-participant-modal'
import EmployeeAvatar from '@/components/employee-avatar'
import { useCall } from '@/components/providers/call-provider'
import { useRouter } from 'next/navigation'
import ScreenShareLayout from '@/components/meetings/screen-share-layout'

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
    onStartScreenShare: () => void
    onStopScreenShare: () => void
    isScreenSharing: boolean
    screenSharingUserId: string | null
    screenStream: MediaStream | null
    isRecording?: boolean
    onKick?: (userId: string) => void
    onBlock?: (userId: string) => void
    isCurrentUserHost?: boolean
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
    currentUserId,
    onStartScreenShare,
    onStopScreenShare,
    isScreenSharing,
    screenSharingUserId,
    screenStream,
    isRecording,
    onKick,
    onBlock,
    isCurrentUserHost
}: CallOverlayProps) {
    const [activeMenu, setActiveMenu] = useState<string | null>(null)
    useEffect(() => {
        console.log('[CallOverlay] PROPS UPDATE:', {
            isScreenSharing, screenSharingUserId, currentUserId,
            stateType: state.type, stateStatus: state.status
        })
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
    const [showInviteModal, setShowInviteModal] = useState(false)
    const { isMinimized, setIsMinimized } = useCall()
    const router = useRouter()

    const lastLocalStream = useRef<string>('')


    // 🔔 FIX: Use callback ref to ensure video element gets stream immediately on mount
    const setLocalVideoRef = useCallback((element: HTMLVideoElement | null) => {
        if (element && localStream) {
            console.log('[CallOverlay] Attaching local stream to element via callback ref')
            element.srcObject = localStream
            element.play().catch(err => {
                if (err.name !== 'AbortError') console.error('[CallOverlay] Local video play error:', err)
            })
        }
    }, [localStream])

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
                    bg-gray-900 border-white/10 overflow-hidden shadow-2xl flex flex-col transition-all duration-300 ease-in-out group
                    ${isMinimized
                            ? 'absolute bottom-6 right-6 w-80 aspect-video rounded-xl pointer-events-auto border-2 border-indigo-500/50 hover:border-indigo-500'
                            : isFullscreen
                                ? 'relative w-full h-full max-w-none rounded-none'
                                : 'relative w-full max-w-4xl aspect-video rounded-3xl border'
                        }
                `}
                >
                    {/* Recording Indicator */}
                    {isRecording && (
                        <div className="absolute top-4 left-4 flex items-center gap-2 z-[200] bg-black/40 px-3 py-1.5 rounded-full border border-red-500/30 backdrop-blur-md">
                            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                            <span className="text-[10px] font-black text-white tracking-widest uppercase">REC</span>
                        </div>
                    )}

                    {/* Main View */}
                    {screenSharingUserId && !isMinimized ? (
                        /* ── Screen Share Layout (Google Meet style) ── */
                        <ScreenShareLayout
                            sharingStream={
                                screenSharingUserId === currentUserId
                                    ? screenStream
                                    : (remoteStreams[screenSharingUserId] || null)
                            }
                            presenterCameraStream={
                                screenSharingUserId === currentUserId
                                    ? localStream
                                    : (remoteStreams[screenSharingUserId] || null)
                            }
                            sharingUser={screenSharingUserId}
                            currentUserId={currentUserId}
                            remoteStreams={new Map(Object.entries(remoteStreams))}
                            localStream={localStream}
                            participants={state.participants.map((p: any) => ({
                                id: p.id,
                                name: p.name,
                                avatar: p.avatar || null,
                                role: p.role
                            }))}
                            participantStates={new Map(
                                state.participants.map((p: any) => [
                                    p.id,
                                    { isMuted: p.id === currentUserId ? isMuted : (p.isMuted || false), isCameraOff: p.id === currentUserId ? isCameraOff : (p.isCameraOff || false) }
                                ])
                            )}
                            isMuted={isMuted}
                            isCameraOff={isCameraOff}
                        />
                    ) : (
                        /* ── Normal Grid View ── */
                        <div className="flex-1 relative bg-gray-800 p-2 overflow-hidden">
                            <div className={`grid h-full w-full gap-2 transition-all duration-500 
                                ${state.participants.length <= 1 ? 'grid-cols-1' :
                                    state.participants.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
                                        state.participants.length <= 4 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-3'}`}>

                                {state.participants.filter((p: any) => {
                                    const total = state.participants.length
                                    if (total <= 2) return p.id !== currentUserId
                                    return true
                                }).map((p: any) => {
                                    const isLocal = p.id === currentUserId
                                    const stream = isLocal ? localStream : remoteStreams[p.id]
                                    const isVideoOff = isLocal ? isCameraOff : p.isCameraOff
                                    const isAudioMuted = isLocal ? isMuted : p.isMuted

                                    return (
                                        <div key={p.id} className="relative bg-gray-900 rounded-2xl overflow-hidden group/video border border-white/5 shadow-lg">
                                            {state.type === 'video' && !isVideoOff && stream ? (
                                                <video
                                                    ref={isLocal ? setLocalVideoRef : (el) => {
                                                        if (el && stream && el.srcObject !== stream) {
                                                            el.srcObject = stream
                                                            el.play().catch(e => console.error('Remote play error', e))
                                                        }
                                                        if (!isLocal) remoteVideoRefs.current[p.id] = el
                                                    }}
                                                    autoPlay
                                                    muted={isLocal}
                                                    playsInline
                                                    style={isLocal ? { transform: 'scaleX(-1)' } : undefined}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-gray-800 to-gray-950">
                                                    <EmployeeAvatar avatarUrl={p.avatar} fullName={p.name} className="w-24 h-24 text-2xl border-2 border-indigo-500/20 shadow-xl" />
                                                </div>
                                            )}
                                            {!isLocal && (
                                                <audio autoPlay playsInline ref={(el) => {
                                                    if (el && stream && stream.getAudioTracks().length > 0 && el.srcObject !== stream) { el.srcObject = stream; el.play().catch(() => { }) }
                                                }} />
                                            )}
                                            <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${stream ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-white text-[11px] font-bold uppercase tracking-wider">{p.name} {isLocal && '(Moi)'}</p>
                                                        {((!state.isIncoming && isLocal) || (state.isIncoming && p.id === state.caller?.id)) && (
                                                            <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-[7px] font-black text-amber-500 uppercase tracking-widest">
                                                                Host
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {isAudioMuted && <MicOff className="w-3 h-3 text-red-400" />}
                                            </div>

                                            {/* Host Management Controls */}
                                            {isCurrentUserHost && !isLocal && (
                                                <div className="absolute top-4 right-4 z-30">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setActiveMenu(activeMenu === p.id ? null : p.id)
                                                        }}
                                                        className="p-2 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-xl text-white transition-opacity border border-white/10 opacity-0 group-hover/video:opacity-100"
                                                    >
                                                        <MoreVertical className="w-5 h-5" />
                                                    </button>

                                                    <AnimatePresence>
                                                        {activeMenu === p.id && (
                                                            <>
                                                                <motion.div
                                                                    initial={{ opacity: 0 }}
                                                                    animate={{ opacity: 1 }}
                                                                    exit={{ opacity: 0 }}
                                                                    className="fixed inset-0 z-40"
                                                                    onClick={() => setActiveMenu(null)}
                                                                />
                                                                <motion.div
                                                                    initial={{ opacity: 0, scale: 0.9, y: -10 }}
                                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                                                    className="absolute right-0 mt-2 w-48 bg-gray-900/95 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl z-50 overflow-hidden"
                                                                >
                                                                    <div className="p-2 space-y-1">
                                                                        <button
                                                                            onClick={() => {
                                                                                if (window.confirm(`Expulser ${p.name} ?`)) {
                                                                                    onKick?.(p.id)
                                                                                }
                                                                                setActiveMenu(null)
                                                                            }}
                                                                            className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                                                                        >
                                                                            <UserX className="w-4 h-4" />
                                                                            Expulser
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                if (window.confirm(`Bloquer ${p.name} définitivement pour cette session ?`)) {
                                                                                    onBlock?.(p.id)
                                                                                }
                                                                                setActiveMenu(null)
                                                                            }}
                                                                            className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-gray-300 hover:bg-white/10 rounded-xl transition-colors"
                                                                        >
                                                                            <Ban className="w-4 h-4" />
                                                                            Bloquer l'accès
                                                                        </button>
                                                                    </div>
                                                                </motion.div>
                                                            </>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                    {/* Local Video Preview (PICTURE IN PICTURE) - Only for 1-to-1 calls */}
                    {!isMinimized && state.type === 'video' && totalParticipants <= 2 && (
                        <div className="absolute top-6 right-6 w-1/4 aspect-video bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 z-10 transition-all hover:scale-105 active:scale-95">
                            {isCameraOff ? (
                                <div className="w-full h-full flex items-center justify-center bg-gray-800">
                                    <VideoOff className="w-8 h-8 text-gray-600" />
                                </div>
                            ) : (
                                <video
                                    ref={setLocalVideoRef}
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
                                    {/* Screen Share Button */}
                                    <button
                                        onClick={isScreenSharing && screenSharingUserId === currentUserId ? onStopScreenShare : onStartScreenShare}
                                        disabled={isScreenSharing && screenSharingUserId !== currentUserId}
                                        className={`w-14 h-14 flex items-center justify-center rounded-full transition-all border ${isScreenSharing && screenSharingUserId === currentUserId ? 'bg-indigo-500/20 border-indigo-500 text-indigo-500' : 'bg-white/10 border-white/10 text-white hover:bg-white/20'} ${isScreenSharing && screenSharingUserId !== currentUserId ? 'opacity-50 cursor-not-allowed' : ''} z-[100]`}
                                        title={isScreenSharing && screenSharingUserId === currentUserId ? "Arrêter le partage" : "Partager l'écran"}
                                    >
                                        {isScreenSharing && screenSharingUserId === currentUserId ? <MonitorOff className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
                                    </button>

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
                                            title={isCameraOff ? "Activer la caméra" : "Désactiver la caméra"}
                                        >
                                            {isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                                        </button>
                                    )}

                                    {/* Video Upgrade Button - Only visible during audio calls */}
                                    {state.type === 'audio' && state.status === 'connected' && !state.videoUpgradeRequest && !isScreenSharing && (
                                        <button
                                            onClick={onRequestVideoUpgrade}
                                            className="w-14 h-14 flex items-center justify-center rounded-full transition-all border bg-indigo-500/20 border-indigo-500 text-indigo-400 hover:bg-indigo-500/30 hover:border-indigo-400 hover:text-indigo-300 animate-pulse"
                                            title="Passer en appel vidéo"
                                        >
                                            <Video className="w-6 h-6" />
                                        </button>
                                    )}

                                    {/* Add Participant Button - Restricted to Host */}
                                    {isConnected && isCurrentUserHost && (
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
            </div >
        </>
    )

    // Helper function for minimizing
    function toggleMinimize() {
        setIsMinimized(!isMinimized)
    }
}
