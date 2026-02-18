'use client'

import React, { useRef, useEffect, useState } from 'react'
import { MicOff, VideoOff, Loader2, Monitor, MoreVertical, Ban, Mic } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import EmployeeAvatar from '@/components/employee-avatar'
import { cn } from '@/lib/utils'

interface VideoCardProps {
    stream: MediaStream | null
    participant: { id: string; name: string; avatar: string | null; role?: string }
    isLocal?: boolean
    isMuted: boolean
    isCameraOff: boolean
    isSharing: boolean
    isHost?: boolean
    connectionState?: string
    isMainStage?: boolean // True if this video is the "Presenting" focused one
    isActiveSpeaker?: boolean
    isHandRaised?: boolean
    className?: string
}

interface Reaction {
    id: string
    emoji: string
}

export const VideoCard = ({
    stream,
    participant,
    isLocal = false,
    isMuted,
    isCameraOff,
    isSharing,
    isHost = false,
    connectionState = 'connected',
    isMainStage = false,
    isActiveSpeaker = false,
    isHandRaised = false,
    className
}: VideoCardProps) => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [reactions, setReactions] = useState<Reaction[]>([])

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream
        }
    }, [stream])

    useEffect(() => {
        const handleReaction = (e: any) => {
            if (e.detail.userId === participant.id) {
                const id = Math.random().toString(36).substring(7)
                setReactions((prev: Reaction[]) => [...prev, { id, emoji: e.detail.emoji }])

                // Clear reaction after animation
                setTimeout(() => {
                    setReactions((prev: Reaction[]) => prev.filter((r: Reaction) => r.id !== id))
                }, 3000)
            }
        }

        window.addEventListener('meeting-reaction', handleReaction)
        return () => window.removeEventListener('meeting-reaction', handleReaction)
    }, [participant.id])

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={cn(
                "relative bg-white dark:bg-gray-800 rounded-3xl overflow-hidden border-2 shadow-2xl group transition-all duration-500 hover:shadow-indigo-500/10",
                isActiveSpeaker ? "border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.3)] scale-[1.02] z-10" : "border-gray-100 dark:border-white/5",
                className
            )}
        >
            {/* Floating Reactions */}
            <AnimatePresence>
                {reactions.map((r: Reaction) => (
                    <motion.div
                        key={r.id}
                        initial={{ y: 20, opacity: 0, scale: 0.5, x: Math.random() * 40 - 20 }}
                        animate={{
                            y: -150,
                            opacity: [0, 1, 1, 0],
                            scale: [0.5, 1.5, 1.5, 1],
                            x: Math.random() * 100 - 50
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 2.5, ease: "easeOut" }}
                        className="absolute bottom-10 left-1/2 -translate-x-1/2 text-4xl z-50 pointer-events-none"
                    >
                        {r.emoji}
                    </motion.div>
                ))}
            </AnimatePresence>
            {/* Video or Fallback */}
            {stream && !isCameraOff ? (
                <video
                    autoPlay
                    playsInline
                    muted={isLocal} // Always mute local video to prevent echo/feedback loop
                    ref={(el) => {
                        if (el && el.srcObject !== stream) {
                            el.srcObject = stream
                        }
                    }}
                    className={cn(
                        "w-full h-full object-cover transition-all duration-500",
                        isLocal && !isSharing ? "scale-x-[-1]" : "", // Mirror local camera, but NOT screen share
                        isMainStage ? "object-contain bg-black" : "object-cover"
                    )}
                />
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-gray-50 dark:bg-gray-900">
                    <div className="relative">
                        <EmployeeAvatar
                            avatarUrl={participant.avatar}
                            fullName={participant.name}
                            className={cn(
                                "border-4 border-white dark:border-white/5 shadow-2xl transition-all duration-500",
                                isMainStage ? "w-32 h-32 text-4xl" : "w-20 h-20 md:w-24 md:h-24 text-xl"
                            )}
                        />
                        {/* Only show spinner or error if it's REMOTE and failed/connecting */}
                        {!isLocal && !stream && connectionState !== 'connected' && (
                            <div className="absolute -bottom-2 -right-2 p-2 bg-indigo-600 rounded-full border-4 border-white dark:border-gray-900">
                                <Loader2 className="w-4 h-4 animate-spin text-white" />
                            </div>
                        )}
                        {/* Camera Off Icon for local or remote explicit off */}
                        {(isCameraOff || (isLocal && !stream)) && (
                            <div className="absolute -bottom-2 -right-2 p-3 bg-gray-100 dark:bg-gray-950 rounded-full border border-gray-200 dark:border-white/10 shadow-xl">
                                <VideoOff className="w-6 h-6 text-red-500" />
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        {connectionState !== 'connected' && !isLocal && (
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">
                                {connectionState === 'connecting' ? 'Négociation...' :
                                    connectionState === 'failed' ? 'Échec de connexion' : 'Attente...'}
                            </p>
                        )}
                        {isCameraOff && (
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Caméra désactivée</p>
                        )}
                    </div>
                </div>
            )}

            {/* Overlays */}
            <div className="absolute inset-x-0 bottom-0 p-4 md:p-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-end justify-between z-20 pointer-events-none">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <p className="text-xs md:text-sm font-black text-white dark:text-white uppercase tracking-wider truncate max-w-[12rem] text-shadow-sm">
                            {participant.name} {isLocal && '(Vous)'}
                        </p>
                        {isHost && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-[8px] font-black text-amber-500 uppercase tracking-widest backdrop-blur-md">
                                Host
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <p className="text-[9px] font-bold text-white/40 uppercase tracking-[0.2em]">{participant.role || 'Membre'}</p>
                        {isSharing && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-600/90 rounded-lg backdrop-blur-md border border-indigo-500/30">
                                <Monitor className="w-3 h-3 text-white" />
                                <span className="text-[8px] font-black text-white uppercase tracking-widest">Écran partagé</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {isMuted && (
                        <div className="p-1.5 bg-red-500/20 border border-red-500/30 rounded-lg backdrop-blur-md">
                            <MicOff className="w-3.5 h-3.5 text-red-500" />
                        </div>
                    )}
                    {/* Connection Status Dot */}
                    <div className={cn(
                        "w-2 h-2 rounded-full transition-all duration-300",
                        stream ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]" : "bg-yellow-500"
                    )} />
                </div>
            </div>

            {/* Top Right Status (Muted Big Icon) */}
            {isMuted && (
                <div className="absolute top-4 right-4 p-2 bg-red-500 rounded-xl shadow-xl shadow-red-500/20 z-20 border border-white/10 animate-in zoom-in-50 duration-200">
                    <MicOff className="w-4 h-4 text-white" />
                </div>
            )}

            {/* Hand Raised Icon */}
            {isHandRaised && (
                <div className="absolute top-4 left-4 p-2 bg-amber-500 rounded-xl shadow-xl shadow-amber-500/20 z-[25] border border-white/10 animate-bounce cursor-default">
                    <span className="text-lg">✋</span>
                </div>
            )}
        </motion.div>
    )
}
