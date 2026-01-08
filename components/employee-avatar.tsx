'use client'

import React, { useState } from 'react'

interface EmployeeAvatarProps {
    avatarUrl: string | null
    fullName: string
    className?: string
}

export default function EmployeeAvatar({ avatarUrl, fullName, className = "h-10 w-10" }: EmployeeAvatarProps) {
    const [hasError, setHasError] = useState(false)
    const initials = fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()

    if (!avatarUrl || hasError) {
        return (
            <div className={`${className} bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}>
                {initials}
            </div>
        )
    }

    return (
        <img
            src={avatarUrl}
            alt={fullName}
            className={`${className} rounded-full object-cover ring-2 ring-indigo-50 flex-shrink-0`}
            onError={() => setHasError(true)}
        />
    )
}
