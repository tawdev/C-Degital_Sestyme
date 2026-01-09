'use client'

import { useUnreadCount } from '@/hooks/use-unread-count'

interface UnreadBadgeProps {
    initialCount: number
    userId: string
    conversationId?: string
}

/**
 * Isolated unread badge that manages its own real-time state.
 * Minimizes re-renders of the parent list.
 */
export default function UnreadBadge({ initialCount, userId, conversationId }: UnreadBadgeProps) {
    const { count } = useUnreadCount(initialCount, userId, conversationId)

    if (count === 0) return null

    return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white shadow-sm animate-in zoom-in duration-300">
            {count > 99 ? '99+' : count}
        </span>
    )
}
