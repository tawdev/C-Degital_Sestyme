'use client'

import { Users, Briefcase, Activity, CheckCircle2, TrendingUp, ArrowUpRight, Plus, Calendar, Video, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import ProjectCharts from '@/components/dashboard/project-charts'
import ActivityFeed from '@/components/dashboard/activity-feed'
import OnlineTeam from '@/components/dashboard/online-team'
import UpcomingDeadlines from '@/components/dashboard/upcoming-deadlines'
import DashboardSearch from '@/components/dashboard/dashboard-search'

interface DashboardClientProps {
    data: {
        projectCount: number | null
        employeeCount: number | null
        activeProjectsCount: number
        pendingProjectsCount: number
        completedProjectsCount: number
        projectStats: any
        callsCount: number
        employeeGrowth: number
    }
}

export default function DashboardClient({ data }: DashboardClientProps) {
    const stats = [
        {
            name: 'Employés actifs',
            value: data.employeeCount || 0,
            icon: Users,
            color: 'from-blue-500 to-indigo-600',
            iconColor: 'text-blue-500 dark:text-blue-400',
            link: '/employees',
            description: 'Membres de l\'équipe',
            change: data.employeeGrowth
        },
        {
            name: 'Total Projets',
            value: data.projectCount || 0,
            icon: Briefcase,
            color: 'from-purple-500 to-pink-600',
            iconColor: 'text-purple-500 dark:text-purple-400',
            link: '/projects',
            description: 'Tout temps',
            change: 0
        },
        {
            name: 'En Cours',
            value: data.activeProjectsCount,
            icon: Activity,
            color: 'from-emerald-500 to-teal-600',
            iconColor: 'text-emerald-500 dark:text-emerald-400',
            link: '/projects',
            description: 'Opérations actives',
            change: data.projectCount ? Math.round(data.activeProjectsCount / (data.projectCount as number) * 100) : 0
        },
        {
            name: 'Vidéos & Appels',
            value: data.callsCount,
            icon: Video,
            color: 'from-orange-500 to-red-600',
            iconColor: 'text-orange-500 dark:text-orange-400',
            link: '/calls',
            description: 'Sessions enregistrées',
            change: 0
        }
    ]

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    }

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1
        }
    }

    return (
        <div className="min-h-screen bg-transparent relative overflow-hidden transition-colors duration-500">
            {/* Animated Background Or Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px] rounded-full animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/5 dark:bg-purple-600/10 blur-[120px] rounded-full animate-pulse" />

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="w-full mx-auto space-y-10 relative z-10"
            >
                {/* Header */}
                <motion.div
                    variants={itemVariants}
                    className="relative overflow-hidden bg-white/70 dark:bg-white/5 backdrop-blur-2xl rounded-[2.5rem] border border-gray-200 dark:border-white/10 p-8 md:p-10 shadow-2xl"
                >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
                    <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                        <div>
                            <h1 className="text-4xl lg:text-5xl font-black text-gray-900 dark:text-white tracking-tight mb-3">
                                Tableau de bord
                            </h1>
                            <p className="text-gray-500 dark:text-indigo-200/60 text-lg font-medium">
                                Bienvenue sur votre centre de commandement d'entreprise.
                            </p>
                        </div>
                        <div className="flex items-center gap-4 flex-wrap">
                            <OnlineTeam />
                            <DashboardSearch />
                            <Link
                                href="/projects/new"
                                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-indigo-900/40 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <Plus className="h-5 w-5" />
                                Nouveau Projet
                            </Link>
                        </div>
                    </div>
                </motion.div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {stats.map((stat, idx) => {
                        const Icon = stat.icon
                        return (
                            <motion.div key={stat.name} variants={itemVariants}>
                                <Link
                                    href={stat.link}
                                    className="group relative bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-[2rem] border border-gray-200 dark:border-white/10 p-8 hover:bg-white/90 dark:hover:bg-white/10 transition-all duration-300 block overflow-hidden shadow-sm hover:shadow-xl group"
                                >
                                    <div className="flex items-start justify-between relative z-10">
                                        <div>
                                            <p className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.2em] mb-3">{stat.name}</p>
                                            <div className="flex items-baseline gap-3">
                                                <p className="text-5xl font-black text-gray-900 dark:text-white transition-colors">{stat.value}</p>
                                                {stat.change !== 0 && (
                                                    <span className={`text-[10px] font-black px-2 py-1 rounded-full ${stat.change > 0
                                                        ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10'
                                                        : 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-400/10'
                                                        }`}>
                                                        {stat.change > 0 ? '+' : ''}{stat.change}%
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{stat.description}</p>
                                        </div>
                                        <div className={`p-4 rounded-2xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 group-hover:scale-110 transition-all duration-500 group-hover:border-indigo-500/20 dark:group-hover:border-white/20`}>
                                            <Icon className={`h-8 w-8 ${stat.iconColor}`} />
                                        </div>
                                    </div>
                                    <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.color} opacity-10 dark:opacity-30 group-hover:opacity-100 transition-opacity duration-500`} />
                                </Link>
                            </motion.div>
                        )
                    })}
                </div>

                {/* Main Content Sections */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column (2/3) */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Charts Card */}
                        <motion.div
                            variants={itemVariants}
                            className="bg-white/70 dark:bg-white/5 backdrop-blur-2xl rounded-[2.5rem] border border-gray-200 dark:border-white/10 p-10 overflow-hidden relative shadow-sm"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-10 dark:opacity-30" />
                            <div className="flex items-center justify-between mb-10">
                                <div>
                                    <h2 className="text-2xl font-black text-gray-900 dark:text-white transition-colors">Analytiques opérationnelles</h2>
                                    <p className="text-gray-400 dark:text-gray-500 text-sm font-bold uppercase tracking-widest mt-1">Données en temps réel</p>
                                </div>
                                <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/10 dark:border-indigo-500/20 rounded-xl">
                                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-ping" />
                                    <span className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">Live Sync</span>
                                </div>
                            </div>
                            <ProjectCharts statusData={data.projectStats} />
                        </motion.div>

                        {/* Performance Card */}
                        <motion.div
                            variants={itemVariants}
                            className="bg-white/70 dark:bg-white/5 backdrop-blur-2xl rounded-[2.5rem] border border-gray-200 dark:border-white/10 p-10 shadow-sm"
                        >
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white transition-colors mb-10">Performance du Pipeline</h2>
                            <div className="space-y-8">
                                <ProgressBar
                                    label="Projets en cours"
                                    value={data.activeProjectsCount}
                                    total={data.projectCount || 1}
                                    color="from-emerald-400 to-teal-500"
                                    bgColor="bg-emerald-500/5 dark:bg-emerald-400/10"
                                    textColor="text-gray-900 dark:text-white"
                                />
                                <ProgressBar
                                    label="En planification"
                                    value={data.pendingProjectsCount}
                                    total={data.projectCount || 1}
                                    color="from-amber-400 to-orange-500"
                                    bgColor="bg-amber-500/5 dark:bg-amber-400/10"
                                    textColor="text-gray-900 dark:text-white"
                                />
                                <ProgressBar
                                    label="Opérations terminées"
                                    value={data.completedProjectsCount}
                                    total={data.projectCount || 1}
                                    color="from-indigo-400 to-violet-500"
                                    bgColor="bg-indigo-500/5 dark:bg-indigo-400/10"
                                    textColor="text-gray-900 dark:text-white"
                                />
                            </div>
                        </motion.div>
                    </div>

                    {/* Right Column (1/3) */}
                    <div className="space-y-8">
                        {/* Feed Card */}
                        <motion.div
                            variants={itemVariants}
                            className="bg-white/70 dark:bg-white/5 backdrop-blur-2xl rounded-[2.5rem] border border-gray-200 dark:border-white/10 p-0 overflow-hidden flex flex-col h-full min-h-[500px] shadow-sm"
                        >
                            <div className="p-10 pb-6">
                                <h2 className="text-2xl font-black text-gray-900 dark:text-white transition-colors">Activité</h2>
                                <p className="text-gray-400 dark:text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] mt-2">Dernières mises à jour</p>
                            </div>
                            <div className="px-6 flex-1 overflow-y-auto custom-scrollbar pb-10">
                                <ActivityFeed />
                            </div>
                        </motion.div>

                        {/* Terminated Deadlines */}
                        <motion.div
                            variants={itemVariants}
                            className="bg-white/70 dark:bg-white/5 backdrop-blur-2xl rounded-[2.5rem] border border-gray-200 dark:border-white/10 p-0 overflow-hidden shadow-sm"
                        >
                            <div className="p-10 pb-6 flex items-center justify-between">
                                <h2 className="text-2xl font-black text-gray-900 dark:text-white transition-colors">Échéances</h2>
                                <Calendar className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div className="px-6 pb-6">
                                <UpcomingDeadlines />
                            </div>
                            <div className="p-8 mt-auto bg-gray-50/50 dark:bg-white/5 border-t border-gray-100 dark:border-white/10">
                                <Link
                                    href="/projects"
                                    className="w-full flex items-center justify-center gap-3 py-4 bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 hover:border-indigo-500/20 dark:hover:border-white/20 rounded-2xl text-xs font-black text-gray-700 dark:text-white uppercase tracking-[0.2em] transition-all shadow-sm"
                                >
                                    Explorer tous les projets
                                    <ArrowUpRight className="h-4 w-4" />
                                </Link>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </motion.div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(0, 0, 0, 0.05);
                    border-radius: 10px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(0, 0, 0, 0.1);
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
            `}</style>
        </div>
    )
}

function ProgressBar({ label, value, total, color, bgColor, textColor }: any) {
    const percentage = Math.round((value / total) * 100)
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className={`text-sm font-black uppercase tracking-widest ${textColor}`}>{label}</span>
                <span className={`text-lg font-black ${textColor}`}>{value}</span>
            </div>
            <div className={`w-full ${bgColor} rounded-full h-2.5 overflow-hidden`}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`bg-gradient-to-r ${color} h-full rounded-full shadow-[0_0_15px_rgba(255,255,255,0.05)]`}
                />
            </div>
        </div>
    )
}
