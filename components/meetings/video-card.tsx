'use client'

import React from 'react'
import { MicOff, VideoOff, Loader2, Monitor } from 'lucide-react'
import { motion } from 'framer-motion'
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
    className?: string
}

export default function VideoCard({
    stream,
    participant,
    isLocal = false,
    isMuted,
    isCameraOff,
    isSharing,
    isHost = false,
    connectionState = 'connected',
    isMainStage = false,
    className
}: VideoCardProps) {

    return (
        <motion.div
            layoutId={`video-${participant.id}`}
            className={cn(
                "relative bg-gray-800 rounded-3xl overflow-hidden border border-white/5 shadow-2xl group transition-all duration-500 hover:shadow-indigo-500/10",
                className
            )}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
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
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-gray-900">
                    <div className="relative">
                        <EmployeeAvatar
                            avatarUrl={participant.avatar}
                            fullName={participant.name}
                            className={cn(
                                "border-4 border-white/5 shadow-2xl transition-all duration-500",
                                isMainStage ? "w-32 h-32 text-4xl" : "w-20 h-20 md:w-24 md:h-24 text-xl"
                            )}
                        />
                        {/* Only show spinner or error if it's REMOTE and failed/connecting */}
                        {!isLocal && !stream && connectionState !== 'connected' && (
                            <div className="absolute -bottom-2 -right-2 p-2 bg-indigo-600 rounded-full border-4 border-gray-900">
                                <Loader2 className="w-4 h-4 animate-spin text-white" />
                            </div>
                        )}
                        {/* Camera Off Icon for local or remote explicit off */}
                        {(isCameraOff || (isLocal && !stream)) && (
                            <div className="absolute -bottom-2 -right-2 p-3 bg-gray-950 rounded-full border border-white/10 shadow-xl">
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
                        <p className="text-xs md:text-sm font-black text-white uppercase tracking-wider truncate max-w-[12rem] text-shadow-sm">
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
        </motion.div>
    )
}
