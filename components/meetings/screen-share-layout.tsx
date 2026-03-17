'use client'

import React, { useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
    Mic, MicOff, Video, VideoOff, X, Maximize2, Minimize2, 
    Monitor, ChevronLeft, ChevronRight, MoreVertical, Ban, UserX 
} from 'lucide-react'
import EmployeeAvatar from '@/components/employee-avatar'
import { cn } from '@/lib/utils'

interface Participant {
    id: string
    name: string
    avatar: string | null
    role?: string
}

interface ParticipantState {
    isMuted: boolean
    isCameraOff: boolean
    isRecording?: boolean
    isScreenSharing?: boolean
}

interface ScreenShareLayoutProps {
    sharingStream: MediaStream | null
    presenterCameraStream: MediaStream | null
    sharingUser: string | null
    currentUserId: string
    remoteStreams: Map<string, MediaStream>
    localStream: MediaStream | null
    participants: Participant[]
    participantStates: Map<string, ParticipantState>
    isMuted: boolean
    isCameraOff: boolean
    connectionStates?: Map<string, RTCPeerConnectionState>
    isCurrentUserHost?: boolean
    onKick?: (userId: string) => void
    onBlock?: (userId: string) => void
}

export default function ScreenShareLayout({
    sharingStream,
    presenterCameraStream,
    sharingUser,
    currentUserId,
    remoteStreams,
    localStream,
    participants,
    participantStates,
    isMuted,
    isCameraOff,
    isCurrentUserHost = false,
    onKick,
    onBlock
}: ScreenShareLayoutProps) {
    const isLocalPresenter = sharingUser === currentUserId
    const presenterParticipant = participants.find(p => p.id === sharingUser)

    // ── Shared state ──
    const stripRef = useRef<HTMLDivElement>(null)
    const scrollStrip = (dir: 'left' | 'right') => {
        stripRef.current?.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' })
    }

    return isLocalPresenter
        ? <PresenterView
            sharingStream={sharingStream}
            localStream={localStream}
            participants={participants}
            remoteStreams={remoteStreams}
            participantStates={participantStates}
            currentUserId={currentUserId}
            isMuted={isMuted}
            isCameraOff={isCameraOff}
            presenterParticipant={presenterParticipant}
            isCurrentUserHost={isCurrentUserHost}
            onKick={onKick}
            onBlock={onBlock}
        />
        : <AudienceView
            sharingStream={sharingStream}
            presenterCameraStream={presenterCameraStream}
            presenterParticipant={presenterParticipant}
            isLocalPresenter={false}
            sharingUser={sharingUser}
            participants={participants}
            remoteStreams={remoteStreams}
            participantStates={participantStates}
            currentUserId={currentUserId}
            isMuted={isMuted}
            isCameraOff={isCameraOff}
            stripRef={stripRef}
            scrollStrip={scrollStrip}
            isCurrentUserHost={isCurrentUserHost}
            onKick={onKick}
            onBlock={onBlock}
        />
}

/* ──────────────────────────────────────────────────────────────
   PRESENTER VIEW
   The local user is sharing — show participants as main view
   + small floating draggable preview of their screen
────────────────────────────────────────────────────────────── */
function PresenterView({
    sharingStream,
    localStream,
    participants,
    remoteStreams,
    participantStates,
    currentUserId,
    isMuted,
    isCameraOff,
    presenterParticipant,
    isCurrentUserHost,
    onKick,
    onBlock
}: {
    sharingStream: MediaStream | null
    localStream: MediaStream | null
    participants: Participant[]
    remoteStreams: Map<string, MediaStream>
    participantStates: Map<string, ParticipantState>
    currentUserId: string
    isMuted: boolean
    isCameraOff: boolean
    presenterParticipant: Participant | undefined
    isCurrentUserHost?: boolean
    onKick?: (id: string) => void
    onBlock?: (id: string) => void
}) {
    const [showScreenPreview, setShowScreenPreview] = useState(true)
    const [previewExpanded, setPreviewExpanded] = useState(false)
    const screenPreviewRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        if (screenPreviewRef.current && sharingStream) {
            if (screenPreviewRef.current.srcObject !== sharingStream) {
                screenPreviewRef.current.srcObject = sharingStream
                screenPreviewRef.current.play().catch(() => { })
            }
        }
    }, [sharingStream])

    const cols = participants.length <= 1 ? 'grid-cols-1'
        : participants.length === 2 ? 'grid-cols-1 md:grid-cols-2'
            : participants.length <= 4 ? 'grid-cols-2'
                : 'grid-cols-2 lg:grid-cols-3'

    return (
        <div className="flex flex-col w-full h-full overflow-hidden bg-gray-950 relative">
            {/* Presenting banner */}
            <div className="shrink-0 px-6 py-2 bg-indigo-600/90 backdrop-blur-md flex items-center gap-3 border-b border-indigo-500/30">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-[11px] font-black text-white uppercase tracking-widest">
                    Vous partagez votre écran — Mode Présentateur
                </span>
                <div className="ml-auto flex items-center gap-2">
                    {isMuted && (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-red-500/30 rounded-lg border border-red-400/30">
                            <MicOff className="w-3 h-3 text-red-300" />
                            <span className="text-[9px] font-bold text-red-300 uppercase">Muet</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Participants grid (main view for presenter) */}
            <div className="flex-1 p-4 overflow-y-auto">
                <div className={`grid gap-3 h-full ${cols}`}>
                    {participants.map(p => {
                        const isLocal = p.id === currentUserId
                        const stream = isLocal ? localStream : (remoteStreams.get(p.id) || null)
                        const state = isLocal
                            ? { isMuted, isCameraOff }
                            : (participantStates.get(p.id) || { isMuted: false, isCameraOff: false })
                        return (
                            <ThumbnailCard
                                key={p.id}
                                participant={p}
                                stream={stream}
                                isLocal={isLocal}
                                isPresenter={isLocal}
                                isMuted={state.isMuted}
                                isCameraOff={state.isCameraOff}
                                large
                                isCurrentUserHost={isCurrentUserHost}
                                onKick={onKick}
                                onBlock={onBlock}
                            />
                        )
                    })}
                </div>
            </div>

            {/* ── Floating Screen Preview (draggable) ── */}
            <AnimatePresence>
                {showScreenPreview && (
                    <motion.div
                        drag
                        dragMomentum={false}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onDoubleClick={() => setPreviewExpanded(v => !v)}
                        className={cn(
                            "absolute bottom-6 right-6 z-50 rounded-2xl overflow-hidden",
                            "border-2 border-white/20 shadow-2xl shadow-black/60 cursor-grab active:cursor-grabbing",
                            "bg-gray-900 transition-[width] duration-300",
                            previewExpanded ? "w-96 aspect-video" : "w-56 aspect-video"
                        )}
                    >
                        {/* Screen preview video */}
                        {sharingStream ? (
                            <video
                                ref={screenPreviewRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-contain bg-black"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-900">
                                <Monitor className="w-8 h-8 text-gray-600" />
                            </div>
                        )}

                        {/* Overlay controls */}
                        <div className="absolute inset-0 flex flex-col justify-between p-2 pointer-events-none">
                            {/* Top bar */}
                            <div className="flex items-center justify-between pointer-events-auto">
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-lg">
                                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                    <span className="text-[8px] font-black text-white uppercase tracking-wider">
                                        LIVE
                                    </span>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setPreviewExpanded(v => !v)}
                                        className="p-1 bg-black/50 hover:bg-black/70 text-white rounded-lg transition-all"
                                    >
                                        {previewExpanded
                                            ? <Minimize2 className="w-3 h-3" />
                                            : <Maximize2 className="w-3 h-3" />}
                                    </button>
                                    <button
                                        onClick={() => setShowScreenPreview(false)}
                                        className="p-1 bg-black/50 hover:bg-red-600/80 text-white rounded-lg transition-all"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>

                            {/* Bottom label */}
                            <div className="flex items-center gap-1.5 pointer-events-none">
                                <Monitor className="w-3 h-3 text-indigo-300" />
                                <span className="text-[9px] font-bold text-white/80 uppercase tracking-wider">
                                    Votre écran partagé
                                </span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Restore preview button if hidden */}
            {!showScreenPreview && (
                <button
                    onClick={() => setShowScreenPreview(true)}
                    className="absolute bottom-6 right-6 z-50 px-3 py-2 bg-gray-800 hover:bg-gray-700
                               text-white text-[10px] font-black uppercase tracking-widest rounded-xl
                               shadow-xl border border-white/10 transition-all flex items-center gap-2"
                >
                    <Monitor className="w-3.5 h-3.5" />
                    Aperçu du partage
                </button>
            )}
        </div>
    )
}

/* ──────────────────────────────────────────────────────────────
   AUDIENCE VIEW
   Another user is sharing — show screen as main content
   + thumbnail strip at bottom + floating presenter camera
────────────────────────────────────────────────────────────── */
function AudienceView({
    sharingStream,
    presenterCameraStream,
    presenterParticipant,
    sharingUser,
    participants,
    remoteStreams,
    participantStates,
    currentUserId,
    isMuted,
    isCameraOff,
    stripRef,
    scrollStrip,
    isCurrentUserHost,
    onKick,
    onBlock
}: {
    sharingStream: MediaStream | null
    presenterCameraStream: MediaStream | null
    presenterParticipant: Participant | undefined
    isLocalPresenter: boolean
    sharingUser: string | null
    participants: Participant[]
    remoteStreams: Map<string, MediaStream>
    participantStates: Map<string, ParticipantState>
    currentUserId: string
    isMuted: boolean
    isCameraOff: boolean
    stripRef: React.RefObject<HTMLDivElement | null>
    scrollStrip: (dir: 'left' | 'right') => void
    isCurrentUserHost?: boolean
    onKick?: (id: string) => void
    onBlock?: (id: string) => void
}) {
    const mainVideoRef = useRef<HTMLVideoElement>(null)
    const presenterCamRef = useRef<HTMLVideoElement>(null)
    const [showPresenterCam, setShowPresenterCam] = useState(true)
    const [presenterCamExpanded, setPresenterCamExpanded] = useState(false)

    useEffect(() => {
        if (mainVideoRef.current && sharingStream) {
            if (mainVideoRef.current.srcObject !== sharingStream) {
                mainVideoRef.current.srcObject = sharingStream
                mainVideoRef.current.play().catch(() => { })
            }
        }
    }, [sharingStream])

    useEffect(() => {
        if (presenterCamRef.current && presenterCameraStream) {
            if (presenterCamRef.current.srcObject !== presenterCameraStream) {
                presenterCamRef.current.srcObject = presenterCameraStream
                presenterCamRef.current.play().catch(() => { })
            }
        }
    }, [presenterCameraStream])

    const presenterState = participantStates.get(sharingUser || '') || { isMuted: false, isCameraOff: false }

    return (
        <div className="flex flex-col w-full h-full overflow-hidden bg-gray-950">
            {/* Main Stage */}
            <div className="flex-1 relative overflow-hidden bg-black">
                {/* Label */}
                <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5
                                bg-indigo-600/90 backdrop-blur-md rounded-xl border border-indigo-400/20 shadow-xl">
                    <Monitor className="w-3.5 h-3.5 text-white" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">
                        {presenterParticipant ? `${presenterParticipant.name} partage son écran` : "Partage d'écran"}
                    </span>
                </div>

                {/* Shared screen */}
                {sharingStream ? (
                    <video
                        ref={mainVideoRef}
                        autoPlay playsInline muted
                        className="w-full h-full object-contain"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="flex flex-col items-center gap-4 text-gray-600">
                            <Monitor className="w-16 h-16" />
                            <p className="text-sm font-bold uppercase tracking-widest">En attente du flux...</p>
                        </div>
                    </div>
                )}

                {/* Floating presenter camera */}
                <AnimatePresence>
                    {showPresenterCam && presenterCameraStream && (
                        <motion.div
                            drag
                            dragMomentum={false}
                            dragConstraints={{ left: -9999, right: 0, top: -9999, bottom: 0 }}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            onDoubleClick={() => setPresenterCamExpanded(v => !v)}
                            className={cn(
                                "absolute bottom-4 right-4 z-30 rounded-2xl overflow-hidden",
                                "border-2 border-indigo-500/60 shadow-2xl shadow-black/50",
                                "cursor-grab active:cursor-grabbing bg-gray-900 transition-[width] duration-300",
                                presenterCamExpanded ? "w-72 aspect-video" : "w-44 aspect-video"
                            )}
                        >
                            {!presenterState.isCameraOff ? (
                                <video
                                    ref={presenterCamRef}
                                    autoPlay playsInline muted={false}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-800">
                                    <EmployeeAvatar
                                        avatarUrl={presenterParticipant?.avatar || null}
                                        fullName={presenterParticipant?.name || 'Présentateur'}
                                        className="w-12 h-12 text-lg"
                                    />
                                </div>
                            )}
                            <div className="absolute inset-0 flex flex-col justify-between p-2 pointer-events-none">
                                <div className="flex justify-end gap-1 pointer-events-auto">
                                    <button
                                        onClick={() => setPresenterCamExpanded(v => !v)}
                                        className="p-1 bg-black/50 hover:bg-black/70 text-white rounded-lg transition-all"
                                    >
                                        <Maximize2 className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={() => setShowPresenterCam(false)}
                                        className="p-1 bg-black/50 hover:bg-red-600 text-white rounded-lg transition-all"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between pointer-events-none">
                                    <span className="text-[9px] font-black text-white uppercase tracking-wider
                                                     bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg truncate max-w-[80%]">
                                        {presenterParticipant?.name || 'Présentateur'}
                                    </span>
                                    {presenterState.isMuted && (
                                        <div className="p-1 bg-red-500/80 rounded-md">
                                            <MicOff className="w-3 h-3 text-white" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {!showPresenterCam && (
                    <button
                        onClick={() => setShowPresenterCam(true)}
                        className="absolute bottom-4 right-4 z-30 px-3 py-2 bg-indigo-600 hover:bg-indigo-500
                                   text-white text-[10px] font-black uppercase tracking-widest rounded-xl
                                   shadow-xl border border-indigo-400/30 transition-all flex items-center gap-2"
                    >
                        <Video className="w-3 h-3" />
                        Caméra du présentateur
                    </button>
                )}
            </div>

            {/* Thumbnail strip */}
            <div className="h-28 bg-gray-900/80 backdrop-blur-md border-t border-white/5 flex items-center px-2 relative shrink-0">
                {participants.length > 4 && (
                    <button
                        onClick={() => scrollStrip('left')}
                        className="absolute left-0 z-10 h-full px-2 bg-gradient-to-r from-gray-900 to-transparent text-gray-400 hover:text-white"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                )}
                <div
                    ref={stripRef}
                    className="flex gap-2 overflow-x-auto px-6 py-2 w-full"
                    style={{ scrollbarWidth: 'none' }}
                >
                    {participants.map(p => {
                        const isLocal = p.id === currentUserId
                        const isPresenter = p.id === sharingUser
                        const stream = isLocal ? null : (remoteStreams.get(p.id) || null)
                        const state = isLocal
                            ? { isMuted, isCameraOff }
                            : (participantStates.get(p.id) || { isMuted: false, isCameraOff: false })
                        return (
                            <ThumbnailCard
                                key={p.id}
                                participant={p}
                                stream={stream}
                                isLocal={isLocal}
                                isPresenter={isPresenter}
                                isMuted={state.isMuted}
                                isCameraOff={state.isCameraOff}
                                isCurrentUserHost={isCurrentUserHost}
                                onKick={onKick}
                                onBlock={onBlock}
                            />
                        )
                    })}
                </div>
                {participants.length > 4 && (
                    <button
                        onClick={() => scrollStrip('right')}
                        className="absolute right-0 z-10 h-full px-2 bg-gradient-to-l from-gray-900 to-transparent text-gray-400 hover:text-white"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                )}
            </div>
        </div>
    )
}

/* ── Thumbnail Card ──────────────────────────────────────────── */
function ThumbnailCard({
    participant,
    stream,
    isLocal,
    isPresenter,
    isMuted,
    isCameraOff,
    large = false,
    isCurrentUserHost,
    onKick,
    onBlock
}: {
    participant: Participant
    stream: MediaStream | null
    isLocal: boolean
    isPresenter: boolean
    isMuted: boolean
    isCameraOff: boolean
    large?: boolean
    isCurrentUserHost?: boolean
    onKick?: (id: string) => void
    onBlock?: (id: string) => void
}) {
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        if (videoRef.current && stream) {
            if (videoRef.current.srcObject !== stream) {
                videoRef.current.srcObject = stream
                videoRef.current.play().catch(() => { })
            }
        }
    }, [stream])

    return (
        <div className={cn(
            "relative overflow-hidden border-2 transition-all duration-300 bg-gray-800 shadow-lg",
            large
                ? "rounded-2xl w-full h-full min-h-[160px]"
                : "shrink-0 w-36 h-20 rounded-xl cursor-pointer hover:scale-105",
            isPresenter
                ? "border-indigo-500 shadow-indigo-500/30"
                : "border-white/10 hover:border-indigo-400/50"
        )}>
            {stream && !isCameraOff ? (
                <video
                    ref={videoRef}
                    autoPlay playsInline muted={isLocal}
                    className={cn("w-full h-full object-cover", isLocal ? "scale-x-[-1]" : "")}
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-800">
                    <EmployeeAvatar
                        avatarUrl={participant.avatar}
                        fullName={participant.name}
                        className={large ? "w-16 h-16 text-xl" : "w-10 h-10 text-sm"}
                    />
                </div>
            )}
            {isPresenter && (
                <div className="absolute top-1 left-1 flex items-center gap-1 px-1.5 py-0.5
                                bg-indigo-600/90 rounded-md border border-indigo-400/30">
                    <Monitor className="w-2.5 h-2.5 text-white" />
                    <span className="text-[7px] font-black text-white uppercase tracking-wider">Présente</span>
                </div>
            )}
            <div className="absolute inset-x-0 bottom-0 px-2 py-1 bg-gradient-to-t from-black/90 to-transparent
                            flex items-end justify-between group">
                <span className={cn("font-bold text-white truncate max-w-[80%]", large ? "text-[11px]" : "text-[9px]")}>
                    {participant.name} {isLocal && '(Moi)'}
                </span>
                
                {/* Host Controls in Thumbnail */}
                {isCurrentUserHost && !isLocal && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Expulser ${participant.name} ?`)) onKick?.(participant.id);
                            }}
                            className="p-1 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                        >
                            <UserX className="w-3 h-3" />
                        </button>
                    </div>
                )}

                <div className="flex items-center gap-1">
                    {isMuted && <MicOff className={large ? "w-3.5 h-3.5 text-red-400" : "w-2.5 h-2.5 text-red-400"} />}
                    {isCameraOff && <VideoOff className={large ? "w-3.5 h-3.5 text-red-400" : "w-2.5 h-2.5 text-red-400"} />}
                </div>
            </div>
        </div>
    )
}
