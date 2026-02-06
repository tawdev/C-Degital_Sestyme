import { getSession } from '@/app/auth/actions'
import { redirect } from 'next/navigation'
import { getConversations } from '../actions'
import ChatWindow from '@/components/chat/chat-window'
import { createClient } from '@/lib/supabase/server'

export default async function ChatDetailPage({
    params,
    searchParams,
}: {
    params: { id: string };
    searchParams?: { [key: string]: string | string[] | undefined };
}) {
    const session = await getSession()
    if (!session) redirect('/auth/login')

    console.log('[ChatDetailPage] session:', session?.id)

    const supabase = createClient()
    const { data: employee } = await supabase
        .from('employees')
        .select('role, full_name, avatar_url')
        .eq('id', session.id)
        .single()

    console.log('[ChatDetailPage] employee:', employee?.full_name, 'role:', employee?.role)

    if (!employee) redirect('/dashboard')

    const activeId = params.id
    console.log('[ChatDetailPage] activeId:', activeId)
    let initializationError = false
    let conversationId = activeId

    // 1. Handle "new" conversation
    if (activeId === 'new') {
        const employeeId = typeof searchParams?.employee_id === 'string' ? searchParams.employee_id : undefined
        if (employeeId) {
            const { startConversation } = await import('../actions')
            const resolvedId = await startConversation(employeeId)
            if (resolvedId) {
                redirect(`/messages/${resolvedId}`)
            }
        }
    }

    let conversations = await getConversations()
    console.log('[ChatDetailPage] conversations count:', conversations.length)

    let activeConversation = conversations.find(c => c.id === conversationId)
    console.log('[ChatDetailPage] activeConversation found in list:', !!activeConversation)

    // Fallback if not found in the regular list (e.g. for Admins/special cases)
    if (!activeConversation && activeId !== 'new') {
        const { getConversationDetails } = await import('@/app/(main)/chat/actions')
        const details = await getConversationDetails(conversationId)
        console.log('[ChatDetailPage] fallback lookup details:', details)

        if (details) {
            // Check if user is actually a participant or Admin
            const d = details as any
            const isParticipant = d.user1_id === session.id || d.user2_id === session.id
            const isAdmin = employee.role === 'Administrator'

            if (isParticipant || isAdmin) {
                activeConversation = {
                    ...d,
                    employee: d.is_group ? null : (d.user1_id === session.id ? d.user2 : d.user1),
                    isAdminMonitoring: isAdmin && !isParticipant
                } as any
            }
        }
    }

    if (!activeConversation && activeId !== 'new') {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-sm">
                    <p className="font-bold text-gray-900 mb-2">Conversation Non Trouvée</p>
                    <p className="text-sm">Cette conversation n'existe pas ou vous n'y avez pas accès.</p>
                </div>
            </div>
        )
    }

    return (
        <ChatWindow
            conversationId={conversationId}
            currentUser={{
                id: session.id,
                role: (session.role === 'Administrator' ? 'admin' : 'employee') as any,
                full_name: employee.full_name,
                avatar_url: employee.avatar_url
            }}
            recipient={activeConversation?.employee || null}
            isAdminMonitoring={activeConversation?.isAdminMonitoring}
        />
    )
}
