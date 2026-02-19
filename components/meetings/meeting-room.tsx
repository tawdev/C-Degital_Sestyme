'use client'

import React, { useEffect, useState } from 'react'
import {
    Mic, MicOff, Video, VideoOff, ScreenShare, StopCircle,
    MessageSquare, Users, Settings, PhoneOff,
    Send, Radio, Clock, BarChart3, Trash2, X, Smile, Hand
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { VideoCard } from '@/components/meetings/video-card'
import { MeetingLobby } from './meeting-lobby'
import { PollsPanel } from './polls-panel'
import EmployeeAvatar from '@/components/employee-avatar'
import { useRouter } from 'next/navigation'
import { useCall } from '@/components/providers/call-provider'
import { cn } from '@/lib/utils'

interface MeetingRoomProps {
    meetingId: string
    meeting: any
    currentUser: { id: string; full_name: string; avatar_url: string | null; role?: string }
}

export default function MeetingRoom({ meetingId, meeting, currentUser }: MeetingRoomProps) {
    const router = useRouter()
    const {
        joinMeeting,
        leaveMeeting,
        toggleMute,
        toggleCamera,
        toggleScreenShare,
        startRecording,
        stopRecording,
        sendMessage,
        setShowChat,
        muteParticipant,
        kickParticipant,
        toggleRaiseHand,
        sendReaction,
        admitParticipant,
        joinRequests,
        isWaiting,
        viewMode,
        setViewMode,
        handsRaised,
        isInCall,
        isMuted,
        isCameraOff,
        isScreenSharing,
        isRecording,
        recordingTime,
        showChat,
        messages,
        participants,
        activeSpeaker,
        remoteStreams,
        remoteScreenStreams,
        connectionStates,
        participantStates,
        localStream,
        screenStream,
        sharingUser,
        polls,
        endCall
    } = useCall()

    const [showParticipants, setShowParticipants] = useState(false)
    const [showPolls, setShowPolls] = useState(false)
    const [newMessage, setNewMessage] = useState('')
    const [showReactions, setShowReactions] = useState(false)

    useEffect(() => {
        console.log('[MeetingRoom] Current User Role:', currentUser?.role)
        console.log('[MeetingRoom] Meeting Host ID:', meeting?.host_id)
        console.log('[MeetingRoom] Current User ID:', currentUser?.id)
        console.log('[MeetingRoom] Join Requests Count:', joinRequests?.length)
    }, [currentUser, meeting, joinRequests])

    useEffect(() => {
        joinMeeting(meetingId, meeting, currentUser)
    }, [meetingId]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleSendMessage = () => {
        if (!newMessage.trim()) return
        sendMessage(newMessage)
        setNewMessage('')
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    if (isWaiting) return <MeetingLobby />

    return (
        <div className="fixed inset-0 bg-gray-50 dark:bg-gray-950 flex flex-col overflow-hidden text-slate-900 dark:text-white font-sans">
            {/* Top Header */}
            <div className="h-16 px-6 flex items-center justify-between border-b border-gray-100 dark:border-white/5 bg-white/50 dark:bg-gray-950/50 backdrop-blur-md z-50">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                            <Video className="w-5 h-5" />
                        </div>
                        <h2 className="font-bold text-sm tracking-tight uppercase truncate max-w-[200px]">{meeting.title}</h2>
                    </div>
                    {isRecording && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Rec {formatTime(recordingTime)}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center -space-x-2 mr-4">
                        {participants.slice(0, 3).map((p, idx) => (
                            <EmployeeAvatar
                                key={idx}
                                avatarUrl={p.avatar}
                                fullName={p.name}
                                className="w-8 h-8 border-2 border-gray-950 shadow-xl"
                            />
                        ))}
                    </div>
                    <button className="p-2.5 rounded-xl text-gray-400 hover:text-indigo-600 dark:hover:text-white transition-all">
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden relative">
                <div className="flex-1 p-4 md:p-6 flex flex-col gap-6 items-center overflow-y-auto custom-scrollbar">
                    <AnimatePresence mode="popLayout">
                        {/* Main Stage (Screen Share) */}
                        {sharingUser && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="w-full max-w-7xl aspect-video relative z-20"
                            >
                                <VideoCard
                                    participant={participants.find(p => p.id === sharingUser) || (sharingUser === currentUser?.id ? { ...currentUser, name: currentUser?.full_name, avatar: currentUser?.avatar_url } : { id: sharingUser, name: 'Partageur', avatar: null })}
                                    stream={sharingUser === currentUser?.id ? screenStream : (remoteScreenStreams?.get(sharingUser) || remoteStreams?.get(sharingUser) || null)}
                                    isLocal={sharingUser === currentUser?.id}
                                    isMuted={false}
                                    isCameraOff={false}
                                    isSharing={true}
                                    isMainStage={true}
                                    className="w-full h-full shadow-[0_0_50px_rgba(99,102,241,0.2)]"
                                />
                            </motion.div>
                        )}

                        {/* Participant Grid */}
                        {participants.length >= (sharingUser ? 0 : 1) ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className={`w-full max-w-7xl mx-auto grid gap-4 items-center justify-center ${sharingUser
                                    ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6' // Mini grid when sharing
                                    : (participants.length === 1 ? 'grid-cols-1 max-w-4xl' :
                                        participants.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
                                            'grid-cols-1 md:grid-cols-2 lg:grid-cols-3')
                                    }`}
                            >
                                {participants?.map((p) => {
                                    const isLocal = p.id === currentUser?.id
                                    const stream = isLocal ? localStream : (remoteStreams?.get(p.id) || null)
                                    const state = isLocal ? { isMuted, isCameraOff } : (participantStates?.get(p.id) || { isMuted: false, isCameraOff: false })

                                    return (
                                        <VideoCard
                                            key={p.id}
                                            participant={isLocal ? { ...currentUser, name: currentUser?.full_name, avatar: currentUser?.avatar_url } : p}
                                            stream={stream}
                                            isLocal={isLocal}
                                            isMuted={state.isMuted}
                                            isCameraOff={state.isCameraOff}
                                            isSharing={sharingUser === p.id}
                                            isHost={meeting?.host_id === p.id}
                                            isActiveSpeaker={activeSpeaker === p.id}
                                            isHandRaised={handsRaised?.has(p.id)}
                                            connectionState={connectionStates?.get(p.id)}
                                            className={cn(
                                                "w-full aspect-video",
                                                sharingUser && "scale-90 opacity-80 hover:scale-100 hover:opacity-100 transition-all"
                                            )}
                                        />
                                    )
                                })}
                            </motion.div>
                        ) : null}
                    </AnimatePresence>
                </div>

                {/* Host Admission Notification */}
                {(meeting?.host_id === currentUser?.id || currentUser?.role?.toLowerCase() === 'administrator') && (joinRequests?.length || 0) > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute top-8 left-1/2 -translate-x-1/2 z-[60] w-full max-w-md px-4"
                    >
                        <div className="bg-indigo-600 rounded-3xl p-5 shadow-2xl flex items-center justify-between border border-white/20">
                            <div className="flex items-center gap-4">
                                <Clock className="w-6 h-6 text-indigo-100" />
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-100">{(joinRequests?.length || 0)} en attente</p>
                                    <p className="text-white text-sm font-bold">{joinRequests?.[0]?.name || 'Quelqu\'un'}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => joinRequests?.[0] && admitParticipant(joinRequests[0].id)}
                                className="px-6 py-2 bg-white text-indigo-600 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-50 transition-all"
                            >
                                Admettre
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Sidebar */}
                <AnimatePresence>
                    {(showChat || showParticipants || showPolls) && (
                        <motion.div
                            initial={{ x: 320 }}
                            animate={{ x: 0 }}
                            exit={{ x: 320 }}
                            className="w-80 bg-white/80 dark:bg-gray-900/50 backdrop-blur-3xl border-l border-gray-100 dark:border-white/5 flex flex-col z-40 relative h-full overflow-hidden"
                        >
                            {showPolls && <PollsPanel onClose={() => setShowPolls(false)} />}

                            {showParticipants && !showPolls && (
                                <div className="flex-1 flex flex-col">
                                    <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">Participants</h3>
                                        <button onClick={() => setShowParticipants(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-gray-400" /></button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                                        {/* Lobby / Waiting Room Section (Host or Admin) */}
                                        {(meeting?.host_id === currentUser?.id || currentUser?.role === 'Administrator') && (joinRequests?.length || 0) > 0 && (
                                            <div className="space-y-3">
                                                <h4 className="text-[9px] font-black uppercase tracking-widest text-indigo-400 px-2">En attente ({joinRequests.length})</h4>
                                                <div className="space-y-2">
                                                    {joinRequests.map((r) => (
                                                        <div key={r.id} className="flex items-center justify-between p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <EmployeeAvatar avatarUrl={r.avatar} fullName={r.name} className="w-7 h-7" />
                                                                <p className="text-xs font-bold truncate">{r.name}</p>
                                                            </div>
                                                            <button
                                                                onClick={() => admitParticipant(r.id)}
                                                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[9px] font-black uppercase transition-all shadow-lg shadow-indigo-500/20"
                                                            >
                                                                Admettre
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-3">
                                            <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-2">Présents ({participants?.length || 0})</h4>
                                            <div className="space-y-2">
                                                {participants?.map((p) => (
                                                    <div key={p.id} className="flex items-center gap-3 px-2 py-1">
                                                        <EmployeeAvatar avatarUrl={p.avatar} fullName={p.name} className="w-8 h-8" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-bold truncate">{p.name}</p>
                                                            {meeting?.host_id === p.id && <span className="text-[8px] text-amber-500 font-black uppercase">Host</span>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {showChat && !showPolls && !showParticipants && (
                                <div className="flex-1 flex flex-col">
                                    <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">Chat</h3>
                                        <button onClick={() => setShowChat(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-gray-400" /></button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                        {messages.map((msg, idx) => (
                                            <div key={idx} className={`flex flex-col ${msg.sender === currentUser.id ? 'items-end' : 'items-start'}`}>
                                                <div className={`max-w-[85%] p-3 rounded-2xl text-xs ${msg.sender === currentUser.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-white/10 text-slate-900 dark:text-white'}`}>
                                                    {msg.content}
                                                </div>
                                                <span className="text-[8px] text-gray-400 dark:text-gray-500 mt-1 uppercase font-black">{msg.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="p-4 border-t border-gray-100 dark:border-white/5">
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={newMessage}
                                                onChange={(e) => setNewMessage(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                                placeholder="Message..."
                                                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-xl py-3 px-4 pr-12 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 dark:text-white"
                                            />
                                            <button onClick={handleSendMessage} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-indigo-500 hover:scale-110 transition-transform"><Send className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Controls Bar */}
            <div className="h-24 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-t border-gray-100 dark:border-white/5 flex items-center justify-center gap-6 px-8 z-50">
                <div className="flex items-center gap-3 bg-gray-100 dark:bg-white/5 p-2 rounded-2xl border border-gray-200 dark:border-white/5 shadow-2xl shadow-gray-200/50 dark:shadow-none">
                    <button
                        onClick={toggleMute}
                        className={`p-4 rounded-xl transition-all ${isMuted ? 'bg-red-500 text-white' : 'hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-white'}`}
                    >
                        {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                    </button>
                    <button
                        onClick={toggleCamera}
                        className={`p-4 rounded-xl transition-all ${isCameraOff ? 'bg-red-500 text-white' : 'hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-white'}`}
                    >
                        {isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                    </button>
                </div>

                <div className="flex items-center gap-2 md:gap-4 bg-white/50 dark:bg-gray-900/50 backdrop-blur-3xl p-2 rounded-[32px] border border-gray-100 dark:border-white/5 shadow-2xl shadow-gray-200/50 dark:shadow-none">
                    <button
                        onClick={() => { setShowPolls(!showPolls); setShowChat(false); setShowParticipants(false) }}
                        className={`p-4 rounded-2xl transition-all relative ${showPolls ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-400 hover:text-indigo-600 dark:hover:text-white'}`}
                    >
                        <BarChart3 className="w-6 h-6" />
                        {polls?.filter((p: any) => p.isOpen).length > 0 && (
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-900" />
                        )}
                    </button>
                    <button
                        onClick={() => { setShowChat(!showChat); setShowParticipants(false); setShowPolls(false) }}
                        className={`p-4 rounded-2xl transition-all ${showChat ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-400 hover:text-indigo-600 dark:hover:text-white'}`}
                    >
                        <MessageSquare className="w-6 h-6" />
                    </button>
                    <button
                        onClick={() => { setShowParticipants(!showParticipants); setShowChat(false); setShowPolls(false) }}
                        className={`p-4 rounded-2xl transition-all relative ${showParticipants ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-400 hover:text-indigo-600 dark:hover:text-white'}`}
                    >
                        <Users className="w-6 h-6" />
                        {joinRequests?.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white dark:border-gray-900 animate-in zoom-in duration-300">
                                {joinRequests.length}
                            </span>
                        )}
                    </button>

                    {(meeting?.host_id === currentUser?.id ||
                        currentUser?.role?.toLowerCase() === 'administrator' ||
                        currentUser?.role?.toLowerCase() === 'admin') &&
                        joinRequests?.length > 0 && (
                            <button
                                onClick={() => { setShowParticipants(true); setShowChat(false); setShowPolls(false) }}
                                className="p-4 rounded-2xl transition-all relative bg-amber-500 text-white shadow-lg shadow-amber-500/20 animate-pulse flex items-center gap-2"
                            >
                                <Clock className="w-6 h-6" />
                                <span className="text-[10px] font-black uppercase tracking-widest hidden lg:inline">En attente ({joinRequests.length})</span>
                            </button>
                        )}

                    <div className="w-px h-8 bg-gray-100 dark:bg-white/5" />

                    <button
                        onClick={toggleScreenShare}
                        className={`p-4 rounded-2xl transition-all ${isScreenSharing ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-400 hover:text-indigo-600 dark:hover:text-white'}`}
                    >
                        <ScreenShare className="w-6 h-6" />
                    </button>

                    <div className="relative">
                        <AnimatePresence>
                            {showReactions && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-3xl flex gap-1 shadow-2xl overflow-hidden"
                                >
                                    {['❤️', '👏', '😂', '🔥', '🎉', '😮'].map(emoji => (
                                        <button key={emoji} onClick={() => { sendReaction(emoji); setShowReactions(false) }} className="text-xl p-2 hover:scale-125 transition-transform">{emoji}</button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                        <button onClick={() => setShowReactions(!showReactions)} className={`p-4 rounded-2xl transition-all ${showReactions ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-400 hover:text-indigo-600 dark:hover:text-white'}`}>
                            <Smile className="w-6 h-6" />
                        </button>
                    </div>

                    <button
                        onClick={toggleRaiseHand}
                        className={`p-4 rounded-2xl transition-all ${handsRaised.has(currentUser.id) ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-gray-400 hover:text-indigo-600 dark:hover:text-white'}`}
                    >
                        <Hand className="w-6 h-6" />
                    </button>
                </div>

                <button
                    onClick={() => endCall()}
                    className="bg-red-600 hover:bg-red-700 text-white px-8 py-5 rounded-2xl font-black shadow-2xl flex items-center gap-3 transition-all active:scale-95"
                >
                    <PhoneOff className="w-6 h-6" />
                    <span className="hidden md:inline uppercase tracking-widest text-[10px]">Quitter</span>
                </button>
            </div>
        </div>
    )
}
