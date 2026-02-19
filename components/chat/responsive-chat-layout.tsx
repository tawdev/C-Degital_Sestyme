'use client'

import React from 'react'
import { useParams, usePathname } from 'next/navigation'
import ChatSidebar from '@/components/chat/chat-sidebar'

interface ResponsiveChatLayoutProps {
    sidebarHeader: React.ReactNode
    sidebarProps: {
        conversations: any[]
        contacts: any[]
        isAdmin: boolean
        currentUserId: string
    }
    children: React.ReactNode
}

export default function ResponsiveChatLayout({
    sidebarHeader,
    sidebarProps,
    children
}: ResponsiveChatLayoutProps) {
    const params = useParams()
    const pathname = usePathname()

    // Check if we are in a specific conversation or the "new" chat flow
    // On mobile, if we have an ID or are in /messages/new, we hide the sidebar
    const isChatActive = params?.id || pathname?.includes('/messages/new')

    return (
        <div className="h-[calc(100vh-10rem)] w-full max-w-7xl mx-auto flex bg-white/70 dark:bg-white/5 backdrop-blur-2xl rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-2xl shadow-indigo-900/5 overflow-hidden transition-colors duration-500">
            {/* Sidebar - hidden on mobile when chat is active */}
            <div className={`
                ${isChatActive ? 'hidden md:flex' : 'flex'} 
                w-full md:w-[400px] border-r border-gray-100 dark:border-white/5 flex-shrink-0 flex flex-col h-full overflow-hidden transition-all
            `}>
                <div className="p-8 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
                    {sidebarHeader}
                </div>
                <div className="flex-1 overflow-hidden flex flex-col">
                    <ChatSidebar {...sidebarProps} />
                </div>
            </div>

            {/* Main Chat Area - hidden on mobile when chat is NOT active */}
            <div className={`
                ${isChatActive ? 'flex' : 'hidden md:flex'} 
                flex-1 flex flex-col bg-transparent overflow-hidden h-full relative
            `}>
                {children}
            </div>
        </div>
    )
}
