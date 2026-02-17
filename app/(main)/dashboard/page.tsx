import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/app/auth/actions'
import { redirect } from 'next/navigation'
import { getProjectStats } from '@/app/actions/dashboard-actions'
import DashboardClient from '@/components/dashboard/dashboard-client'

export default async function DashboardPage() {
    const session = await getSession()

    if (!session) {
        redirect('/auth/login')
    }

    const supabase = createClient()

    const { data: employee } = await supabase
        .from('employees')
        .select('role')
        .eq('id', session.id)
        .single()

    if (!employee) {
        redirect('/auth/signout')
    }

    if (employee?.role !== 'Administrator') {
        redirect('/projects')
    }

    const [
        { count: projectCount },
        { count: employeeCount },
        { count: prevEmployeeCount },
        { data: activeProjects },
        { data: pendingProjects },
        { data: completedProjectsCountData },
        projectStats,
        { count: callsCount },
        { count: meetingsRecordedCount }
    ] = await Promise.all([
        supabase.from('projects').select('*', { count: 'exact', head: true }),
        supabase.from('employees').select('*', { count: 'exact', head: true }),
        supabase.from('employees').select('*', { count: 'exact', head: true }).lte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('projects').select('id').eq('status', 'in_progress'),
        supabase.from('projects').select('id').eq('status', 'pending'),
        supabase.from('projects').select('id').eq('status', 'completed'),
        getProjectStats(),
        supabase.from('calls').select('*', { count: 'exact', head: true }).not('recording_url', 'is', null),
        supabase.from('meetings').select('*', { count: 'exact', head: true }).not('recording_url', 'is', null)
    ])

    const employeeGrowth = prevEmployeeCount && prevEmployeeCount > 0
        ? Math.round(((employeeCount || 0) - prevEmployeeCount) / prevEmployeeCount * 100)
        : 0

    const dashboardData = {
        projectCount,
        employeeCount,
        prevEmployeeCount,
        activeProjectsCount: activeProjects?.length || 0,
        pendingProjectsCount: pendingProjects?.length || 0,
        completedProjectsCount: completedProjectsCountData?.length || 0,
        projectStats,
        callsCount: (callsCount || 0) + (meetingsRecordedCount || 0),
        employeeGrowth
    }

    return <DashboardClient data={dashboardData} />
}
