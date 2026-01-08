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

    const supabase = createClient()
    const { data: employee } = await supabase
        .from('employees')
        .select('role, full_name, avatar_url')
        .eq('id', session.id)
        .single()

    if (!employee) redirect('/dashboard')

    const activeId = params.id
    let initializationError = false
    let conversationId = activeId

    // 1. Handle "new" conversation (Admin/Employee clicking someone they haven't chatted with)
    if (activeId === 'new') {
        const employeeId = typeof searchParams?.employee_id === 'string' ? searchParams.employee_id : undefined
        if (employeeId) {
            const { startConversation } = await import('../actions')
            const resolvedId = await startConversation(employeeId)
            if (resolvedId) {
                redirect(`/messages/${resolvedId}`)
            } else {
                initializationError = true
            }
        } else {
            redirect('/messages')
        }
    }

    const conversations = await getConversations()
    const activeConversation = conversations.find(c => c.id === conversationId)

    if (initializationError || (!activeConversation && activeId !== 'new')) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-red-500">
                <p>Failed to initialize chat. Please try again.</p>
            </div>
        )
    }

    return (
        <ChatWindow
            conversationId={conversationId}
            currentUser={{
                id: session.id,
                role: (session.role === 'Administrator' ? 'admin' : 'employee') as any,
                full_name: session.full_name,
                avatar_url: employee.avatar_url
            }}
            recipient={activeConversation?.employee || null}
        />
    )
}
