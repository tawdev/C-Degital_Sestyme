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
                <div className="space-y-1">
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white transition-colors tracking-tight">Messages</h2>
                    <p className="text-xs font-bold text-gray-400 dark:text-indigo-200/40 uppercase tracking-widest">
                        {isAdmin ? 'Annuaire & Historique' : 'Discutez avec vos collègues'}
                    </p>
                </div>
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
