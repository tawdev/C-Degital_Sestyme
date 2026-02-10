'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useRealtime } from '@/context/realtime-context'
import { ChatMessage, ChatRole } from '@/lib/types/chat'
import { sendMessage, getMessages, markConversationAsRead, deleteMessage, toggleReaction, getConversationDetails, getGroupMembers, updateMessageStatus, updateAllDelivered } from '@/app/(main)/chat/actions' // Correct path
import { Send, Loader2, Paperclip, Mic, X, File as FileIcon, Square, CheckCircle2, Download, Trash2, SmilePlus, Users, Settings, Phone, Video as VideoIcon, Check, CheckCheck, Reply, ArrowLeft } from 'lucide-react'
import EmployeeAvatar from '@/components/employee-avatar'
import GroupSettingsModal from './group-settings-modal'
import { SafeLastSeen } from '@/components/ui/safe-last-seen'
import { useCall } from './call-manager'

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
    isAdminMonitoring?: boolean
}



export default function ChatWindow({ conversationId, currentUser, recipient, isAdminMonitoring: initialIsMonitoring }: ChatWindowProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [content, setContent] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [otherUser, setOtherUser] = useState<{ id: string; full_name: string; avatar_url: string | null } | null>(recipient || null)
    const [isGroup, setIsGroup] = useState(false)
    const [groupMembers, setGroupMembers] = useState<any[]>([])
    const groupMembersRef = useRef<any[]>([])

    // Sync ref with state
    useEffect(() => {
        groupMembersRef.current = groupMembers
    }, [groupMembers])

    const [showGroupSettings, setShowGroupSettings] = useState(false)
    const { startCall } = useCall()
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()
    const { isUserOnline, setActiveConversationId, notificationPermission, requestPermission } = useRealtime()
    const [statusUpdates, setStatusUpdates] = useState<Record<string, 'delivered' | 'seen'>>({})
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null)
    const [hasMounted, setHasMounted] = useState(false)

    useEffect(() => {
        setHasMounted(true)
    }, [])

    // track active conversation for notification filtering
    useEffect(() => {
        setActiveConversationId(conversationId)

        const syncStatus = async () => {
            // 1. Mark all current messages as delivered in DB
            await updateAllDelivered(conversationId)

            // 2. Mark as read / seen in DB
            await markConversationAsRead(conversationId)

            // 3. BROADCAST seen status to others (Reliable fallback)
            console.log('[ChatWindow] Broadcasting conversation-seen focus for:', conversationId)
            const sb = createClient()
            const syncChannel = sb.channel(`sync-seen-${Date.now()}`)
            syncChannel.subscribe((status: any) => {
                if (status === 'SUBSCRIBED') {
                    syncChannel.send({
                        type: 'broadcast',
                        event: 'conversation-seen',
                        payload: {
                            conversation_id: conversationId,
                            user_id: currentUser.id
                        }
                    }).then(() => {
                        sb.removeChannel(syncChannel)
                    })
                }
            })

            // 4. RESET local unread state immediately
            window.dispatchEvent(new CustomEvent('unread-count-reset', {
                detail: { conversation_id: conversationId, user_id: currentUser.id }
            }))
        }

        // Listen for tab focus / visibility to re-sync status
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                syncStatus()
            }
        }
        window.addEventListener('focus', syncStatus)
        window.addEventListener('visibilitychange', handleVisibility)

        syncStatus()

        // Listen for real-time status updates via custom event from RealtimeProvider
        const handleStatusUpdate = (e: any) => {
            const { message_id, status, conversation_id: cid } = e.detail
            if (cid === conversationId) {
                setStatusUpdates(prev => ({ ...prev, [message_id]: status }))
            }
        }

        const handleConvoSeen = (e: any) => {
            const { conversation_id: cid, user_id } = e.detail
            if (cid === conversationId && user_id !== currentUser.id) {
                // All our messages in this convo are now seen
                setStatusUpdates(prev => {
                    const next = { ...prev }
                    messages.forEach(m => {
                        if (m.sender_id === currentUser.id) {
                            next[m.id] = 'seen'
                        }
                    })
                    return next
                })
            }
        }

        const handleNewMessage = (e: any) => {
            const { message } = e.detail
            if (message.conversation_id === conversationId) {
                console.log('[ChatWindow] New message via global event:', message.id)
                setMessages((prev) => {
                    if (prev.some(m => m.id === message.id)) return prev

                    // Attach sender info
                    if (!message.sender) {
                        if (message.sender_id === currentUser.id) {
                            message.sender = {
                                id: currentUser.id,
                                full_name: currentUser.full_name,
                                avatar_url: currentUser.avatar_url
                            }
                        } else {
                            const member = groupMembersRef.current.find(m => m.id === message.sender_id)
                            if (member) {
                                message.sender = {
                                    id: member.id,
                                    full_name: member.full_name,
                                    avatar_url: member.avatar_url
                                }
                            }
                        }
                    }

                    const next = [...prev, message]
                    return next.sort((a, b) =>
                        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    )
                })
                setTimeout(scrollToBottom, 50)

                // Mark as read
                if (message.sender_id !== currentUser.id && (!isAdminMonitoring || currentUser.role === 'admin')) {
                    markConversationAsRead(conversationId)
                }
            }
        }

        window.addEventListener('message-status-update', handleStatusUpdate)
        window.addEventListener('conversation-seen', handleConvoSeen)
        window.addEventListener('new-message', handleNewMessage)

        return () => {
            setActiveConversationId(null)
            window.removeEventListener('focus', syncStatus)
            window.removeEventListener('visibilitychange', handleVisibility)
            window.removeEventListener('message-status-update', handleStatusUpdate)
            window.removeEventListener('conversation-seen', handleConvoSeen)
            window.removeEventListener('new-message', handleNewMessage)
        }
    }, [conversationId, setActiveConversationId, currentUser.id])

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

    const [isAdminMonitoring, setIsAdminMonitoring] = useState(initialIsMonitoring || false)

    // Sync monitoring state if prop changes
    useEffect(() => {
        if (initialIsMonitoring !== undefined) {
            setIsAdminMonitoring(initialIsMonitoring)
        }
    }, [initialIsMonitoring])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        let isMounted = true

        const initChat = async () => {
            console.log('[ChatWindow] initChat started for conversationId:', conversationId)
            setLoading(true)

            // We DON'T clear messages here if we want to catch live updates during loading.
            // But for a clean conversation switch, we should reset to empty.
            // However, any messages arriving via Realtime while loading should be preserved.
            setMessages([])

            let isPart = false
            try {
                // 1. Fetch messages via server action
                const history = await getMessages(conversationId)

                if (!isMounted) return

                // ATOMIC MERGE: Combine fetched history with any messages that arrived via Realtime
                // during the async fetch. History messages will generally be older.
                setMessages((prevLive) => {
                    const messageMap = new Map()
                    // Add history first (they are base)
                    history.forEach(m => messageMap.set(m.id, m))
                    // Add live updates (they might be newer or duplicates)
                    prevLive.forEach(m => messageMap.set(m.id, m))

                    return Array.from(messageMap.values()).sort((a, b) =>
                        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    )
                })

                // 2. Fetch basic conversation data
                const convData = await getConversationDetails(conversationId)

                if (!convData) {
                    console.error('Error fetching conversation: conversation not found or access denied')
                    return
                }

                if (convData && isMounted) {
                    console.log('[ChatWindow] Conversation data from DB:', convData)
                    setIsGroup(convData.is_group)

                    if (convData.is_group) {
                        setOtherUser({
                            id: 'group',
                            full_name: convData.name || 'Group Chat',
                            avatar_url: convData.avatar_url
                        })

                        // Check if Admin is monitoring
                        if (currentUser.role === 'admin') {
                            // If we didn't get a prop, or just to be safe, check participation
                            if (initialIsMonitoring === undefined) {
                                const { data: partCheck } = await supabase
                                    .from('conversation_participants')
                                    .select('id')
                                    .eq('conversation_id', conversationId)
                                    .eq('user_id', currentUser.id)
                                    .single()

                                isPart = !!partCheck
                                setIsAdminMonitoring(!isPart)
                            } else {
                                isPart = !initialIsMonitoring
                            }
                        } else {
                            isPart = true // Regular employee is always part of visibility
                        }

                        // Fetch group members separately using server action (bypasses RLS issues)
                        const members = await getGroupMembers(conversationId)
                        console.log('[ChatWindow] Group members fetched:', members)
                        if (isMounted) {
                            setGroupMembers(members)
                        }
                    } else {
                        // For P2P, fetch the other user's details
                        const isUser1 = convData.user1_id === currentUser.id
                        const isUser2 = convData.user2_id === currentUser.id
                        isPart = isUser1 || isUser2

                        if (initialIsMonitoring === undefined) {
                            setIsAdminMonitoring(currentUser.role === 'admin' && !isPart)
                        } else {
                            setIsAdminMonitoring(initialIsMonitoring)
                        }

                        const otherId = isUser1 ? convData.user2_id : convData.user1_id

                        if (otherId) {
                            const { data: userData } = await supabase
                                .from('employees')
                                .select('id, full_name, avatar_url')
                                .eq('id', otherId)
                                .single()

                            if (userData && isMounted) {
                                if (currentUser.role === 'admin' && !isPart) {
                                    // Extract names for monitoring label if we have access to both
                                    const { data: u1 } = await supabase.from('employees').select('full_name').eq('id', convData.user1_id).single()
                                    const { data: u2 } = await supabase.from('employees').select('full_name').eq('id', convData.user2_id).single()

                                    setOtherUser({
                                        id: 'monitoring',
                                        full_name: `${u1?.full_name || '...'} & ${u2?.full_name || '...'}`,
                                        avatar_url: null
                                    })
                                } else {
                                    setOtherUser(userData)
                                }
                            }
                        }
                    }

                    // Mark as read if participant OR Admin (to clear counter)
                    if ((isPart || currentUser.role === 'admin') && isMounted) {
                        await markConversationAsRead(conversationId)
                        router.refresh()
                    }
                }

            } catch (err) {
                console.error('Error initializing chat:', err)
            } finally {
                console.log('[ChatWindow] initChat finished')
                if (isMounted) {
                    setLoading(false)
                    setTimeout(scrollToBottom, 50)
                }
            }
        }

        initChat()

        // Subscribe to Group Metadata changes (Name/Avatar/Members)
        const groupChannel = supabase
            .channel(`group_meta:${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'conversations',
                    filter: `id=eq.${conversationId}`
                },
                (payload: any) => {
                    const updated = payload.new as any
                    if (updated.is_group) {
                        setOtherUser(prev => prev ? {
                            ...prev,
                            full_name: updated.name || prev.full_name,
                            avatar_url: updated.avatar_url || prev.avatar_url
                        } : null)
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'conversation_participants',
                    filter: `conversation_id=eq.${conversationId}`
                },
                async () => {
                    // Re-fetch members list on ANY change using server action
                    const members = await getGroupMembers(conversationId)
                    if (isMounted) {
                        setGroupMembers(members)
                    }
                }
            )
            .subscribe()

        return () => {
            isMounted = false
            console.log('ChatWindow: Cleaning up subscription')
            supabase.removeChannel(groupChannel)
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
        // Generate a stable UUID for the message to avoid duplication with Realtime subscription
        const tempId = crypto.randomUUID()

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
            duration: isAudio ? recordingTime : null,
            reply_to_id: replyingTo?.id,
            reply_to: replyingTo ? {
                content: replyingTo.content,
                sender: {
                    full_name: replyingTo.sender?.full_name || 'Someone'
                },
                type: replyingTo.type
            } : null
        }

        setMessages(prev => [...prev, {
            ...optimisticMsg,
            sender: {
                id: currentUser.id,
                full_name: currentUser.full_name,
                avatar_url: currentUser.avatar_url
            }
        }])
        setTimeout(scrollToBottom, 50)

        try {
            const formData = new FormData()
            formData.append('id', tempId)
            formData.append('conversationId', conversationId)
            formData.append('content', messageContent)
            formData.append('senderId', currentUser.id)
            formData.append('senderRole', currentUser.role)
            formData.append('type', type)
            if (recordingTime > 0) formData.append('duration', recordingTime.toString())
            if (fileToSend) formData.append('file', fileToSend)
            if (replyingTo) formData.append('replyToId', replyingTo.id)

            setReplyingTo(null) // Clear reply state

            const result = await sendMessage(formData)

            if (!result.success) {
                setMessages(prev => prev.filter(m => m.id !== tempId))
                console.error('Failed to send message:', result.error)
                alert('Failed to send message')
            } else {
                // Update with server data BUT keep the ID (which should match anyway)
                setMessages(prev => prev.map(m => m.id === tempId ? result.message : m))
            }
        } catch (err) {
            setMessages(prev => prev.filter(m => m.id !== tempId))
            console.error(err)
        } finally {
            setSending(false)
        }
    }

    const handleReaction = async (messageId: string, emoji: string) => {
        // Optimistic update
        setMessages(prev => prev.map(msg => {
            if (msg.id !== messageId) return msg;

            // Limit to 1 reaction per user (Swap logic)
            // 1. Remove ANY existing reaction by the current user
            const existingReactionIndex = msg.reactions?.findIndex(r => r.user_id === currentUser.id);
            let newReactions = [...(msg.reactions || [])];
            let existingReactionEmoji = null;

            if (existingReactionIndex !== undefined && existingReactionIndex !== -1) {
                existingReactionEmoji = newReactions[existingReactionIndex].emoji;
                newReactions.splice(existingReactionIndex, 1);
            }

            // 2. If the clicked emoji was different from the existing one (or there was no existing one), ADD it.
            // If it was the SAME, we did nothing after removing (effectively toggling off).
            if (existingReactionEmoji !== emoji) {
                newReactions.push({
                    id: 'temp-' + Date.now(),
                    user_id: currentUser.id,
                    emoji: emoji
                });
            }

            return { ...msg, reactions: newReactions };
        }));

        await toggleReaction(messageId, emoji);
    }

    // Subscribe to reactions
    useEffect(() => {
        const channel = supabase
            .channel(`reactions:${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'message_reactions',
                },
                (payload: any) => {
                    // We could try to smartly update messages, but refreshing is safer to stay in sync
                    // Or check if it belongs to our messages.
                    // A simple re-fetch or manual splice is fine.
                    // For simplicity, let's just re-fetch messages silently or try to splice if possible.
                    // Actually, payload has "old" and "new".
                    // If INSERT: find message, add reaction.
                    // If DELETE: find message, remove reaction.

                    if (payload.eventType === 'INSERT') {
                        const newReaction = payload.new as { message_id: string, user_id: string, emoji: string, id: string };
                        setMessages(prev => prev.map(msg => {
                            if (msg.id !== newReaction.message_id) return msg;

                            // Remove any existing reaction from this user (enforce 1 per user)
                            // Also check if we already have this specific new reaction ID (optimistic check)
                            const existingUserReaction = msg.reactions?.some(r => r.user_id === newReaction.user_id);
                            const alreadyHasThisReaction = msg.reactions?.some(r => r.id === newReaction.id);

                            if (alreadyHasThisReaction) return msg;

                            let newReactions = [...(msg.reactions || [])];
                            if (existingUserReaction) {
                                newReactions = newReactions.filter(r => r.user_id !== newReaction.user_id);
                            }

                            return { ...msg, reactions: [...newReactions, newReaction] };
                        }));
                    } else if (payload.eventType === 'DELETE') {
                        const oldReaction = payload.old as { id: string };
                        setMessages(prev => prev.map(msg => {
                            if (!msg.reactions?.some(r => r.id === oldReaction.id)) return msg;
                            return { ...msg, reactions: msg.reactions.filter(r => r.id !== oldReaction.id) };
                        }));
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [conversationId, supabase])

    const emojis = ['👍', '❤️', '😂', '😮', '😢', '😡']

    const handleDelete = async (messageId: string) => {

        // Optimistic update
        setMessages(prev => prev.filter(m => m.id !== messageId))

        const result = await deleteMessage(messageId)
        if (result.error) {
            alert(result.error)
            // Revert could be implemented here by re-fetching or keeping state, 
            // but for now simple optimistic is fine, a refetch happens on mount/update anyway if needed
        }
    }

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Chat Header */}
            <div className={`p-4 border-b border-gray-200 bg-white flex items-center justify-between shadow-sm z-10 ${isGroup ? 'cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors' : ''}`}
                onClick={() => {
                    console.log('[Header Click Debug]', { isGroup, role: currentUser.role, showGroupSettings })
                    if (isGroup) {
                        console.log('[Opening Group Settings Modal]')
                        setShowGroupSettings(true)
                    }
                }}
                title={isGroup ? "Manage Group Settings" : undefined}
            >
                <div className="flex items-center gap-3">
                    {/* Back Button for Mobile */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            router.push('/messages')
                        }}
                        className="md:hidden p-2 -ml-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>

                    <div className="relative">
                        <EmployeeAvatar
                            avatarUrl={otherUser?.avatar_url || null}
                            fullName={otherUser?.full_name || '...'}
                            isOnline={!isGroup && !!otherUser && isUserOnline(otherUser.id)}
                        />
                        {isGroup && (
                            <div className="absolute -bottom-1 -right-1 bg-indigo-600 rounded-full p-1 border-2 border-white">
                                <Users className="w-2.5 h-2.5 text-white" />
                            </div>
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-gray-900 leading-none">
                                {otherUser?.full_name || 'Loading...'}
                            </h3>
                            {!isGroup && otherUser && (
                                <p className="text-[10px] text-gray-500 font-medium flex items-center gap-1 mt-1">
                                    {isUserOnline(otherUser.id) ? (
                                        <span className="text-green-600 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                            Online
                                        </span>
                                    ) : (
                                        <span>
                                            Last seen <SafeLastSeen date={(otherUser as any).last_seen_at} />
                                        </span>
                                    )}
                                </p>
                            )}
                            {isAdminMonitoring ? (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full border border-amber-200 uppercase tracking-wider">
                                    Monitoring Mode
                                </span>
                            ) : isGroup && (
                                <Settings className="w-3 h-3 text-gray-400" />
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {!isGroup && !isAdminMonitoring && (
                        <>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    startCall(conversationId, otherUser!.id, otherUser!.full_name, otherUser!.avatar_url, 'audio')
                                }}
                                className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                                title="Voice Call"
                            >
                                <Phone className="w-5 h-5" />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    startCall(conversationId, otherUser!.id, otherUser!.full_name, otherUser!.avatar_url, 'video')
                                }}
                                className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                                title="Video Call"
                            >
                                <VideoIcon className="w-5 h-5" />
                            </button>
                            <div className="w-px h-6 bg-gray-200 mx-1"></div>
                        </>
                    )}
                </div>
            </div>

            {/* Monitoring Mode Alert Banner */}
            {isAdminMonitoring && (
                <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center gap-2">
                    <div className="p-1 bg-amber-100 rounded-full">
                        <Users className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <p className="text-xs font-medium text-amber-800">
                        You are viewing this conversation as an Administrator. This is a <strong>read-only</strong> monitoring view.
                    </p>
                </div>
            )}

            {/* Notification Permission Banner */}
            {hasMounted && notificationPermission === 'default' && (
                <div className="bg-indigo-600 px-4 py-2 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-white">
                        <Settings className="w-4 h-4 animate-pulse" />
                        <p className="text-xs font-bold">
                            Activer les notifications système pour ne manquer aucun message ?
                        </p>
                    </div>
                    <button
                        onClick={requestPermission}
                        className="bg-white text-indigo-600 px-3 py-1 rounded-md text-[10px] font-black uppercase hover:bg-indigo-50 transition-colors shadow-sm"
                    >
                        Activer maintenant
                    </button>
                </div>
            )}

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
                            id={`msg-${msg.id}`}
                            className={`flex ${msg.sender_id === currentUser.id ? 'justify-end' : 'justify-start'} group transition-all duration-300 mb-4 gap-2`}
                        >
                            {/* Avatar for others in group chats */}
                            {isGroup && msg.sender_id !== currentUser.id && (
                                <div className="flex-shrink-0 self-end mb-1">
                                    <EmployeeAvatar
                                        avatarUrl={msg.sender?.avatar_url || null}
                                        fullName={msg.sender?.full_name || '...'}
                                        className="w-8 h-8 rounded-full border border-gray-100 shadow-sm"
                                    />
                                </div>
                            )}

                            {/* Message Wrapper for relative positioning of actions */}
                            <div className={`relative group max-w-[70%] flex flex-col ${msg.sender_id === currentUser.id ? 'items-end' : 'items-start'} gap-1`}>

                                {/* Sender Name in Monitoring/Group Chats */}
                                {(isGroup || isAdminMonitoring) && msg.sender_id !== currentUser.id && (
                                    <span className="text-[11px] font-semibold text-gray-500 ml-1 mb-0.5">
                                        {msg.sender?.full_name?.split(' ')[0] || '...'}
                                    </span>
                                )}

                                <div className={`flex flex-col ${msg.sender_id === currentUser.id ? 'items-end' : 'items-start'} gap-1`}>

                                    {/* Bubble (now containing both reply and content) */}
                                    <div className={`relative px-4 py-2 shadow-sm max-w-full ${msg.sender_id === currentUser.id
                                        ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm'
                                        : 'bg-white text-gray-900 rounded-2xl rounded-tl-sm border border-gray-100'
                                        }`}>

                                        {/* Quote (Reply) rendering - Now inside bubble at the top */}
                                        {msg.reply_to && (
                                            <div
                                                onClick={() => {
                                                    const target = document.getElementById(`msg-${msg.reply_to_id}`)
                                                    target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                                    target?.classList.add('ring-2', 'ring-indigo-400', 'ring-offset-2')
                                                    setTimeout(() => target?.classList.remove('ring-2', 'ring-indigo-400', 'ring-offset-2'), 2000)
                                                }}
                                                className={`mb-2 p-2 rounded-lg border-l-4 cursor-pointer text-xs max-w-full truncate ${msg.sender_id === currentUser.id
                                                    ? 'bg-indigo-500/30 border-indigo-300 text-indigo-50'
                                                    : 'bg-gray-100 border-gray-300 text-gray-600'
                                                    }`}
                                            >
                                                <p className="font-bold mb-0.5">{msg.reply_to.sender.full_name}</p>
                                                <p className="truncate opacity-80">
                                                    {msg.reply_to.type === 'image' ? '📷 Image' :
                                                        msg.reply_to.type === 'audio' ? '🎤 Voice message' :
                                                            msg.reply_to.type === 'file' ? '📁 File' :
                                                                msg.reply_to.content}
                                                </p>
                                            </div>
                                        )}

                                        {/* Original Message Content */}
                                        {(msg as any).type === 'call_audio' || (msg as any).type === 'call_video' ? (
                                            <div className="flex items-center gap-3 py-1">
                                                <div className={`p-2 rounded-full ${(msg as any).content === 'Appel manqué' ? 'bg-red-50 text-red-500' : (msg.sender_id === currentUser.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500')}`}>
                                                    {(msg as any).type === 'call_audio' ? <Phone className="w-4 h-4" /> : <VideoIcon className="w-4 h-4" />}
                                                </div>
                                                <div className="flex flex-col">
                                                    <p className="text-sm font-bold">
                                                        {(msg as any).type === 'call_audio' ? 'Appel audio' : 'Appel vidéo'}
                                                        {(msg as any).content === 'Appel manqué' ? ' manqué' : ''}
                                                    </p>
                                                    {(msg as any).content !== 'Appel manqué' && (
                                                        <p className="text-[10px] opacity-80">{(msg as any).content}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (msg as any).type === 'image' ? (
                                            <div className="mb-1 relative group/image">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <a href={msg.content} target="_blank" rel="noopener noreferrer" className="block cursor-zoom-in">
                                                    <img src={msg.content} alt="Image sent" className="rounded-lg max-h-64 object-cover w-full hover:opacity-95 transition-opacity" />
                                                </a>
                                                <button
                                                    className="absolute bottom-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover/image:opacity-100 transition-opacity backdrop-blur-sm z-10 cursor-pointer border-none"
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
                                                    <FileIcon className="h-6 w-6" />
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

                                        <div className="flex items-center justify-end gap-1 mt-1">
                                            <p className={`text-[10px] ${msg.sender_id === currentUser.id ? 'text-indigo-100' : 'text-gray-400'}`}>
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>

                                            {msg.sender_id === currentUser.id && (
                                                <div className="flex items-center ml-1">
                                                    {(statusUpdates[msg.id] || msg.status) === 'seen' ? (
                                                        <CheckCheck className="w-3 h-3 text-cyan-300" />
                                                    ) : (statusUpdates[msg.id] || msg.status) === 'delivered' ? (
                                                        <CheckCheck className="w-3 h-3 text-indigo-200" />
                                                    ) : (
                                                        <Check className="w-3 h-3 text-indigo-200" />
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Reactions Display (On Bubble) */}
                                        {msg.reactions?.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2 justify-end">
                                                {Array.from(new Set(msg.reactions.map(r => r.emoji))).map(emoji => {
                                                    const count = msg.reactions.filter(r => r.emoji === emoji).length;
                                                    const isMe = msg.reactions.some(r => r.emoji === emoji && r.user_id === currentUser.id);
                                                    return (
                                                        <button
                                                            key={emoji}
                                                            onClick={() => handleReaction(msg.id, emoji)}
                                                            className={`text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 rounded-full transition-colors ${isMe
                                                                ? 'bg-indigo-500/20 text-white border border-indigo-400/30'
                                                                : 'bg-gray-100 text-gray-600 border border-gray-200'
                                                                } ${msg.sender_id === currentUser.id && isMe ? 'bg-white/20 text-white' : ''}`}
                                                        >
                                                            <span>{emoji}</span>
                                                            {count > 1 && <span className="font-medium">{count}</span>}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Reaction Picker, Delete & Reply (Outside Bubble, Inside Relative Wrapper) */}
                                    {!isAdminMonitoring && (
                                        <div className={`opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center absolute top-full left-0 right-0 z-50 ${msg.sender_id === currentUser.id ? 'justify-end' : 'justify-start'} pt-2 pointer-events-auto`}>
                                            <div className={`bg-white/95 backdrop-blur-sm shadow-xl rounded-full border border-gray-100 flex items-center p-1.5 gap-1 whitespace-nowrap ${msg.sender_id === currentUser.id ? 'flex-row-reverse' : 'flex-row'}`}>
                                                {emojis.map(emoji => (
                                                    <button
                                                        key={emoji}
                                                        onClick={() => handleReaction(msg.id, emoji)}
                                                        className="p-1.5 hover:bg-gray-100 rounded-full hover:scale-125 transition-transform text-lg leading-none"
                                                    >
                                                        {emoji}
                                                    </button>
                                                ))}

                                                <div className="w-px h-4 bg-gray-200 mx-1"></div>

                                                {/* Reply Button */}
                                                <button
                                                    onClick={() => {
                                                        setReplyingTo(msg)
                                                        inputRef.current?.focus()
                                                    }}
                                                    className="p-1.5 hover:bg-gray-100 rounded-full transition-transform text-gray-500 hover:text-indigo-600"
                                                    title="Reply"
                                                >
                                                    <Reply className="w-4 h-4" />
                                                </button>

                                                {/* Delete Button inside the pill */}
                                                {msg.sender_id === currentUser.id && currentUser.role !== 'admin' && (
                                                    <>
                                                        <div className="w-px h-4 bg-gray-200 mx-1"></div>
                                                        <button
                                                            onClick={() => handleDelete(msg.id)}
                                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                                            title="Delete Message"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            {isAdminMonitoring ? (
                <div className="p-6 bg-gray-50 border-t border-gray-200 flex flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                        <Users className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-gray-900">Administrator Monitoring Mode</h4>
                    <p className="text-xs text-gray-500 text-center max-w-md">
                        This conversation is restricted to read-only access for administrative monitoring.
                        You cannot send messages or interact with this chat unless you are a participant.
                    </p>
                </div>
            ) : (
                <form onSubmit={handleSend} className="p-4 bg-white border-t border-gray-200 z-10">

                    {/* Replying to Preview */}
                    {replyingTo && (
                        <div className="mb-2 p-3 bg-gray-50 border-l-4 border-indigo-500 rounded-lg flex items-center justify-between animate-in slide-in-from-bottom-2">
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-indigo-600">{replyingTo.sender?.full_name}</p>
                                <p className="text-xs text-gray-500 truncate">
                                    {replyingTo.type === 'image' ? '📷 Image' :
                                        replyingTo.type === 'audio' ? '🎤 Voice message' :
                                            replyingTo.type === 'file' ? '📁 File' :
                                                replyingTo.content}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setReplyingTo(null)}
                                className="p-1 hover:bg-gray-200 rounded-full transition-colors ml-2"
                            >
                                <X className="w-4 h-4 text-gray-400" />
                            </button>
                        </div>
                    )}

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
                                        <FileIcon className="h-5 w-5" />
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
                                <Square className="h-4 w-4 fill-current" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-2 items-end">
                            <button
                                type="button"
                                onClick={() => (fileInputRef as any).current?.click()}
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
                                ref={inputRef}
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
            )}

            {/* Modals */}
            {isGroup && (
                <GroupSettingsModal
                    isOpen={showGroupSettings}
                    onClose={() => setShowGroupSettings(false)}
                    conversationId={conversationId}
                    groupName={otherUser?.full_name || ''}
                    members={groupMembers}
                    currentUserId={currentUser.id}
                    isAdmin={currentUser.role === 'admin'}
                />
            )}
        </div>
    )
}
