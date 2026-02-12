import { createClient } from '@/lib/supabase/server'
import { Users, Briefcase, Activity, CheckCircle2, TrendingUp, ArrowUpRight, Plus, Calendar, Video } from 'lucide-react'
import Link from 'next/link'
import { getSession } from '@/app/auth/actions'
import { redirect } from 'next/navigation'
import { getProjectStats } from '@/app/actions/dashboard-actions'
import ProjectCharts from '@/components/dashboard/project-charts'
import ActivityFeed from '@/components/dashboard/activity-feed'
import OnlineTeam from '@/components/dashboard/online-team'
import UpcomingDeadlines from '@/components/dashboard/upcoming-deadlines'
import DashboardSearch from '@/components/dashboard/dashboard-search'

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
        { count: callsCount }
    ] = await Promise.all([
        supabase.from('projects').select('*', { count: 'exact', head: true }),
        supabase.from('employees').select('*', { count: 'exact', head: true }),
        // Get employee count from 30 days ago for percentage calculation
        supabase.from('employees').select('*', { count: 'exact', head: true }).lte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('projects').select('id').eq('status', 'in_progress'),
        supabase.from('projects').select('id').eq('status', 'pending'),
        supabase.from('projects').select('id').eq('status', 'completed'),
        getProjectStats(),
        supabase.from('calls').select('*', { count: 'exact', head: true })
    ])

    // Calculate real percentage changes
    const employeeGrowth = prevEmployeeCount && prevEmployeeCount > 0
        ? Math.round(((employeeCount || 0) - prevEmployeeCount) / prevEmployeeCount * 100)
        : 0

    const stats = [
        {
            name: 'Total des employés',
            value: employeeCount || 0,
            icon: Users,
            color: 'from-blue-500 to-indigo-600',
            bgColor: 'bg-blue-50',
            iconColor: 'text-blue-600',
            link: '/employees',
            description: 'Membres de l\'équipe',
            change: employeeGrowth
        },
        {
            name: 'Total des projets',
            value: projectCount || 0,
            icon: Briefcase,
            color: 'from-purple-500 to-pink-600',
            bgColor: 'bg-purple-50',
            iconColor: 'text-purple-600',
            link: '/projects',
            description: 'Tout temps',
            change: 0
        },
        {
            name: 'Projets actifs',
            value: activeProjects?.length || 0,
            icon: Activity,
            color: 'from-emerald-500 to-teal-600',
            bgColor: 'bg-emerald-50',
            iconColor: 'text-emerald-600',
            link: '/projects',
            description: 'En cours d\'exécution',
            change: projectCount ? Math.round((activeProjects?.length || 0) / projectCount * 100) : 0
        },
        {
            name: 'Terminés',
            value: completedProjectsCountData?.length || 0,
            icon: CheckCircle2,
            color: 'from-orange-500 to-red-600',
            bgColor: 'bg-orange-50',
            iconColor: 'text-orange-600',
            link: '/projects',
            description: 'Livrés avec succès',
            change: projectCount ? Math.round((completedProjectsCountData?.length || 0) / projectCount * 100) : 0
        },
        {
            name: 'Appels enregistrés',
            value: callsCount || 0,
            icon: Video,
            color: 'from-purple-600 to-indigo-700',
            bgColor: 'bg-purple-50',
            iconColor: 'text-purple-600',
            link: '/calls',
            description: 'Historique des appels',
            change: 0
        }
    ]

    return (
        <div className="max-w-[1600px] mx-auto space-y-10 pb-12">
            {/* Header with Welcome Message */}
            <div className="relative overflow-hidden bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1">
                        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Aperçu du tableau de bord</h1>
                        <p className="mt-2 text-lg text-gray-500 font-medium">Bon retour ! Voici un aperçu de vos opérations actuelles.</p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <OnlineTeam />
                        <DashboardSearch />
                        <Link
                            href="/projects/new"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 border border-transparent rounded-xl text-base font-semibold text-white hover:bg-gray-800 transition-all duration-200 shadow-lg shadow-gray-200"
                        >
                            <Plus className="h-5 w-5" />
                            Lancer un projet
                        </Link>
                    </div>
                </div>
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 -u mt-[-10%] mr-[-5%] w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat) => {
                    const Icon = stat.icon
                    return (
                        <Link
                            key={stat.name}
                            href={stat.link}
                            className="group relative bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-xl hover:border-transparent transition-all duration-300"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">{stat.name}</p>
                                    <div className="mt-2 flex items-baseline gap-2">
                                        <p className="text-4xl font-black text-gray-900">{stat.value}</p>
                                        {stat.change !== 0 && (
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stat.change > 0
                                                ? 'text-emerald-600 bg-emerald-50'
                                                : 'text-red-600 bg-red-50'
                                                }`}>
                                                {stat.change > 0 ? '+' : ''}{stat.change}%
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-1 text-sm text-gray-500">{stat.description}</p>
                                </div>
                                <div className={`${stat.bgColor} p-4 rounded-2xl group-hover:scale-110 transition-transform duration-300`}>
                                    <Icon className={`h-7 w-7 ${stat.iconColor}`} />
                                </div>
                            </div>
                            <div className={`absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r ${stat.color} rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <ArrowUpRight className="h-4 w-4 text-gray-300" />
                            </div>
                        </Link>
                    )
                })}
            </div>

            {/* Main Content Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-gray-900">
                {/* Project Analytics (2/3 width) */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Interactive Charts */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Analyses de projet</h2>
                                <p className="text-sm text-gray-500 mt-1">Répartition visuelle de la distribution des projets</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 bg-gray-50 px-3 py-1.5 rounded-lg">
                                <TrendingUp className="h-4 w-4" />
                                DONNÉES EN DIRECT
                            </div>
                        </div>
                        <ProjectCharts statusData={projectStats} />
                    </div>

                    {/* Status Distribution Bars */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Performance des projets</h2>
                                <p className="text-sm text-gray-500 mt-1">Répartition de l'état en temps réel</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 bg-gray-50 px-3 py-1.5 rounded-lg">
                                <TrendingUp className="h-4 w-4" />
                                MISES À JOUR EN DIRECT
                            </div>
                        </div>

                        <div className="space-y-8">
                            {/* In Progress */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full border-4 border-emerald-100 bg-emerald-500"></div>
                                        <span className="text-base font-bold text-gray-700">En cours</span>
                                    </div>
                                    <span className="text-lg font-black text-gray-900">{activeProjects?.length || 0}</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                        style={{ width: `${projectCount ? (activeProjects?.length || 0) / projectCount * 100 : 0}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Pending */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full border-4 border-amber-100 bg-amber-500"></div>
                                        <span className="text-base font-bold text-gray-700">En attente et planification</span>
                                    </div>
                                    <span className="text-lg font-black text-gray-900">{pendingProjects?.length || 0}</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-amber-400 to-amber-600 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                                        style={{ width: `${projectCount ? (pendingProjects?.length || 0) / projectCount * 100 : 0}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Completed */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full border-4 border-indigo-100 bg-indigo-500"></div>
                                        <span className="text-base font-bold text-gray-700">Actifs terminés</span>
                                    </div>
                                    <span className="text-lg font-black text-gray-900">{completedProjectsCountData?.length || 0}</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-indigo-400 to-indigo-600 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(99,102,241,0.3)]"
                                        style={{ width: `${projectCount ? (completedProjectsCountData?.length || 0) / projectCount * 100 : 0}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Shortcuts */}
                    <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-3xl shadow-xl p-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-white/20 transition-all duration-500"></div>
                        <div className="relative z-10">
                            <h2 className="text-2xl font-black text-white mb-2">Boîte à outils de gestion</h2>
                            <p className="text-indigo-100 mb-8 font-medium">Exécutez des actions prioritaires sur votre espace de travail.</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Link href="/employees/new" className="bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 rounded-2xl p-5 transition-all duration-300 hover:scale-[1.03]">
                                    <div className="bg-white/20 w-10 h-10 rounded-xl flex items-center justify-center mb-4">
                                        <Users className="h-5 w-5 text-white" />
                                    </div>
                                    <h3 className="font-bold text-white text-lg">Recruter des talents</h3>
                                    <p className="text-xs text-indigo-100/70 mt-1">Créer de nouveaux profils d'employés</p>
                                </Link>
                                <Link href="/projects/new" className="bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 rounded-2xl p-5 transition-all duration-300 hover:scale-[1.03]">
                                    <div className="bg-white/20 w-10 h-10 rounded-xl flex items-center justify-center mb-4">
                                        <Briefcase className="h-5 w-5 text-white" />
                                    </div>
                                    <h3 className="font-bold text-white text-lg">Nouveau pipeline</h3>
                                    <p className="text-xs text-indigo-100/70 mt-1">Initialiser la structure du projet</p>
                                </Link>
                                <Link href="/projects" className="bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 rounded-2xl p-5 transition-all duration-300 hover:scale-[1.03]">
                                    <div className="bg-white/20 w-10 h-10 rounded-xl flex items-center justify-center mb-4">
                                        <CheckCircle2 className="h-5 w-5 text-white" />
                                    </div>
                                    <h3 className="font-bold text-white text-lg">Audit global</h3>
                                    <p className="text-xs text-indigo-100/70 mt-1">Passer en revue toutes les opérations actives</p>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Column (1/3 width) */}
                <div className="space-y-6">
                    {/* Activity Feed */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                        <div className="p-8 border-b border-gray-50">
                            <h2 className="text-xl font-bold text-gray-900">Activité récente</h2>
                            <p className="text-sm text-gray-500">Dernières mises à jour de l'espace de travail</p>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto max-h-96">
                            <ActivityFeed />
                        </div>
                    </div>

                    {/* Upcoming Deadlines */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                        <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Échéances à venir</h2>
                                <p className="text-sm text-gray-500">Projets bientôt dus</p>
                            </div>
                            <Calendar className="h-5 w-5 text-gray-400" />
                        </div>
                        <div className="p-4 flex-1">
                            <UpcomingDeadlines />
                        </div>
                        <div className="p-6 mt-auto">
                            <Link
                                href="/projects"
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-100 transition-colors"
                            >
                                Voir tous les projets
                                <ArrowUpRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
