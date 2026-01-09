'use client'

import Link from 'next/link'
import EmployeeAvatar from '@/components/employee-avatar'
import { ChatConversation } from '@/lib/types/chat'
import { useSearchParams, useParams } from 'next/navigation'
import UnreadBadge from './unread-badge'

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

    // Show alphabetical directory (contacts) for everyone
    const displayItems = contacts || conversations

    if (displayItems.length === 0) {
        return (
            <div className="p-8 text-center text-sm text-gray-500">
                No active chats found.
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-y-auto">
            {displayItems.map((item) => {
                const isContact = 'full_name' in item || 'fullName' in item
                const employee = isContact ? item : item.employee
                const targetId = item.id

                // Find existing conversation for this employee to get its ID and unread count
                const existingConversation = isContact
                    ? conversations.find(c => c.employee_id === targetId)
                    : item as ChatConversation

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
                                <EmployeeAvatar
                                    avatarUrl={employee?.avatar_url || null}
                                    fullName={employee?.full_name || employee?.fullName || 'User'}
                                />
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
                                        <span className="text-[10px] text-gray-400">
                                            {new Date(item.created_at).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 truncate">
                                    {employee?.role || 'Team Member'}
                                </p>
                            </div>
                        </div>
                    </Link>
                )
            })}
        </div>
    )
}
