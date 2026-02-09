'use client'

import { useEffect, useState } from 'react'
import { getOnlineTeamMembers, OnlineTeamMember } from '@/app/actions/dashboard-actions'
import EmployeeAvatar from '@/components/employee-avatar'
import { Users, Circle } from 'lucide-react'

export default function OnlineTeam() {
    const [members, setMembers] = useState<OnlineTeamMember[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const data = await getOnlineTeamMembers()
                setMembers(data)
            } catch (error) {
                console.error('Error fetching online team:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchMembers()

        // Refresh every 30 seconds
        const interval = setInterval(fetchMembers, 30000)
        return () => clearInterval(interval)
    }, [])

    if (loading) {
        return (
            <div className="flex items-center gap-3 animate-pulse">
                <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                <div className="h-4 bg-gray-200 rounded w-32"></div>
            </div>
        )
    }

    if (members.length === 0) {
        return (
            <div className="flex items-center gap-3 text-gray-400">
                <Users className="h-5 w-5" />
                <span className="text-sm font-medium">Aucun membre en ligne</span>
            </div>
        )
    }

    return (
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <div className="relative">
                    <Users className="h-5 w-5 text-emerald-600" />
                    <Circle className="absolute -top-1 -right-1 h-2.5 w-2.5 text-emerald-500 fill-emerald-500 animate-pulse" />
                </div>
                <span className="text-sm font-bold text-gray-900">
                    {members.length} en ligne
                </span>
            </div>

            <div className="flex items-center -space-x-2">
                {members.slice(0, 5).map((member) => (
                    <div
                        key={member.id}
                        className="relative group"
                        title={member.full_name}
                    >
                        <EmployeeAvatar
                            avatarUrl={member.avatar_url}
                            fullName={member.full_name}
                            className="h-8 w-8 text-xs border-2 border-white shadow-sm ring-2 ring-emerald-100 transition-transform group-hover:scale-110"
                        />
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></div>
                    </div>
                ))}
                {members.length > 5 && (
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-100 border-2 border-white text-xs font-bold text-gray-600">
                        +{members.length - 5}
                    </div>
                )}
            </div>
        </div>
    )
}
