import { formatDistanceToNow } from 'date-fns'
import { ar } from 'date-fns/locale'
import {
    Briefcase,
    CheckCircle2,
    UserPlus,
    Edit,
    Trash2,
    Clock,
    AlertCircle,
    FileText,
    Users,
    LucideIcon
} from 'lucide-react'

export type ActivityType =
    | 'created_project'
    | 'updated_project'
    | 'completed_project'
    | 'deleted_project'
    | 'assigned_employee'
    | 'removed_employee'
    | 'created_employee'
    | 'updated_employee'
    | 'completed_task'
    | 'created_task'

export interface ActivityIconConfig {
    icon: LucideIcon
    color: string
    bgColor: string
}

export function getActivityIcon(type: ActivityType): ActivityIconConfig {
    const configs: Record<ActivityType, ActivityIconConfig> = {
        created_project: {
            icon: Briefcase,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50'
        },
        updated_project: {
            icon: Edit,
            color: 'text-amber-600',
            bgColor: 'bg-amber-50'
        },
        completed_project: {
            icon: CheckCircle2,
            color: 'text-emerald-600',
            bgColor: 'bg-emerald-50'
        },
        deleted_project: {
            icon: Trash2,
            color: 'text-red-600',
            bgColor: 'bg-red-50'
        },
        assigned_employee: {
            icon: UserPlus,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50'
        },
        removed_employee: {
            icon: Users,
            color: 'text-orange-600',
            bgColor: 'bg-orange-50'
        },
        created_employee: {
            icon: UserPlus,
            color: 'text-indigo-600',
            bgColor: 'bg-indigo-50'
        },
        updated_employee: {
            icon: Edit,
            color: 'text-teal-600',
            bgColor: 'bg-teal-50'
        },
        completed_task: {
            icon: CheckCircle2,
            color: 'text-green-600',
            bgColor: 'bg-green-50'
        },
        created_task: {
            icon: FileText,
            color: 'text-cyan-600',
            bgColor: 'bg-cyan-50'
        }
    }

    return configs[type] || {
        icon: AlertCircle,
        color: 'text-gray-600',
        bgColor: 'bg-gray-50'
    }
}

export function formatRelativeTime(date: string | Date): string {
    try {
        return formatDistanceToNow(new Date(date), {
            addSuffix: true,
            locale: ar
        })
    } catch (error) {
        return 'منذ وقت قريب'
    }
}

export function getActivityColor(type: ActivityType): string {
    const config = getActivityIcon(type)
    return config.color
}
