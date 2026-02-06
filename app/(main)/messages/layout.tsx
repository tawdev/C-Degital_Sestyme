import ChatSidebar from '@/components/chat/chat-sidebar'
import { getConversations, getEmployees } from './actions'
import { getSession } from '@/app/auth/actions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ResponsiveChatLayout from '@/components/chat/responsive-chat-layout'

export default async function MessagesLayout({
    children
}: {
    children: React.ReactNode
}) {
    const session = await getSession()
    if (!session) redirect('/auth/login')

    const supabase = createClient()
    const { data: employee } = await supabase
        .from('employees')
        .select('role, avatar_url')
        .eq('id', session.id)
        .single()

    if (!employee) redirect('/dashboard')

    const isAdmin = employee.role === 'Administrator'
    const [conversations, allEmployees] = await Promise.all([
        getConversations(),
        getEmployees()
    ])

    const contacts = allEmployees.filter(e => e.id !== session.id)

    return (
        <ResponsiveChatLayout
            sidebarHeader={
                <>
                    <h2 className="text-lg font-bold text-gray-900">Messages</h2>
                    <p className="text-xs text-gray-500">
                        {isAdmin ? 'Team Directory & History' : 'Chat with your colleagues'}
                    </p>
                </>
            }
            sidebarProps={{
                conversations,
                contacts,
                isAdmin,
                currentUserId: session.id
            }}
        >
            {children}
        </ResponsiveChatLayout>
    )
}
