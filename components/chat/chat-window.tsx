'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChatMessage, ChatRole } from '@/lib/types/chat'
import { sendMessage, getMessages, markConversationAsRead } from '@/app/(main)/chat/actions' // Correct path
import { Send, Loader2, Paperclip, Mic, X, File, Square, CheckCircle2, Download } from 'lucide-react'
import EmployeeAvatar from '@/components/employee-avatar'

interface ChatWindowProps {
    conversationId: string
    currentUser: {
        id: string
        role: ChatRole
        full_name: string
        avatar_url: string | null
    }
    recipient?: {
        id: string
        full_name: string
        avatar_url: string | null
    } | null
}

export default function ChatWindow({ conversationId, currentUser, recipient }: ChatWindowProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [content, setContent] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [otherUser, setOtherUser] = useState<{ id: string; full_name: string; avatar_url: string | null } | null>(recipient || null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Multimedia state
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [isRecording, setIsRecording] = useState(false)
    const [recordingTime, setRecordingTime] = useState(0)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const audioChunksRef = useRef<Blob[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)

    // Sync otherUser state with recipient prop
    useEffect(() => {
        setOtherUser(recipient || null)
    }, [recipient])

    // Stable supabase client to avoid redundant re-subscriptions
    const supabase = useState(() => createClient())[0]

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        let isMounted = true

        const initChat = async () => {
            setLoading(true)
            setMessages([]) // Clear messages for new conversation
            try {
                // Fetch messages and mark as read
                const [msgs] = await Promise.all([
                    getMessages(conversationId),
                    markConversationAsRead(conversationId)
                ])

                if (!isMounted) return
                setMessages(msgs)

                // If recipient wasn't passed as a prop, try to fetch it once
                if (!recipient) {
                    const { data } = await supabase
                        .from('conversations')
                        .select(`
                            id,
                            user1_id,
                            user2_id,
                            user1:employees!conversations_user1_id_fkey(full_name, avatar_url),
                            user2:employees!conversations_user2_id_fkey(full_name, avatar_url)
                        `)
                        .eq('id', conversationId)
                        .single()

                    if (data && isMounted) {
                        const otherParticipant = (data.user1_id === currentUser.id ? data.user2 : data.user1) as any
                        setOtherUser(otherParticipant)
                    }
                }
            } catch (err) {
                console.error('Error initializing chat:', err)
            } finally {
                if (isMounted) {
                    setLoading(false)
                    setTimeout(scrollToBottom, 50)
                }
            }
        }

        initChat()

        // Subscribe to NEW messages
        console.log('ChatWindow: Starting subscription for', conversationId)

        const channel = supabase
            .channel(`messages:${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`
                },
                (payload) => {
                    console.log('New message received:', payload.new)
                    const newMessage = payload.new as ChatMessage

                    setMessages((prev) => [...prev, newMessage])
                    setTimeout(scrollToBottom, 50)

                    // Mark as read if the message is for us
                    if (newMessage.sender_id !== currentUser.id) {
                        markConversationAsRead(conversationId)
                    }
                }
            )
            .subscribe((status, err) => {
                console.log(`ChatWindow: Subscription status for ${conversationId}:`, status)
                if (err) console.error('ChatWindow: Subscription error:', err)
            })

        return () => {
            isMounted = false
            console.log('ChatWindow: Cleaning up subscription')
            supabase.removeChannel(channel)
        }
    }, [conversationId, supabase, currentUser.id])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0])
        }
    }

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mediaRecorder = new MediaRecorder(stream)
            mediaRecorderRef.current = mediaRecorder
            audioChunksRef.current = []

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data)
                }
            }

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
                const audioFile = new File([audioBlob], 'voice-message.webm', { type: 'audio/webm' })
                setSelectedFile(audioFile)
                stream.getTracks().forEach(track => track.stop())
            }

            mediaRecorder.start()
            setIsRecording(true)
            setRecordingTime(0)
            timerIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1)
            }, 1000)

        } catch (err) {
            console.error('Error accessing microphone:', err)
            alert('Could not access microphone. Please check permissions.')
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current)
            }
        }
    }

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
            setSelectedFile(null) // Discard
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current)
            }
        }
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const handleDownload = async (e: React.MouseEvent, url: string, filename: string) => {
        e.preventDefault()
        e.stopPropagation()

        try {
            const response = await fetch(url)
            const blob = await response.blob()
            const blobUrl = window.URL.createObjectURL(blob)

            const link = document.createElement('a')
            link.href = blobUrl
            link.download = filename || 'download'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(blobUrl)
        } catch (error) {
            console.error('Download failed:', error)
            // Fallback
            window.open(url, '_blank')
        }
    }

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()
        if ((!content.trim() && !selectedFile) || sending) return

        const messageContent = content.trim()
        const fileToSend = selectedFile
        const isAudio = fileToSend?.type.startsWith('audio/')

        // Determine type
        let type = 'text'
        if (fileToSend) {
            if (fileToSend.type.startsWith('image/')) type = 'image'
            else if (fileToSend.type.startsWith('audio/')) type = 'audio'
            else type = 'file'
        }

        // Clear UI immediately
        setContent('')
        setSelectedFile(null)
        setSending(true)

        // Optimistic Update
        const tempId = `temp-${Date.now()}`
        const optimisticMsg: any = { // Use any to bypass strict type check for new fields locally
            id: tempId,
            conversation_id: conversationId,
            sender_id: currentUser.id,
            sender_role: currentUser.role,
            content: type === 'text' ? messageContent : URL.createObjectURL(fileToSend!), // Preview URL
            created_at: new Date().toISOString(),
            is_read: true,
            recipient_id: otherUser?.id || 'temp-recipient',
            type: type,
            file_name: fileToSend?.name,
            file_size: fileToSend?.size,
            duration: isAudio ? recordingTime : null
        }

        setMessages(prev => [...prev, optimisticMsg])
        setTimeout(scrollToBottom, 50)

        try {
            const formData = new FormData()
            formData.append('conversationId', conversationId)
            formData.append('content', messageContent)
            formData.append('senderId', currentUser.id)
            formData.append('senderRole', currentUser.role)
            formData.append('type', type)
            if (recordingTime > 0) formData.append('duration', recordingTime.toString())
            if (fileToSend) formData.append('file', fileToSend)

            const result = await sendMessage(formData)

            if (!result.success) {
                setMessages(prev => prev.filter(m => m.id !== tempId))
                console.error('Failed to send message:', result.error)
                alert('Failed to send message')
            } else {
                setMessages(prev => prev.map(m => m.id === tempId ? result.message : m))
            }
        } catch (err) {
            setMessages(prev => prev.filter(m => m.id !== tempId))
            console.error(err)
        } finally {
            setSending(false)
        }
    }

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <EmployeeAvatar
                        avatarUrl={otherUser?.avatar_url || null}
                        fullName={otherUser?.full_name || '...'}
                    />
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 leading-none">
                            {otherUser?.full_name || 'Loading...'}
                        </h3>
                        <p className="text-[10px] text-emerald-500 font-medium mt-1 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                            Online
                        </p>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading ? (
                    <div className="h-full flex items-center justify-center">
                        <Loader2 className="h-6 w-6 text-indigo-600 animate-spin" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                        <p className="text-sm">No messages yet. Say hello!</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`max-w-[70%] ${msg.sender_id === currentUser.id ? 'bg-indigo-600 text-white rounded-l-xl rounded-tr-xl' : 'bg-white text-gray-900 rounded-r-xl rounded-tl-xl border border-gray-100 shadow-sm'} p-3 px-4 overflow-hidden`}>
                                {(msg as any).type === 'image' ? (
                                    <div className="mb-1 relative group">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <a href={msg.content} target="_blank" rel="noopener noreferrer" className="block cursor-zoom-in">
                                            <img src={msg.content} alt="Image sent" className="rounded-lg max-h-64 object-cover w-full hover:opacity-95 transition-opacity" />
                                        </a>
                                        <button
                                            className="absolute bottom-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm z-10 cursor-pointer border-none"
                                            title="Download Image"
                                            onClick={(e) => handleDownload(e, msg.content, (msg as any).file_name || 'image.png')}
                                        >
                                            <Download className="h-4 w-4" />
                                        </button>
                                    </div>
                                ) : (msg as any).type === 'audio' ? (
                                    <div className="flex items-center gap-2 min-w-[200px]">
                                        <audio controls src={msg.content} className="w-full h-8" />
                                    </div>
                                ) : (msg as any).type === 'file' ? (
                                    <div className="flex items-center gap-3 bg-black/10 p-2 rounded-lg">
                                        <div className="bg-white/20 p-2 rounded">
                                            <File className="h-6 w-6" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{(msg as any).file_name || 'File'}</p>
                                            <p className="text-xs opacity-70">{(msg as any).file_size ? `${Math.round((msg as any).file_size / 1024)} KB` : 'Attachment'}</p>
                                        </div>
                                        <button
                                            onClick={(e) => handleDownload(e, msg.content, (msg as any).file_name || 'file')}
                                            className="p-1.5 hover:bg-white/20 rounded-full transition-colors cursor-pointer border-none text-gray-700"
                                            title="Download"
                                        >
                                            <Download className="h-4 w-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                )}

                                <p className={`text-[10px] mt-1 ${msg.sender_id === currentUser.id ? 'text-indigo-100' : 'text-gray-400'}`}>
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSend} className="p-4 bg-white border-t border-gray-200">
                {/* File Preview */}
                {selectedFile && (
                    <div className="mb-3 p-2 bg-gray-50 border border-indigo-100 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-3 overflow-hidden">
                            {selectedFile.type.startsWith('image/') ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={URL.createObjectURL(selectedFile)} alt="Preview" className="h-10 w-10 object-cover rounded" />
                            ) : selectedFile.type.startsWith('audio/') ? (
                                <div className="h-10 w-10 bg-indigo-100 rounded flex items-center justify-center text-indigo-600">
                                    <Mic className="h-5 w-5" />
                                </div>
                            ) : (
                                <div className="h-10 w-10 bg-gray-200 rounded flex items-center justify-center text-gray-500">
                                    <File className="h-5 w-5" />
                                </div>
                            )}
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{selectedFile.name}</p>
                                <p className="text-xs text-gray-500">{Math.round(selectedFile.size / 1024)} KB</p>
                            </div>
                        </div>
                        <button type="button" onClick={() => setSelectedFile(null)} className="p-1 hover:bg-gray-200 rounded-full">
                            <X className="h-4 w-4 text-gray-500" />
                        </button>
                    </div>
                )}

                {/* Recording UI */}
                {isRecording ? (
                    <div className="flex items-center gap-4 bg-red-50 p-2 rounded-lg border border-red-100 animate-pulse">
                        <div className="h-3 w-3 bg-red-500 rounded-full"></div>
                        <span className="text-red-600 font-mono font-bold flex-1">{formatTime(recordingTime)}</span>
                        <button type="button" onClick={cancelRecording} className="p-2 text-gray-500 hover:text-red-600">
                            <X className="h-5 w-5" />
                        </button>
                        <button type="button" onClick={stopRecording} className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600">
                            <CheckCircle2 className="h-5 w-5" /> {/* Wait, CheckCircle2 not imported, use Send/Stop icon */}
                            <Square className="h-4 w-4 fill-current" />
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-2 items-end">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-3 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Attach file"
                        >
                            <Paperclip className="h-5 w-5" />
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                        </button>

                        <button
                            type="button"
                            onClick={startRecording}
                            className={`p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ${sending ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={sending}
                            title="Record Audio"
                        >
                            <Mic className="h-5 w-5" />
                        </button>

                        <input
                            type="text"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder={selectedFile ? "Add a caption..." : "Type a message..."}
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium text-black placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                            disabled={sending}
                        />
                        <button
                            type="submit"
                            disabled={(!content.trim() && !selectedFile) || sending}
                            className="bg-indigo-600 text-white p-2.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center mb-[1px]"
                        >
                            {sending ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <Send className="h-5 w-5" />
                            )}
                        </button>
                    </div>
                )}
            </form>
        </div>
    )
}
