'use client'

import { useEffect, useState } from 'react'

interface SafeLastSeenProps {
    date: string | null
}

export function SafeLastSeen({ date }: SafeLastSeenProps) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted || !date) {
        return null
    }

    const formatLastSeen = (dateString: string) => {
        const now = new Date()
        const lastSeen = new Date(dateString)
        const diffInSeconds = Math.floor((now.getTime() - lastSeen.getTime()) / 1000)

        if (diffInSeconds < 60) return 'just now'
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
        return lastSeen.toLocaleDateString()
    }

    return (
        <span>
            {formatLastSeen(date)}
        </span>
    )
}
