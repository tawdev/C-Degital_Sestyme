'use client'

import React, { useEffect, useState } from 'react'
import {
    Mic, MicOff, Video, VideoOff, ScreenShare, StopCircle,
    MessageSquare, Users, Settings, PhoneOff,
    Send, Radio
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import VideoCard from './video-card'
import EmployeeAvatar from '@/components/employee-avatar'
import { useRouter } from 'next/navigation'
import { useCall } from '@/components/providers/call-provider'

interface MeetingRoomProps {
    meetingId: string
    meeting: any
    currentUser: { id: string; full_name: string; avatar_url: string | null }
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
        isMuted,
        isCameraOff,
        isScreenSharing,
        isRecording,
        recordingTime,
        showChat,
        messages,
        participants,
        remoteStreams,
        connectionStates,
        participantStates,
        localStream,
        screenStream,
        sharingUser,
    } = useCall()

    const [showParticipants, setShowParticipants] = useState(true)
    const [newMessage, setNewMessage] = useState('')

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

    return (
        <div className="fixed inset-0 bg-gray-950 flex flex-col overflow-hidden text-white font-sans">
            {/* Top Header */}
            <div className="h-16 px-6 flex items-center justify-between border-b border-white/5 bg-gray-950/50 backdrop-blur-md z-50">
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
                        {participants.length > 3 && (
                            <div className="w-8 h-8 rounded-full bg-gray-800 border-2 border-gray-950 flex items-center justify-center text-[10px] font-bold">
                                +{participants.length - 3}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => setShowParticipants(!showParticipants)}
                        className={`p-2.5 rounded-xl transition-all ${showParticipants ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        <Users className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setShowChat(!showChat)}
                        className={`p-2.5 rounded-xl transition-all ${showChat ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        <MessageSquare className="w-5 h-5" />
                    </button>
                    <button className="p-2.5 rounded-xl text-gray-400 hover:text-white transition-all">
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden relative">
                <div className="flex-1 flex flex-col relative overflow-hidden">
                    {/* Layout Container */}
                    <div className="flex-1 p-4 md:p-6 flex items-center justify-center overflow-y-auto custom-scrollbar">
                        <AnimatePresence mode="popLayout">
                            {sharingUser || isScreenSharing ? (
                                /* PRESENTATION MODE */
                                <motion.div
                                    key="presentation-layout"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="w-full h-full flex flex-col md:flex-row gap-4 max-w-[1600px] mx-auto"
                                >
                                    {/* Main Stage (Screen Share) */}
                                    <div className="flex-1 min-h-[50vh] md:h-full relative flex flex-col">
                                        {(() => {
                                            const presenterId = isScreenSharing ? currentUser.id : sharingUser!
                                            const isLocalPresenter = presenterId === currentUser.id
                                            const presenter = isLocalPresenter ? currentUser : participants.find(p => p.id === presenterId) || { id: presenterId, name: 'Unknown', avatar: null }

                                            // Determine stream for presenter
                                            let presentationStream = null
                                            if (isLocalPresenter) {
                                                presentationStream = screenStream
                                            } else {
                                                presentationStream = remoteStreams.get(presenterId) || null
                                            }

                                            const state = participantStates.get(presenterId) || { isMuted: false, isCameraOff: false, isRecording: false }

                                            return (
                                                <VideoCard
                                                    key={presenterId}
                                                    participant={{ ...presenter, id: presenterId, name: isLocalPresenter ? currentUser.full_name : (presenter as any).name, avatar: isLocalPresenter ? currentUser.avatar_url : (presenter as any).avatar }}
                                                    stream={presentationStream}
                                                    isLocal={isLocalPresenter}
                                                    isMuted={isLocalPresenter ? isMuted : state.isMuted}
                                                    isCameraOff={false} // Always show screen share
                                                    isSharing={true}
                                                    isHost={meeting.host_id === presenterId}
                                                    connectionState={connectionStates.get(presenterId)}
                                                    isMainStage={true}
                                                    className="w-full h-full"
                                                />
                                            )
                                        })()}
                                    </div>

                                    {/* Sidebar (Other Participants) */}
                                    <div className="h-32 md:h-full md:w-80 flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto md:overflow-x-hidden custom-scrollbar pb-2 md:pb-0 shrink-0">
                                        {participants
                                            .filter(p => !((isScreenSharing && p.id === currentUser.id) || (sharingUser && p.id === sharingUser))) // Exclude presenter
                                            .map((p) => {
                                                const isLocal = p.id === currentUser.id
                                                const stream = isLocal ? localStream : (remoteStreams.get(p.id) || null)
                                                const state = isLocal ? { isMuted, isCameraOff, isRecording: false } : (participantStates.get(p.id) || { isMuted: false, isCameraOff: false, isRecording: false })

                                                return (
                                                    <VideoCard
                                                        key={p.id}
                                                        participant={p.id === currentUser.id ? { ...currentUser, name: currentUser.full_name, avatar: currentUser.avatar_url } : p}
                                                        stream={stream}
                                                        isLocal={isLocal}
                                                        isMuted={state.isMuted}
                                                        isCameraOff={state.isCameraOff}
                                                        isSharing={false}
                                                        isHost={meeting.host_id === p.id}
                                                        connectionState={connectionStates.get(p.id)}
                                                        className="aspect-video w-48 md:w-full shrink-0"
                                                    />
                                                )
                                            })}
                                    </div>
                                </motion.div>
                            ) : (
                                /* GRID MODE (Default) */
                                <motion.div
                                    key="grid-layout"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className={`w-full max-w-7xl mx-auto grid gap-4 md:gap-6 items-center justify-center transition-all duration-500 ${participants.length === 1 ? 'grid-cols-1 max-w-4xl' :
                                        participants.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-6xl' :
                                            participants.length === 3 ? 'grid-cols-1 md:grid-cols-2 max-w-6xl' :
                                                participants.length === 4 ? 'grid-cols-1 md:grid-cols-2 max-w-6xl' :
                                                    'grid-cols-2 md:grid-cols-3'
                                        }`}
                                >
                                    {participants.map((p, idx) => {
                                        const isLocal = p.id === currentUser.id
                                        const stream = isLocal ? localStream : (remoteStreams.get(p.id) || null)
                                        const state = isLocal ? { isMuted, isCameraOff, isRecording: false } : (participantStates.get(p.id) || { isMuted: false, isCameraOff: false, isRecording: false })

                                        return (
                                            <VideoCard
                                                key={p.id}
                                                participant={p.id === currentUser.id ? { ...currentUser, name: currentUser.full_name, avatar: currentUser.avatar_url } : p}
                                                stream={stream}
                                                isLocal={isLocal}
                                                isMuted={state.isMuted}
                                                isCameraOff={state.isCameraOff}
                                                isSharing={false}
                                                isHost={meeting.host_id === p.id}
                                                connectionState={connectionStates.get(p.id)}
                                                className={`w-full aspect-video ${participants.length === 3 && idx === 2 ? 'md:col-span-1' : ''}`}
                                            />
                                        )
                                    })}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Right Sidebar (Chat/Participants) */}
                {(showChat || showParticipants) && (
                    <div className="w-80 bg-gray-950/80 border-l border-white/5 flex flex-col z-20 absolute md:static inset-y-0 right-0 h-full backdrop-blur-xl md:backdrop-blur-none shadow-2xl md:shadow-none animate-in slide-in-from-right duration-300">
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="p-6 border-b border-white/5 bg-white/2">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">
                                        Participants
                                    </h3>
                                    <span className="bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-2.5 py-0.5 rounded-full text-[9px] font-black font-mono">
                                        {participants.length.toString().padStart(2, '0')}
                                    </span>
                                </div>

                                <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar max-h-[calc(100vh-250px)]">
                                    {participants.map((p, idx) => {
                                        const state = participantStates.get(p.id) || { isMuted: p.id === currentUser.id ? isMuted : false, isCameraOff: p.id === currentUser.id ? isCameraOff : false, isRecording: false }
                                        const isHost = p.id === meeting.host_id

                                        return (
                                            <div key={idx} className="group flex items-center gap-4 p-2 rounded-2xl hover:bg-white/5 transition-all duration-300">
                                                <div className="relative">
                                                    <EmployeeAvatar
                                                        avatarUrl={p.avatar}
                                                        fullName={p.name}
                                                        className={`w-11 h-11 border-2 transition-transform group-hover:scale-105 duration-300 ${isHost ? 'border-amber-500/50 shadow-lg shadow-amber-900/10' : 'border-white/5'}`}
                                                    />
                                                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-gray-950 rounded-full ${remoteStreams.has(p.id) || p.id === currentUser.id ? 'bg-green-500' : 'bg-gray-700'}`} />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-[11px] font-black uppercase tracking-tight text-white truncate group-hover:text-indigo-400 transition-colors">
                                                            {p.id === currentUser.id ? 'Vous' : p.name}
                                                        </p>
                                                        {isHost && (
                                                            <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-[7px] font-black text-amber-500 uppercase tracking-widest">
                                                                Host
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[8px] font-bold text-gray-600 uppercase tracking-widest mt-0.5">
                                                        {p.role || 'Membre'}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-1.5 h-8">
                                                    <div className={`p-1.5 rounded-lg transition-colors ${state.isMuted ? 'bg-red-500/10 text-red-500' : 'bg-gray-800/50 text-gray-600'}`}>
                                                        {state.isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                                                    </div>
                                                    <div className={`p-1.5 rounded-lg transition-colors ${state.isCameraOff ? 'bg-red-500/10 text-red-500' : 'bg-gray-800/50 text-gray-600'}`}>
                                                        {state.isCameraOff ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {showChat && (
                            <div className="flex-1 flex flex-col overflow-hidden border-t border-white/5">
                                <div className="p-4 bg-white/2">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-4">Chat en direct</h3>
                                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 max-h-[400px]">
                                        {messages.map((msg, idx) => (
                                            <div key={idx} className={`flex flex-col ${msg.sender_id === currentUser.id ? 'items-end' : 'items-start'}`}>
                                                <div className={`max-w-[80%] p-3 rounded-2xl text-xs font-medium ${msg.sender_id === currentUser.id
                                                    ? 'bg-indigo-600 shadow-lg shadow-indigo-900/20'
                                                    : 'bg-white/10'
                                                    }`}>
                                                    {msg.content}
                                                </div>
                                                <p className="text-[8px] font-bold text-gray-500 mt-1 uppercase tracking-widest">{msg.sender_name}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="p-4 mt-auto">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                            placeholder="Tapez un message..."
                                            className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 px-4 pr-12 text-xs focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-gray-600 uppercase font-medium"
                                        />
                                        <button
                                            onClick={handleSendMessage}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-indigo-500 hover:text-white transition-colors"
                                        >
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Controls Bar */}
            <div className="h-24 px-8 flex items-center justify-center gap-6 bg-gray-950/80 backdrop-blur-xl border-t border-white/5 z-50">
                <div className="flex items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/5 shadow-2xl">
                    <button
                        onClick={toggleMute}
                        className={`p-4 rounded-xl transition-all ${isMuted ? 'bg-red-500 text-white shadow-lg shadow-red-900/20' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                    >
                        {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                    </button>
                    <button
                        onClick={toggleCamera}
                        className={`p-4 rounded-xl transition-all ${isCameraOff ? 'bg-red-500 text-white shadow-lg shadow-red-900/20' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                    >
                        {isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                    </button>
                </div>

                <div className="flex items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/5 shadow-2xl">
                    <button
                        onClick={toggleScreenShare}
                        className={`p-4 rounded-xl transition-all ${isScreenSharing ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                    >
                        <ScreenShare className="w-6 h-6" />
                    </button>
                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`p-4 rounded-xl transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                    >
                        {isRecording ? <StopCircle className="w-6 h-6" /> : <Radio className="w-6 h-6" />}
                    </button>
                </div>

                <button
                    onClick={() => leaveMeeting(true)}
                    className="flex items-center gap-3 bg-red-600 hover:bg-red-700 text-white px-8 py-5 rounded-2xl font-black shadow-2xl shadow-red-900/40 transition-all active:scale-[0.98]"
                >
                    <PhoneOff className="w-6 h-6" />
                    <span className="hidden md:inline uppercase tracking-[0.2em] text-[10px]">Quitter</span>
                </button>
            </div>
        </div>
    )
}
