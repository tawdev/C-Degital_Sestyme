'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import EmployeeAvatar from '@/components/employee-avatar'
import { ChatConversation } from '@/lib/types/chat'
import { useSearchParams, useParams } from 'next/navigation'
import UnreadBadge from './unread-badge'
import { Plus, Users } from 'lucide-react'
import GroupChatModal from './group-chat-modal'

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

    useEffect(() => {
        setMounted(true)
    }, [])

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
                        const unreadCount = existingConversation?.unread_count || 0

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
                                            {!isContact && (
                                                <span className="text-[10px] text-gray-400" suppressHydrationWarning>
                                                    {mounted ? new Date(item.created_at).toLocaleDateString() : ''}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 truncate">
                                            {isGroup ? `${(existingConversation as any).participants?.length || 0} members` : (employee?.role || 'Team Member')}
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
