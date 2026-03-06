'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Mic, MicOff, Video, VideoOff, PhoneOff, Maximize2, Minimize2, GripVertical, Monitor } from 'lucide-react'
import { useCall } from '@/components/providers/call-provider'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

import MeetingRoom from '@/components/meetings/meeting-room'

export default function MiniCallBar() {
    const router = useRouter()
    const containerRef = useRef<HTMLDivElement>(null)
    const [isExpanded, setIsExpanded] = useState(true)
    const handleExpand = () => setIsExpanded(!isExpanded)

    const {
        isInCall,
        meetingId,
        meeting,
        isMuted,
        isCameraOff,
        toggleMute,
        toggleCamera,
        endCall,
        activeSpeaker,
        remoteStreams,
        localStream,
        currentUser,
        sharingUser,
        screenStream,
        isMinimized,
        setIsMinimized
    } = useCall()

    const pathname = usePathname()

    // Don't show anything globally if not in call or missing data
    // OR if we are already on the meetings page (to avoid overlap)
    if (!isInCall || !meetingId || !meeting || !currentUser || pathname.startsWith('/meetings/')) return null

    // Determine what to show in the video preview
    const presenterId = sharingUser || activeSpeaker
    const isLocalPresenter = presenterId === currentUser?.id
    const previewStream = sharingUser
        ? (isLocalPresenter ? screenStream : remoteStreams.get(sharingUser))
        : (isLocalPresenter ? localStream : remoteStreams.get(presenterId || ''))

    return (
        <AnimatePresence>
            <motion.div
                ref={containerRef}
                drag
                dragMomentum={false}
                dragConstraints={{ left: -1000, right: 0, top: -1000, bottom: 0 }}
                initial={{ x: 0, y: 100, opacity: 0 }}
                animate={{ x: 0, y: 0, opacity: 1 }}
                exit={{ x: 0, y: 100, opacity: 0 }}
                className={cn(
                    "fixed bottom-6 right-6 z-[100] flex flex-col items-center gap-2 transition-all duration-500",
                    isExpanded ? "w-72" : "w-16"
                )}
            >
                {/* Video Preview / Avatar Section */}
                {isExpanded && (
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-full aspect-video bg-gray-950 rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden relative group group/video"
                    >
                        {previewStream ? (
                            <video
                                autoPlay
                                playsInline
                                muted={true}
                                ref={(el) => {
                                    if (el && el.srcObject !== previewStream) {
                                        el.srcObject = previewStream
                                    }
                                }}
                                className={cn(
                                    "w-full h-full object-cover",
                                    isLocalPresenter && !sharingUser ? "scale-x-[-1]" : ""
                                )}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-indigo-600/10">
                                <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center animate-pulse">
                                    <Video className="w-6 h-6 text-white" />
                                </div>
                            </div>
                        )}

                        {/* Overlay Icons */}
                        <div className="absolute top-3 left-3 flex gap-2">
                            {sharingUser && (
                                <div className="p-1.5 bg-indigo-600 rounded-lg shadow-lg border border-white/10">
                                    <Monitor className="w-3 h-3 text-white" />
                                </div>
                            )}
                            {activeSpeaker && !sharingUser && (
                                <div className="p-1.5 bg-green-500 rounded-lg shadow-lg border border-white/10">
                                    <Mic className="w-3 h-3 text-white" />
                                </div>
                            )}
                        </div>

                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/video:opacity-100 transition-opacity flex items-center justify-center gap-4">
                            <button
                                onClick={() => router.push(`/meetings/${meetingId}`)}
                                className="p-3 bg-white text-gray-950 rounded-full shadow-xl hover:scale-110 transition-transform"
                            >
                                <Maximize2 className="w-5 h-5" />
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Control Bar */}
                <div className={cn(
                    "flex items-center gap-2 p-2 bg-gray-950/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl",
                    isExpanded ? "w-full justify-between pr-4" : "flex-col py-4"
                )}>
                    {isExpanded ? (
                        <>
                            <div className="flex items-center gap-3 pl-2">
                                <div className="p-1.5 bg-white/5 rounded-full cursor-grab active:cursor-grabbing">
                                    <GripVertical className="w-4 h-4 text-gray-500" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-white uppercase tracking-widest truncate max-w-[100px]">
                                        {meeting?.title || 'Meeting'}
                                    </span>
                                    <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-tighter">Live Session</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleMute() }}
                                    className={cn(
                                        "p-2.5 rounded-xl transition-all",
                                        isMuted ? "bg-red-500 text-white shadow-lg shadow-red-900/20" : "bg-white/5 hover:bg-white/10 text-white"
                                    )}
                                >
                                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleCamera() }}
                                    className={cn(
                                        "p-2.5 rounded-xl transition-all",
                                        isCameraOff ? "bg-red-500 text-white shadow-lg shadow-red-900/20" : "bg-white/5 hover:bg-white/10 text-white"
                                    )}
                                >
                                    {isCameraOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); endCall() }}
                                    className="p-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-all shadow-lg shadow-red-900/20"
                                >
                                    <PhoneOff className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={handleExpand}
                                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all ml-1"
                                >
                                    <Minimize2 className="w-4 h-4" />
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <button
                                onClick={handleExpand}
                                className="p-3 bg-indigo-600 rounded-full text-white shadow-lg shadow-indigo-900/40 hover:scale-110 transition-transform"
                            >
                                <Maximize2 className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    )
}
