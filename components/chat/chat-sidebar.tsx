'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import EmployeeAvatar from '@/components/employee-avatar'
import { SafeDate } from '@/components/ui/safe-date'
import { ChatConversation } from '@/lib/types/chat'
import { useSearchParams, useParams, useRouter } from 'next/navigation'
import UnreadBadge from './unread-badge'
import { Plus, Users, User, Search } from 'lucide-react'
import GroupChatModal from './group-chat-modal'
import { useRealtime } from '@/context/realtime-context'
import { format } from 'date-fns'

interface ChatSidebarProps {
    conversations: ChatConversation[]
    contacts?: any[]
    activeId?: string
    isAdmin: boolean
    currentUserId: string
}

export default function ChatSidebar({ conversations, contacts, activeId: propActiveId, isAdmin, currentUserId }: ChatSidebarProps) {
    const params = useParams()
    const activeId = params?.id as string || propActiveId
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const { isUserOnline } = useRealtime()
    const router = useRouter()

    useEffect(() => {
        const handleNewMessage = () => router.refresh()
        const handleReset = () => router.refresh()

        window.addEventListener('new-message', handleNewMessage)
        window.addEventListener('unread-count-reset', handleReset)

        return () => {
            window.removeEventListener('new-message', handleNewMessage)
            window.removeEventListener('unread-count-reset', handleReset)
        }
    }, [router])

    // Filtre les conversations et les contacts
    const filteredConversations = conversations.filter(c =>
        c.employee?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.last_message_content?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const filteredContacts = (contacts || [])
        .filter(contact => !conversations.some(c => c.employee_id === contact.id))
        .filter(contact => contact.full_name?.toLowerCase().includes(searchQuery.toLowerCase()))

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-transparent">
            {/* Search Bar */}
            <div className="px-8 py-6 border-b border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-white/5">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Rechercher..."
                        className="w-full pl-11 pr-4 py-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-200 dark:focus:border-indigo-400/30 transition-all text-gray-900 dark:text-white placeholder:text-gray-400"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Action Buttons (Admin only) */}
            {isAdmin && (
                <div className="px-8 py-4 border-b border-gray-100 dark:border-white/5">
                    <button
                        onClick={() => setIsGroupModalOpen(true)}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-900/20 active:scale-[0.98]"
                    >
                        <Plus className="w-4 h-4" />
                        Nouveau Groupe
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 custom-scrollbar">
                {/* Active Conversations */}
                {filteredConversations.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="px-4 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-4">Discussions</h3>
                        {filteredConversations.map((conv) => {
                            const otherUser = conv.employee
                            const isActive = activeId === conv.id
                            const unreadCount = conv.unread_count || 0
                            const isUnread = unreadCount > 0

                            return (
                                <Link
                                    key={conv.id}
                                    href={`/messages/${conv.id}`}
                                    className={`flex items-center gap-4 p-4 rounded-3xl transition-all group relative overflow-hidden ${isActive
                                        ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/20'
                                        : 'hover:bg-indigo-50/50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                                        }`}
                                >
                                    <div className="relative shrink-0">
                                        <EmployeeAvatar
                                            avatarUrl={otherUser?.avatar_url || null}
                                            fullName={otherUser?.full_name || 'User'}
                                            className={`w-12 h-12 text-xs font-black border-2 transition-all ${isActive ? 'border-indigo-400' : 'border-white dark:border-white/10 shadow-sm'}`}
                                        />
                                        {otherUser?.id && isUserOnline(otherUser.id) && (
                                            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-gray-900 rounded-full" />
                                        )}
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                        <div className="flex justify-between items-center mb-0.5">
                                            <span className={`text-sm font-black truncate ${isActive ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                                                {otherUser?.full_name || 'Utilisateur'}
                                            </span>
                                            {conv.last_message_at && (
                                                <span className={`text-[10px] font-bold shrink-0 ${isActive ? 'text-indigo-200' : 'text-gray-400 dark:text-gray-500'}`}>
                                                    {format(new Date(conv.last_message_at), 'HH:mm')}
                                                </span>
                                            )}
                                        </div>
                                        <p className={`text-xs truncate ${isActive ? 'text-indigo-100 font-medium' : 'text-gray-500 dark:text-gray-400 font-medium'} ${isUnread && !isActive ? 'text-indigo-600 dark:text-indigo-400 font-black' : ''}`}>
                                            {conv.last_message_content || 'Démarrer la discussion'}
                                        </p>
                                    </div>
                                    {isUnread && !isActive && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-black shadow-lg shadow-indigo-900/20">
                                            {unreadCount}
                                        </div>
                                    )}
                                </Link>
                            )
                        })}
                    </div>
                )}

                {/* Contacts / Team Directory */}
                {filteredContacts.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="px-4 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-4">Membres de l'équipe</h3>
                        {filteredContacts.map((contact) => (
                            <Link
                                key={contact.id}
                                href={`/messages/new?employee_id=${contact.id}`}
                                className="flex items-center gap-4 p-4 rounded-3xl hover:bg-indigo-50/50 dark:hover:bg-white/5 transition-all group"
                            >
                                <EmployeeAvatar
                                    avatarUrl={contact.avatar_url || null}
                                    fullName={contact.full_name || 'User'}
                                    className="w-12 h-12 text-xs font-black border-2 border-white dark:border-white/10 shadow-sm transition-transform group-hover:scale-105"
                                />
                                <div className="flex-1 text-left">
                                    <div className="text-sm font-black text-gray-900 dark:text-white">{contact.full_name}</div>
                                    <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">{contact.role || 'Membre'}</div>
                                </div>
                                <User className="w-4 h-4 text-gray-200 dark:text-white/5 group-hover:text-indigo-400 transition-colors" />
                            </Link>
                        ))}
                    </div>
                )}

                {filteredConversations.length === 0 && filteredContacts.length === 0 && (
                    <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 border border-gray-100 dark:border-white/5">
                            <Search className="w-6 h-6 text-gray-300 dark:text-gray-600" />
                        </div>
                        <p className="text-sm font-bold text-gray-400 dark:text-gray-500">Aucun résultat trouvé</p>
                    </div>
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
