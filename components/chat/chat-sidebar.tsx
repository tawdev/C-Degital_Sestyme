'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import EmployeeAvatar from '@/components/employee-avatar'
import { SafeDate } from '@/components/ui/safe-date'
import { ChatConversation } from '@/lib/types/chat'
import { useSearchParams, useParams } from 'next/navigation'
import UnreadBadge from './unread-badge'
import { Plus, Users } from 'lucide-react'
import GroupChatModal from './group-chat-modal'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/context/realtime-context'

interface ChatSidebarProps {
    conversations: ChatConversation[]
    contacts?: any[]
    activeId?: string
    isAdmin: boolean
    currentUserId: string
}

export default function ChatSidebar({ conversations, contacts, activeId: propActiveId, isAdmin, currentUserId }: ChatSidebarProps) {
    const searchParams = useSearchParams()
    const params = useParams()
    const activeId = params?.id as string || propActiveId
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [localReadIds, setLocalReadIds] = useState<Set<string>>(new Set())
    const { isUserOnline } = useRealtime()
    const router = useRouter()

    useEffect(() => {
        setMounted(true)

        // Refresh on new messages (for unread counts and sorting)
        const handleNewMessage = () => {
            console.log('[ChatSidebar] New message detected, refreshing UI...')
            router.refresh()
        }

        const handleReset = () => {
            console.log('[ChatSidebar] Unread count reset detected, refreshing UI...')
            router.refresh()
        }

        window.addEventListener('new-message', handleNewMessage)
        window.addEventListener('unread-count-reset', handleReset)

        return () => {
            window.removeEventListener('new-message', handleNewMessage)
            window.removeEventListener('unread-count-reset', handleReset)
        }
    }, [router])

    // Optimistically clear unread count for the active conversation
    useEffect(() => {
        if (activeId && !localReadIds.has(activeId)) {
            setLocalReadIds(prev => {
                const next = new Set(prev)
                next.add(activeId)
                return next
            })
        }
    }, [activeId, localReadIds])

    // Clear local cache when conversations prop updates with 0 count (server truth arrived)
    useEffect(() => {
        setLocalReadIds(prev => {
            const next = new Set(prev)
            conversations.forEach(c => {
                if (c.unread_count === 0) next.delete(c.id)
            })
            return next
        })
    }, [conversations])

    // Display all active conversations (including groups) followed by contacts who don't have a chat yet
    const displayItems = [
        ...conversations,
        ...(contacts || []).filter(contact => !conversations.some(c => c.employee_id === contact.id))
    ]

    return (
        <div className="flex-1 flex flex-col min-h-0">
            {/* Action Buttons (Admin only) */}
            {isAdmin && (
                <div className="p-3 bg-white border-b border-gray-100 flex gap-2">
                    <button
                        onClick={() => setIsGroupModalOpen(true)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors shadow-sm border border-indigo-100/50"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        New Group
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto">
                {displayItems.length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-500">
                        No active chats found.
                    </div>
                ) : (
                    displayItems.map((item) => {
                        const isContact = 'full_name' in item || 'fullName' in item
                        const employee = isContact ? item : item.employee
                        const targetId = item.id

                        // Find existing conversation for this employee to get its ID and unread count
                        const existingConversation = isContact
                            ? conversations.find(c => c.employee_id === targetId)
                            : item as ChatConversation

                        const isGroup = (existingConversation as any)?.is_group
                        const conversationId = existingConversation?.id
                        let unreadCount = existingConversation?.unread_count || 0

                        // Optimistic override
                        if (conversationId && localReadIds.has(conversationId)) {
                            unreadCount = 0
                        }

                        const isActive = activeId === conversationId || (searchParams.get('employee_id') === targetId)
                        const href = conversationId
                            ? `/messages/${conversationId}`
                            : `/messages/new?employee_id=${targetId}`

                        return (
                            <Link
                                key={item.id}
                                href={href}
                                className={`block hover:bg-gray-50 transition-all cursor-pointer ${isActive ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : 'border-l-4 border-l-transparent'
                                    }`}
                            >
                                <div className="flex items-center gap-3 p-4 border-b border-gray-100">
                                    <div className="relative">
                                        <div className="relative">
                                            <EmployeeAvatar
                                                avatarUrl={employee?.avatar_url || null}
                                                fullName={employee?.full_name || employee?.fullName || 'User'}
                                                isOnline={!isGroup && !!employee?.id && isUserOnline(employee.id)}
                                            />
                                            {isGroup && (
                                                <div className="absolute -bottom-1 -right-1 bg-indigo-600 rounded-full p-1 border-2 border-white">
                                                    <Users className="w-2.5 h-2.5 text-white" />
                                                </div>
                                            )}
                                        </div>
                                        {conversationId && !isActive && (
                                            <div className="absolute -top-1 -right-1 z-10">
                                                <UnreadBadge
                                                    initialCount={unreadCount}
                                                    userId={currentUserId}
                                                    conversationId={conversationId}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <p className={`text-sm tracking-tight truncate ${unreadCount > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                                                {employee?.full_name || employee?.fullName || 'Unknown Employee'}
                                            </p>
                                            {(item as any).isAdminMonitoring && (
                                                <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[8px] font-bold rounded uppercase border border-amber-100 ml-1">
                                                    Monitor
                                                </span>
                                            )}
                                            {!isContact && (
                                                <span className="text-[10px] text-gray-400">
                                                    <SafeDate
                                                        date={item.last_message_at || item.created_at}
                                                        formatString={item.last_message_at ? 'HH:mm' : 'dd/MM/yyyy'}
                                                    />
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 truncate mt-0.5">
                                            {isGroup ? (
                                                item.last_message_content ? (
                                                    <span className="flex items-center gap-1">
                                                        <span className="font-bold text-indigo-600/80">{item.last_sender_name?.split(' ')[0]}:</span>
                                                        <span className="truncate">{item.last_message_content}</span>
                                                    </span>
                                                ) : `${(existingConversation as any).participants?.length || 0} members`
                                            ) : (
                                                item.last_message_content || (employee?.role || 'Team Member')
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        )
                    })
                )}
            </div>

            <GroupChatModal
                isOpen={isGroupModalOpen}
                onClose={() => setIsGroupModalOpen(false)}
                contacts={contacts || []}
            />
        </div>
    )
}
