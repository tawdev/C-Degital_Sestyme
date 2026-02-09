'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface SafeDateProps {
    date: string | Date | null | undefined
    formatString?: string
    className?: string
}

export function SafeDate({ date, formatString = 'dd/MM/yyyy', className }: SafeDateProps) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted || !date) {
        return null
    }

    try {
        const dateObj = new Date(date)
        return (
            <span className={className}>
                {format(dateObj, formatString, { locale: fr })}
            </span>
        )
    } catch (e) {
        return null
    }
}
