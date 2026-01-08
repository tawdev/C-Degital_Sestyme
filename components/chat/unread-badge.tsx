'use client'

import { useUnreadCount } from '@/hooks/use-unread-count'

interface UnreadBadgeProps {
    initialCount: number
    userId: string
}

/**
 * PURE REALTIME UNREAD BADGE
 * Utilizes the useUnreadCount hook for non-refreshing, state-driven updates.
 * Features ultra-smooth animations and consistent state sync.
 */
export default function UnreadBadge({ initialCount, userId }: UnreadBadgeProps) {
    const { count } = useUnreadCount(initialCount, userId)

    if (count <= 0) return null

    return (
        <span
            className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm ring-2 ring-white md:ring-0 animate-in fade-in zoom-in duration-300"
            aria-label={`${count} unread messages`}
        >
            {count > 99 ? '99+' : count}
        </span>
    )
}
