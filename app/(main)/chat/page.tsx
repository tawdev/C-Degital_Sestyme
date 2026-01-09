

import { getSession } from '@/app/auth/actions'
import { redirect } from 'next/navigation'
import { getConversations, startConversation, getEmployees } from './actions'
import ChatSidebar from '@/components/chat/chat-sidebar'
import ChatWindow from '@/components/chat/chat-window'
import { createClient } from '@/lib/supabase/server'
import { Loader2, AlertCircle } from 'lucide-react'

export default async function ChatPage({
    searchParams,
}: {
    searchParams: { id?: string; employee_id?: string }
}) {
    const session = await getSession()
    if (!session) redirect('/auth/login')

    const supabase = createClient()
    const { data: employee } = await supabase
        .from('employees')
        .select('role, full_name, avatar_url')
        .eq('id', session.id)
        .single()

    if (!employee) redirect('/dashboard')

    const isAdmin = employee.role === 'Administrator'
    const [conversations, allEmployees] = await Promise.all([
        getConversations(),
        getEmployees()
    ])

    const contacts = allEmployees.filter(e => e.id !== session.id)

    // Priority:
    // 1. Explicit ID from URL (Already resolved)
    // 2. Employee ID from URL (Admin starting chat with specific employee)
    // 3. Current Employee's existing chat (For Employee)
    // 4. Default to first conversation (For Admin dashboard)

    // Priority:
    // 1. Explicit ID from URL (conversation UUID)
    // 2. Employee ID from URL (Resolve/Start conversation with this person)
    // 3. Fallback to the first existing conversation

    let activeId = searchParams.id
    let initializationError = false

    // SERVER-SIDE RESOLUTION: If we have an employee_id but no conversation id, resolve it now.
    // This handles direct links from other pages, bookmarks, and page refreshes.
    if (!activeId && searchParams.employee_id) {
        console.log('[ChatPage] Resolving employee_id to conversation:', searchParams.employee_id)

        // 1. Check local list first (fast)
        const existing = conversations.find(c => c.employee_id === searchParams.employee_id)
        if (existing) {
            console.log('[ChatPage] Resolved from local list:', existing.id)
            redirect(`/chat?id=${existing.id}`)
        } else {
            // 2. Resolve on server (slow but necessary for new chats)
            const newId = await startConversation(searchParams.employee_id)
            if (newId) {
                console.log('[ChatPage] Resolved on server:', newId)
                redirect(`/chat?id=${newId}`)
            } else {
                console.warn('[ChatPage] Failed to resolve conversation for:', searchParams.employee_id)
                initializationError = true
            }
        }
    }

    // Fallback: Default to first existing conversation if nothing selected
    if (!activeId && conversations.length > 0) {
        activeId = conversations[0].id
    }

    const activeConversation = conversations.find(c => c.id === activeId)

    return (
        <div className="h-[calc(100vh-8rem)] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex">
            {/* Sidebar */}
            <div className="w-80 border-r border-gray-200 flex-shrink-0 flex flex-col">
                <div className="p-4 border-b border-gray-200 bg-gray-50/50">
                    <h2 className="text-lg font-bold text-gray-900">Messages</h2>
                    <p className="text-xs text-gray-500">
                        {isAdmin ? 'Team Directory & History' : 'Chat with your colleagues'}
                    </p>
                </div>
                <ChatSidebar
                    conversations={conversations}
                    contacts={contacts}
                    activeId={activeId}
                    isAdmin={isAdmin}
                    currentUserId={session.id}
                />
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col bg-gray-50/30">
                {activeId ? (
                    <ChatWindow
                        conversationId={activeId}
                        currentUser={{
                            id: session.id,
                            role: (session.role === 'Administrator' ? 'admin' : 'employee') as any,
                            full_name: session.full_name,
                            avatar_url: employee.avatar_url
                        }}
                        recipient={activeConversation?.employee || null}
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center transition-all animate-in fade-in duration-500">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 relative">
                            {searchParams.employee_id && !initializationError ? (
                                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                            ) : initializationError ? (
                                <AlertCircle className="w-8 h-8 text-red-500" />
                            ) : (
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            )}
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">
                            {initializationError ? 'Failed to start chat' : 'Select a conversation'}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1 max-w-sm">
                            {initializationError
                                ? 'We could not initialize the conversation. This might be due to a connection issue or the employee no longer exists.'
                                : searchParams.employee_id
                                    ? 'Initialising chat...'
                                    : 'Choose a colleague to start chatting'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
