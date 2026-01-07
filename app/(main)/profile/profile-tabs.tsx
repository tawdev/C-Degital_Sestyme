'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FolderKanban, TrendingUp, User, Save, Eye, EyeOff } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface ProfileTabsProps {
    employee: any
    projects: any[]
}

export default function ProfileTabs({ employee, projects }: ProfileTabsProps) {
    const [activeTab, setActiveTab] = useState<'projects' | 'profile'>('projects')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const router = useRouter()

    const activeProjects = projects?.filter(p => p.status === 'in_progress') || []
    const completedProjects = projects?.filter(p => p.status === 'completed') || []

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(false)

        const formData = new FormData(e.currentTarget)
        const password = formData.get('password') as string

        const data: any = {
            full_name: formData.get('full_name') as string,
            email: formData.get('email') as string,
            phone: formData.get('phone') as string,
        }

        if (password && password.trim() !== '') {
            data.password = password
        }

        const supabase = createClient()
        const { error: updateError } = await supabase
            .from('employees')
            .update(data)
            .eq('id', employee.id)

        if (updateError) {
            setError(updateError.message)
            setLoading(false)
            return
        }

        setSuccess(true)
        setLoading(false)

        setTimeout(() => {
            router.refresh()
            setSuccess(false)
        }, 2000)
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Tabs Navigation */}
            <div className="border-b border-gray-200">
                <nav className="flex -mb-px">
                    <button
                        onClick={() => setActiveTab('projects')}
                        className={`flex-1 py-4 px-6 text-center border-b-2 font-medium text-sm transition-colors ${activeTab === 'projects'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <FolderKanban className="h-5 w-5" />
                            My Projects
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`flex-1 py-4 px-6 text-center border-b-2 font-medium text-sm transition-colors ${activeTab === 'profile'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <User className="h-5 w-5" />
                            Edit Profile
                        </div>
                    </button>
                </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
                {activeTab === 'projects' ? (
                    <div className="space-y-6">
                        {/* Project Stats */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="text-center p-4 bg-gray-50 rounded-lg">
                                <p className="text-2xl font-bold text-gray-900">{projects?.length || 0}</p>
                                <p className="text-xs text-gray-600 mt-1">Total</p>
                            </div>
                            <div className="text-center p-4 bg-emerald-50 rounded-lg">
                                <p className="text-2xl font-bold text-emerald-600">{activeProjects.length}</p>
                                <p className="text-xs text-gray-600 mt-1">Active</p>
                            </div>
                            <div className="text-center p-4 bg-blue-50 rounded-lg">
                                <p className="text-2xl font-bold text-blue-600">{completedProjects.length}</p>
                                <p className="text-xs text-gray-600 mt-1">Completed</p>
                            </div>
                        </div>

                        {/* Projects List */}
                        <div className="space-y-3">
                            {projects && projects.length > 0 ? (
                                projects.slice(0, 5).map((project: any) => (
                                    <Link
                                        key={project.id}
                                        href={`/projects/${project.id}`}
                                        className="block p-4 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <h3 className="text-sm font-medium text-gray-900 group-hover:text-indigo-600">
                                                    {project.project_name}
                                                </h3>
                                                {project.domain_name && (
                                                    <p className="text-xs text-gray-500 mt-1">{project.domain_name}</p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${project.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                                                    project.status === 'in_progress' ? 'bg-emerald-100 text-emerald-800' :
                                                        'bg-amber-100 text-amber-800'
                                                    }`}>
                                                    {project.status === 'in_progress' ? 'In Progress' :
                                                        project.status === 'completed' ? 'Completed' : 'Pending'}
                                                </span>
                                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                                    <TrendingUp className="h-3 w-3" />
                                                    {project.progress}%
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-3 w-full bg-gray-200 rounded-full h-1.5">
                                            <div
                                                className={`h-1.5 rounded-full transition-all ${project.status === 'completed' ? 'bg-blue-500' :
                                                    project.status === 'in_progress' ? 'bg-emerald-500' :
                                                        'bg-amber-500'
                                                    }`}
                                                style={{ width: `${project.progress}%` }}
                                            ></div>
                                        </div>
                                    </Link>
                                ))
                            ) : (
                                <div className="text-center py-12 text-gray-500">
                                    <FolderKanban className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                                    <p className="text-sm">No projects assigned yet</p>
                                </div>
                            )}
                        </div>

                        {projects && projects.length > 5 && (
                            <div className="text-center pt-4">
                                <Link
                                    href={`/projects?employee_id=${employee.id}`}
                                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                                >
                                    View all projects →
                                </Link>
                            </div>
                        )}
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-2">
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    name="full_name"
                                    id="full_name"
                                    defaultValue={employee.full_name}
                                    required
                                    className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    id="email"
                                    defaultValue={employee.email}
                                    required
                                    className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                                    Phone Number
                                </label>
                                <input
                                    type="tel"
                                    name="phone"
                                    id="phone"
                                    defaultValue={employee.phone || ''}
                                    className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                                    Role
                                </label>
                                <input
                                    type="text"
                                    name="role"
                                    id="role"
                                    value={employee.role || 'Not assigned'}
                                    disabled
                                    className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-500 bg-gray-50 cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                New Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span>
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    id="password"
                                    className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-10 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <p className="text-sm text-red-600">{error}</p>
                            </div>
                        )}

                        {success && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                                <p className="text-sm text-emerald-600">Profile updated successfully!</p>
                            </div>
                        )}

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={loading}
                                className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save className="h-4 w-4" />
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}
