'use client'

import { useRealtime } from '@/context/realtime-context'

interface EmployeeStatusProps {
    userId: string
}

export default function EmployeeStatus({ userId }: EmployeeStatusProps) {
    const { isUserOnline } = useRealtime()
    const online = isUserOnline(userId)

    return (
        <div className="flex items-center gap-2">
            <div className={`h-1.5 w-1.5 rounded-full ${
                online 
                    ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse' 
                    : 'bg-gray-300'
            }`} />
            <span className={`text-[10px] font-black uppercase tracking-widest ${
                online ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-600'
            }`}>
                {online ? 'En ligne' : 'Hors ligne'}
            </span>
        </div>
    )
}
