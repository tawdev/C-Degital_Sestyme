import { createClient } from '@/lib/supabase/server'
import { Users, Briefcase, Clock, CheckCircle2, TrendingUp, Activity } from 'lucide-react'
import Link from 'next/link'
import { getSession } from '@/app/auth/actions'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
    // Check if user is admin
    const session = await getSession()

    if (!session) {
        redirect('/auth/login')
    }

    const supabase = createClient()

    // Get user role
    const { data: employee } = await supabase
        .from('employees')
        .select('role')
        .eq('id', session.id)
        .single()

    // Redirect non-admin users to projects page
    if (employee?.role !== 'Administrator') {
        redirect('/projects')
    }

    // Parallel fetching
    const [
        { count: projectCount },
        { count: employeeCount },
        { data: activeProjects },
        { data: pendingProjects },
        { data: completedProjects },
        { data: recentProjects }
    ] = await Promise.all([
        supabase.from('projects').select('*', { count: 'exact', head: true }),
        supabase.from('employees').select('*', { count: 'exact', head: true }),
        supabase.from('projects').select('id').eq('status', 'in_progress'),
        supabase.from('projects').select('id').eq('status', 'pending'),
        supabase.from('projects').select('id').eq('status', 'completed'),
        supabase.from('projects').select('id, project_name, status, progress, created_at, employees(full_name)').order('created_at', { ascending: false }).limit(5)
    ])

    const stats = [
        {
            name: 'Total Employees',
            value: employeeCount || 0,
            icon: Users,
            color: 'from-blue-500 to-blue-600',
            bgColor: 'bg-blue-50',
            iconColor: 'text-blue-600',
            link: '/employees'
        },
        {
            name: 'Total Projects',
            value: projectCount || 0,
            icon: Briefcase,
            color: 'from-purple-500 to-purple-600',
            bgColor: 'bg-purple-50',
            iconColor: 'text-purple-600',
            link: '/projects'
        },
        {
            name: 'Active Projects',
            value: activeProjects?.length || 0,
            icon: Activity,
            color: 'from-emerald-500 to-emerald-600',
            bgColor: 'bg-emerald-50',
            iconColor: 'text-emerald-600',
            link: '/projects'
        },
        {
            name: 'Pending Projects',
            value: pendingProjects?.length || 0,
            icon: Clock,
            color: 'from-amber-500 to-amber-600',
            bgColor: 'bg-amber-50',
            iconColor: 'text-amber-600',
            link: '/projects'
        }
    ]

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
                <p className="mt-2 text-gray-600">Welcome back! Here's what's happening with your projects.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat) => {
                    const Icon = stat.icon
                    return (
                        <Link
                            key={stat.name}
                            href={stat.link}
                            className="group relative overflow-hidden bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                                    <p className="mt-2 text-3xl font-bold text-gray-900">{stat.value}</p>
                                </div>
                                <div className={`${stat.bgColor} p-3 rounded-lg`}>
                                    <Icon className={`h-6 w-6 ${stat.iconColor}`} />
                                </div>
                            </div>
                            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.color} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200`}></div>
                        </Link>
                    )
                })}
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Project Status Distribution */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Project Status</h2>
                        <TrendingUp className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                <span className="text-sm font-medium text-gray-700">In Progress</span>
                            </div>
                            <span className="text-sm font-bold text-gray-900">{activeProjects?.length || 0}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${projectCount ? (activeProjects?.length || 0) / projectCount * 100 : 0}%` }}
                            ></div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                                <span className="text-sm font-medium text-gray-700">Pending</span>
                            </div>
                            <span className="text-sm font-bold text-gray-900">{pendingProjects?.length || 0}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-gradient-to-r from-amber-500 to-amber-600 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${projectCount ? (pendingProjects?.length || 0) / projectCount * 100 : 0}%` }}
                            ></div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                <span className="text-sm font-medium text-gray-700">Completed</span>
                            </div>
                            <span className="text-sm font-bold text-gray-900">{completedProjects?.length || 0}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${projectCount ? (completedProjects?.length || 0) / projectCount * 100 : 0}%` }}
                            ></div>
                        </div>
                    </div>
                </div>

                {/* Recent Projects */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Recent Projects</h2>
                        <Link href="/projects" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                            View all →
                        </Link>
                    </div>
                    <div className="space-y-4">
                        {recentProjects && recentProjects.length > 0 ? (
                            recentProjects.map((project: any) => (
                                <div key={project.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">{project.project_name}</p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {Array.isArray(project.employees)
                                                ? project.employees[0]?.full_name
                                                : project.employees?.full_name || 'Unassigned'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${project.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                                                project.status === 'in_progress' ? 'bg-emerald-100 text-emerald-800' :
                                                    'bg-amber-100 text-amber-800'
                                                }`}>
                                                {project.status === 'in_progress' ? 'In Progress' :
                                                    project.status === 'completed' ? 'Completed' : 'Pending'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                <Briefcase className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                                <p className="text-sm">No projects yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg p-8 text-white">
                <h2 className="text-2xl font-bold mb-2">Quick Actions</h2>
                <p className="text-indigo-100 mb-6">Get started with common tasks</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Link
                        href="/employees/new"
                        className="bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-lg p-4 transition-all duration-200 hover:scale-105"
                    >
                        <Users className="h-8 w-8 mb-2" />
                        <h3 className="font-semibold">Add Employee</h3>
                        <p className="text-sm text-indigo-100 mt-1">Create a new employee profile</p>
                    </Link>
                    <Link
                        href="/projects/new"
                        className="bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-lg p-4 transition-all duration-200 hover:scale-105"
                    >
                        <Briefcase className="h-8 w-8 mb-2" />
                        <h3 className="font-semibold">New Project</h3>
                        <p className="text-sm text-indigo-100 mt-1">Start a new project</p>
                    </Link>
                    <Link
                        href="/projects"
                        className="bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-lg p-4 transition-all duration-200 hover:scale-105"
                    >
                        <CheckCircle2 className="h-8 w-8 mb-2" />
                        <h3 className="font-semibold">View Projects</h3>
                        <p className="text-sm text-indigo-100 mt-1">Manage all projects</p>
                    </Link>
                </div>
            </div>
        </div>
    )
}
