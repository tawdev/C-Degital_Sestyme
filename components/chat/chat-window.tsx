'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChatMessage, ChatRole } from '@/lib/types/chat'
import { sendMessage, getMessages, markConversationAsRead } from '@/app/(main)/messages/actions'
import { Send, Loader2 } from 'lucide-react'
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

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!content.trim() || sending) return

        const messageContent = content.trim()
        setContent('') // Clear immediately for better UX
        setSending(true)

        // Optimistic Update
        const tempId = `temp-${Date.now()}`
        const optimisticMsg: ChatMessage = {
            id: tempId,
            conversation_id: conversationId,
            sender_id: currentUser.id,
            sender_role: currentUser.role,
            content: messageContent,
            created_at: new Date().toISOString(),
            is_read: true,
            recipient_id: otherUser?.id || 'temp-recipient'
        }

        setMessages(prev => [...prev, optimisticMsg])
        setTimeout(scrollToBottom, 50)

        try {
            const result = await sendMessage(
                conversationId,
                messageContent,
                currentUser.id,
                currentUser.role
            )

            if (!result.success) {
                // Remove optimistic message on error
                setMessages(prev => prev.filter(m => m.id !== tempId))
                console.error('Failed to send message:', result.error)
            } else {
                // The Realtime subscription will handle the "real" message insert, 
                // but we might want to swap out the temp ID for the real one 
                // to avoid duplicates if the subscription is slow or duplicates occur.
                setMessages(prev => prev.map(m => m.id === tempId ? result.message : m))
            }
        } catch (err) {
            setMessages(prev => prev.filter(m => m.id !== tempId))
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
                            <div className={`max-w-[70%] ${msg.sender_id === currentUser.id ? 'bg-indigo-600 text-white rounded-l-xl rounded-tr-xl' : 'bg-white text-gray-900 rounded-r-xl rounded-tl-xl border border-gray-100 shadow-sm'} p-3 px-4`}>
                                <p className="text-sm leading-relaxed">{msg.content}</p>
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
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        disabled={sending}
                    />
                    <button
                        type="submit"
                        disabled={!content.trim() || sending}
                        className="bg-indigo-600 text-white p-2.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center"
                    >
                        {sending ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Send className="h-5 w-5" />
                        )}
                    </button>
                </div>
            </form>
        </div>
    )
}
