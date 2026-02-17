'use client'

import React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Mic, MicOff, Video, VideoOff, PhoneOff, Maximize2 } from 'lucide-react'
import { useCall } from '@/components/providers/call-provider'
import { motion, AnimatePresence } from 'framer-motion'

export default function MiniCallBar() {
    const router = useRouter()
    const pathname = usePathname()
    const {
        isInCall,
        meetingId,
        isMuted,
        isCameraOff,
        toggleMute,
        toggleCamera,
        endCall,
        startTime
    } = useCall() as any // type casting for quick fix, should refine Interface

    // Don't show if not in call
    if (!isInCall || !meetingId) return null

    // Don't show if on the meeting page
    if (pathname.includes(`/meetings/${meetingId}`)) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-6 right-6 z-50 flex items-center gap-4 bg-gray-900/90 backdrop-blur-md border border-white/10 p-3 rounded-2xl shadow-2xl"
            >
                <div onClick={() => router.push(`/meetings/${meetingId}`)} className="flex items-center gap-3 cursor-pointer group">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse ml-2" />
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">Appel en cours</span>
                        <span className="text-[10px] text-gray-400 group-hover:text-indigo-400 transition-colors">Cliquer pour agrandir</span>
                    </div>
                </div>

                <div className="h-8 w-px bg-white/10 mx-2" />

                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); toggleMute() }}
                        className={`p-2.5 rounded-xl transition-all ${isMuted ? 'bg-red-500/20 text-red-500' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                    >
                        {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); toggleCamera() }}
                        className={`p-2.5 rounded-xl transition-all ${isCameraOff ? 'bg-red-500/20 text-red-500' : 'bg-white/5 hover:bg-white/10 text-white'}`}
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
                        onClick={() => router.push(`/meetings/${meetingId}`)}
                        className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-lg shadow-indigo-900/20 ml-2"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    )
}
