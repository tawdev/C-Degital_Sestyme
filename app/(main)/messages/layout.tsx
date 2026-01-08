import { getSession } from '@/app/auth/actions'
import { redirect } from 'next/navigation'
import { getConversations, getEmployees } from './actions'
import ChatSidebar from '@/components/chat/chat-sidebar'
import { createClient } from '@/lib/supabase/server'

export default async function MessagesLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await getSession()
    if (!session) redirect('/auth/login')

    const supabase = createClient()
    const { data: employee } = await supabase
        .from('employees')
        .select('role')
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
                    isAdmin={isAdmin}
                // activeId will be handled by searchParams or params in the actual page if needed, 
                // or we can just let sidebar detect it via URL
                />
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col bg-gray-50/30">
                {children}
            </div>
        </div>
    )
}
