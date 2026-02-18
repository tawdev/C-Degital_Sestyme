'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FolderKanban, TrendingUp, User, Save, Eye, EyeOff } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ProfileForm from './profile-form'

interface ProfileTabsProps {
    employee: any
    projects: any[]
}

export default function ProfileTabs({ employee, projects }: ProfileTabsProps) {
    const [activeTab, setActiveTab] = useState<'projects' | 'profile'>('projects')
    const activeProjects = projects?.filter(p => p.status === 'in_progress') || []
    const completedProjects = projects?.filter(p => p.status === 'completed') || []

    return (
        <div className="glass rounded-[2rem] overflow-hidden transition-all duration-500">
            {/* Tabs Navigation */}
            <div className="border-b border-gray-200 dark:border-white/10">
                <nav className="flex -mb-px">
                    <button
                        onClick={() => setActiveTab('projects')}
                        className={`flex-1 py-5 px-6 text-center border-b-2 font-black text-xs uppercase tracking-widest transition-all duration-300 ${activeTab === 'projects'
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                            : 'border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <FolderKanban className="h-4 w-4" />
                            Mes Projets
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`flex-1 py-5 px-6 text-center border-b-2 font-black text-xs uppercase tracking-widest transition-all duration-300 ${activeTab === 'profile'
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                            : 'border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <User className="h-4 w-4" />
                            Modifier Profil
                        </div>
                    </button>
                </nav>
            </div>

            {/* Tab Content */}
            <div className="p-8">
                {activeTab === 'projects' ? (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Project Stats */}
                        <div className="grid grid-cols-3 gap-6">
                            <div className="text-center p-6 bg-gray-50/50 dark:bg-white/5 rounded-3xl border border-gray-100 dark:border-white/5 transition-colors">
                                <p className="text-3xl font-black text-gray-900 dark:text-white">{projects?.length || 0}</p>
                                <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-1">Total</p>
                            </div>
                            <div className="text-center p-6 bg-emerald-50/50 dark:bg-emerald-400/5 rounded-3xl border border-emerald-100 dark:border-emerald-400/10 transition-colors">
                                <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{activeProjects.length}</p>
                                <p className="text-[10px] font-bold text-emerald-600/60 uppercase tracking-widest mt-1">Actifs</p>
                            </div>
                            <div className="text-center p-6 bg-blue-50/50 dark:bg-blue-400/5 rounded-3xl border border-blue-100 dark:border-blue-400/10 transition-colors">
                                <p className="text-3xl font-black text-blue-600 dark:text-blue-400">{completedProjects.length}</p>
                                <p className="text-[10px] font-bold text-blue-600/60 uppercase tracking-widest mt-1">Terminés</p>
                            </div>
                        </div>

                        {/* Projects List */}
                        <div className="space-y-4">
                            {projects && projects.length > 0 ? (
                                projects.slice(0, 5).map((project: any) => (
                                    <Link
                                        key={project.id}
                                        href={`/projects/${project.id}`}
                                        className="block p-5 rounded-3xl border border-gray-100 dark:border-white/5 bg-white/50 dark:bg-white/5 hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:bg-white dark:hover:bg-white/10 transition-all duration-300 group shadow-sm hover:shadow-md"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <h3 className="text-base font-black text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                    {project.project_name}
                                                </h3>
                                                {project.domain_name && (
                                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">{project.domain_name}</p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${project.status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-400/10 dark:text-blue-400' :
                                                    project.status === 'in_progress' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-400' :
                                                        'bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-400'
                                                    }`}>
                                                    {project.status === 'in_progress' ? 'En cours' :
                                                        project.status === 'completed' ? 'Terminé' : 'En attente'}
                                                </span>
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-400">
                                                    <TrendingUp className="h-3.5 w-3.5" />
                                                    {project.progress}%
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-4 w-full bg-gray-100 dark:bg-white/10 rounded-full h-2 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ${project.status === 'completed' ? 'bg-blue-500' :
                                                    project.status === 'in_progress' ? 'bg-emerald-500' :
                                                        'bg-amber-500'
                                                    }`}
                                                style={{ width: `${project.progress}%` }}
                                            ></div>
                                        </div>
                                    </Link>
                                ))
                            ) : (
                                <div className="text-center py-16 bg-gray-50/50 dark:bg-white/5 rounded-[2rem] border border-dashed border-gray-200 dark:border-white/10">
                                    <FolderKanban className="h-16 w-16 mx-auto mb-4 text-gray-300 dark:text-gray-700" />
                                    <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Aucun projet assigné</p>
                                </div>
                            )}
                        </div>

                        {projects && projects.length > 5 && (
                            <div className="text-center pt-4">
                                <Link
                                    href={`/projects?employee_id=${employee.id}`}
                                    className="inline-flex items-center px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-400/10 transition-all"
                                >
                                    Voir tous les projets <TrendingUp className="h-4 w-4 ml-2" />
                                </Link>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <ProfileForm employee={employee} />
                    </div>
                )}
            </div>
        </div>
    )
}
