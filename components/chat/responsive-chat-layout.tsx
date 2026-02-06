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
        <div className="h-[calc(100vh-10rem)] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex">
            {/* Sidebar - hidden on mobile when chat is active */}
            <div className={`
                ${isChatActive ? 'hidden md:flex' : 'flex'} 
                w-full md:w-80 border-r border-gray-200 flex-shrink-0 flex flex-col h-full overflow-hidden
            `}>
                <div className="p-4 border-b border-gray-200 bg-gray-50/50">
                    {sidebarHeader}
                </div>
                <ChatSidebar {...sidebarProps} />
            </div>

            {/* Main Chat Area - hidden on mobile when chat is NOT active */}
            <div className={`
                ${isChatActive ? 'flex' : 'hidden md:flex'} 
                flex-1 flex flex-col bg-gray-50/30 overflow-hidden h-full
            `}>
                {children}
            </div>
        </div>
    )
}
