'use client'

import { useEffect, useState } from 'react'
import { getRecentActivities, Activity } from '@/app/actions/dashboard-actions'
import { getActivityIcon, formatRelativeTime } from '@/lib/utils/activity-helpers'
import EmployeeAvatar from '@/components/employee-avatar'
import { Activity as ActivityIcon, RefreshCw } from 'lucide-react'

export default function ActivityFeed() {
    const [activities, setActivities] = useState<Activity[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    const fetchActivities = async () => {
        try {
            const data = await getRecentActivities(10)
            setActivities(data)
        } catch (error) {
            console.error('Error fetching activities:', error)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useEffect(() => {
        fetchActivities()

        // Auto-refresh every minute
        const interval = setInterval(fetchActivities, 60000)
        return () => clearInterval(interval)
    }, [])

    const handleRefresh = async () => {
        setRefreshing(true)
        await fetchActivities()
    }

    if (loading) {
        return (
            <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-start gap-4 p-4 animate-pulse">
                        <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    if (activities.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <ActivityIcon className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-sm text-gray-400 font-medium">Aucune activité récente</p>
                <p className="text-xs text-gray-300 mt-1">Les activités apparaîtront ici</p>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between mb-4 px-2">
                <p className="text-xs text-gray-500 font-medium">{activities.length} dernières activités</p>
                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                    title="Actualiser"
                >
                    <RefreshCw className={`h-4 w-4 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {activities.map((activity) => {
                const config = getActivityIcon(activity.action_type as any)
                const Icon = config.icon
                const employeeData = Array.isArray(activity.employee)
                    ? activity.employee[0]
                    : activity.employee

                return (
                    <div
                        key={activity.id}
                        className="group flex items-start gap-4 p-3 rounded-xl hover:bg-gray-50/80 transition-all duration-200 border border-transparent hover:border-gray-100"
                    >
                        <div className="relative flex-shrink-0">
                            <EmployeeAvatar
                                avatarUrl={employeeData?.avatar_url}
                                fullName={employeeData?.full_name || 'System'}
                                className="h-10 w-10 text-xs shadow-sm"
                            />
                            <div className={`absolute -bottom-1 -right-1 ${config.bgColor} p-1.5 rounded-lg shadow-sm border-2 border-white`}>
                                <Icon className={`h-3 w-3 ${config.color}`} />
                            </div>
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">
                                        {employeeData?.full_name || 'Système'}
                                    </p>
                                    <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                                        {activity.description}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-gray-400 font-medium">
                                    {formatRelativeTime(activity.created_at)}
                                </span>
                                {activity.metadata?.project_name && (
                                    <>
                                        <span className="text-xs text-gray-300">•</span>
                                        <span className="text-xs text-gray-500 font-medium truncate">
                                            {activity.metadata.project_name}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
