'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Mic, MicOff, Video, VideoOff, Loader2, Clock } from 'lucide-react'
import { useCall } from '@/components/providers/call-provider'

export const MeetingLobby = () => {
    const {
        isMuted,
        isCameraOff,
        toggleMute,
        toggleCamera,
        meeting,
        localStream
    } = useCall()

    const videoRef = React.useRef<HTMLVideoElement>(null)

    React.useEffect(() => {
        if (videoRef.current && localStream) {
            videoRef.current.srcObject = localStream
        }
    }, [localStream])

    return (
        <div className="fixed inset-0 bg-gray-950 flex items-center justify-center p-6 z-[100]">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-4xl bg-gray-900/50 border border-white/5 rounded-[40px] overflow-hidden backdrop-blur-3xl shadow-2xl flex flex-col md:flex-row"
            >
                {/* Preview Section */}
                <div className="flex-1 p-8 bg-black/40 relative group">
                    <div className="aspect-video bg-gray-800 rounded-3xl overflow-hidden border border-white/5 shadow-2xl relative">
                        {localStream && !isCameraOff ? (
                            <video
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline
                                className="w-full h-full object-cover scale-x-[-1]"
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gray-900">
                                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                                    <VideoOff className="w-10 h-10 text-gray-600" />
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Caméra désactivée</p>
                            </div>
                        )}

                        {/* Overlays */}
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3">
                            <button
                                onClick={toggleMute}
                                className={`p-4 rounded-2xl transition-all shadow-xl ${isMuted ? 'bg-red-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                            >
                                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                            </button>
                            <button
                                onClick={toggleCamera}
                                className={`p-4 rounded-2xl transition-all shadow-xl ${isCameraOff ? 'bg-red-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                            >
                                {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Info Section */}
                <div className="w-full md:w-96 p-12 flex flex-col justify-center border-l border-white/5">
                    <div className="mb-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-widest mb-6">
                            <Clock className="w-3 h-3" />
                            Salle d'attente
                        </div>
                        <h2 className="text-3xl font-black text-white leading-tight mb-4 tracking-tighter uppercase">
                            Presque prêt...
                        </h2>
                        <p className="text-gray-400 text-xs font-medium leading-relaxed">
                            L'hôte a été informé de votre arrivée. Veuillez patienter pendant qu'il vous autorise à rejoindre la réunion <strong>{meeting?.title}</strong>.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 animate-pulse">
                            <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Demande en cours...</span>
                        </div>

                        <div className="pt-6 border-t border-white/5">
                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-600 mb-2">Conseil</p>
                            <p className="text-gray-500 text-[10px] leading-relaxed italic">
                                "Vérifiez votre éclairage et votre micro avant de rejoindre pour une meilleure expérience."
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
