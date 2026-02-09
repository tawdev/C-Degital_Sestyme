'use server'

import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/app/auth/actions'

export interface Activity {
    id: string
    user_id: string
    action_type: string
    description: string
    metadata: any
    created_at: string
    employee?: {
        full_name: string
        avatar_url: string | null
    }
}

export interface OnlineTeamMember {
    id: string
    full_name: string
    avatar_url: string | null
    role: string
    is_online: boolean
    last_seen_at: string
}

export interface UpcomingDeadline {
    id: string
    project_name: string
    deadline: string
    status: string
    progress: number
    priority: 'high' | 'medium' | 'low'
    employee?: {
        full_name: string
        avatar_url: string | null
    }
}

export interface ProjectStats {
    status: string
    count: number
    percentage: number
}

export async function getRecentActivities(limit: number = 10): Promise<Activity[]> {
    const supabase = createClient()

    const { data, error } = await supabase
        .from('activities')
        .select('*, employee:employees!activities_user_id_fkey(full_name, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) {
        console.error('Error fetching activities:', error)
        return []
    }

    return data || []
}

export async function getOnlineTeamMembers(): Promise<OnlineTeamMember[]> {
    const supabase = createClient()

    const { data, error } = await supabase
        .from('employees')
        .select('id, full_name, avatar_url, role, is_online, last_seen_at')
        .eq('is_online', true)
        .order('last_seen_at', { ascending: false })

    if (error) {
        console.error('Error fetching online team members:', error)
        return []
    }

    return data || []
}

export async function getUpcomingDeadlines(limit: number = 5): Promise<UpcomingDeadline[]> {
    const supabase = createClient()

    const { data, error } = await supabase
        .from('projects')
        .select('id, project_name, deadline, status, progress, priority, employees(full_name, avatar_url)')
        .not('deadline', 'is', null)
        .in('status', ['pending', 'in_progress'])
        .order('deadline', { ascending: true })
        .limit(limit)

    if (error) {
        console.error('Error fetching upcoming deadlines:', error)
        return []
    }

    return data || []
}

export async function getProjectStats(): Promise<ProjectStats[]> {
    const supabase = createClient()

    // Get total count
    const { count: totalCount } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })

    // Get counts by status
    const { data: statusCounts, error } = await supabase
        .from('projects')
        .select('status')

    if (error || !statusCounts) {
        console.error('Error fetching project stats:', error)
        return []
    }

    // Count by status
    const stats: Record<string, number> = {}
    statusCounts.forEach((project) => {
        stats[project.status] = (stats[project.status] || 0) + 1
    })

    // Convert to array with percentages
    const total = totalCount || 1
    return Object.entries(stats).map(([status, count]) => ({
        status,
        count,
        percentage: Math.round((count / total) * 100)
    }))
}

export async function searchDashboard(query: string) {
    if (!query || query.trim().length < 2) {
        return { projects: [], employees: [] }
    }

    const supabase = createClient()
    const searchTerm = `%${query.trim()}%`

    // Search projects
    const { data: projects } = await supabase
        .from('projects')
        .select('id, project_name, status, progress')
        .ilike('project_name', searchTerm)
        .limit(5)

    // Search employees
    const { data: employees } = await supabase
        .from('employees')
        .select('id, full_name, role, avatar_url')
        .ilike('full_name', searchTerm)
        .limit(5)

    return {
        projects: projects || [],
        employees: employees || []
    }
}

export async function getProjectTrends() {
    const supabase = createClient()

    // Get projects created in the last 30 days grouped by week
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data, error } = await supabase
        .from('projects')
        .select('created_at, status')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true })

    if (error || !data) {
        console.error('Error fetching project trends:', error)
        return []
    }

    return data
}

export async function getEmployeePerformance() {
    const supabase = createClient()

    const { data, error } = await supabase
        .from('employees')
        .select(`
            id,
            full_name,
            projects:projects(count)
        `)
        .limit(10)

    if (error) {
        console.error('Error fetching employee performance:', error)
        return []
    }

    return data || []
}
