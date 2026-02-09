'use client'

import { useEffect, useState } from 'react'
import { getUpcomingDeadlines, UpcomingDeadline } from '@/app/actions/dashboard-actions'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Clock, AlertTriangle, Calendar, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import EmployeeAvatar from '@/components/employee-avatar'

export default function UpcomingDeadlines() {
    const [deadlines, setDeadlines] = useState<UpcomingDeadline[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchDeadlines = async () => {
            try {
                const data = await getUpcomingDeadlines(5)
                setDeadlines(data)
            } catch (error) {
                console.error('Error fetching deadlines:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchDeadlines()
    }, [])

    const isOverdue = (deadline: string) => {
        return new Date(deadline) < new Date()
    }

    const isUrgent = (deadline: string) => {
        const daysUntil = Math.ceil((new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        return daysUntil <= 3 && daysUntil >= 0
    }

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high':
                return 'bg-red-100 text-red-700 border-red-200'
            case 'medium':
                return 'bg-amber-100 text-amber-700 border-amber-200'
            case 'low':
                return 'bg-blue-100 text-blue-700 border-blue-200'
            default:
                return 'bg-gray-100 text-gray-700 border-gray-200'
        }
    }

    if (loading) {
        return (
            <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="p-4 border border-gray-100 rounded-xl animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                ))}
            </div>
        )
    }

    if (deadlines.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="h-10 w-10 text-gray-300 mb-2" />
                <p className="text-sm text-gray-400 font-medium">Pas d'échéances à venir</p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {deadlines.map((deadline) => {
                const employeeData = Array.isArray(deadline.employee)
                    ? deadline.employee[0]
                    : deadline.employee
                const overdue = isOverdue(deadline.deadline)
                const urgent = isUrgent(deadline.deadline)

                return (
                    <Link
                        key={deadline.id}
                        href={`/projects/${deadline.id}`}
                        className="block group"
                    >
                        <div className={`p-4 rounded-xl border transition-all duration-200 ${overdue
                            ? 'bg-red-50 border-red-200 hover:border-red-300'
                            : urgent
                                ? 'bg-amber-50 border-amber-200 hover:border-amber-300'
                                : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
                            }`}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        {overdue && (
                                            <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                                        )}
                                        {urgent && !overdue && (
                                            <Clock className="h-4 w-4 text-amber-600 flex-shrink-0 animate-pulse" />
                                        )}
                                        <h4 className="text-sm font-bold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                                            {deadline.project_name}
                                        </h4>
                                    </div>

                                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                        <Calendar className="h-3.5 w-3.5" />
                                        <span className={overdue ? 'text-red-600 font-semibold' : ''}>
                                            {overdue ? 'En retard: ' : ''}
                                            {formatDistanceToNow(new Date(deadline.deadline), {
                                                addSuffix: true,
                                                locale: fr
                                            })}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-500"
                                                    style={{ width: `${deadline.progress}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-bold text-gray-600">
                                                {Math.round(deadline.progress)}%
                                            </span>
                                        </div>

                                        {deadline.priority && (
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getPriorityColor(deadline.priority)}`}>
                                                {deadline.priority === 'high' ? 'Haute' : deadline.priority === 'medium' ? 'Moyenne' : 'Basse'}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {employeeData && (
                                    <EmployeeAvatar
                                        avatarUrl={employeeData.avatar_url}
                                        fullName={employeeData.full_name}
                                        className="h-9 w-9 text-xs shadow-sm flex-shrink-0"
                                    />
                                )}
                            </div>
                        </div>
                    </Link>
                )
            })}
        </div>
    )
}
