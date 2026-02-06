'use client'

import React, { useState } from 'react'

interface EmployeeAvatarProps {
    avatarUrl: string | null
    fullName: string
    className?: string
    isOnline?: boolean
}

export default function EmployeeAvatar({ avatarUrl, fullName, className = "h-10 w-10", isOnline }: EmployeeAvatarProps) {
    const [hasError, setHasError] = useState(false)
    const initials = fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()

    const renderAvatar = () => {
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

    return (
        <div className="relative inline-flex flex-shrink-0">
            {renderAvatar()}
            {isOnline && (
                <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white shadow-sm" />
            )}
        </div>
    )
}
