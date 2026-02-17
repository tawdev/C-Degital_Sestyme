import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/app/auth/actions'
import { redirect } from 'next/navigation'
import ProfileTabs from './profile-tabs'
import { Mail, Phone, Briefcase, Calendar } from 'lucide-react'
import EmployeeAvatar from '@/components/employee-avatar'

export default async function ProfilePage() {
    const session = await getSession()

    if (!session) {
        redirect('/auth/login')
    }

    const supabase = createClient()

    // Fetch employee data and their projects
    const [
        { data: employee },
        { data: projects }
    ] = await Promise.all([
        supabase
            .from('employees')
            .select('*')
            .eq('id', session.id)
            .single(),
        supabase
            .from('projects')
            .select('*')
            .eq('employee_id', session.id)
            .order('created_at', { ascending: false })
    ])

    if (!employee) {
        redirect('/dashboard')
    }

    return (
        <div className="max-w-4xl mx-auto space-y-10 transition-colors duration-500">
            {/* Header with Glass Gradient */}
            <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 to-purple-600 rounded-[2.5rem] shadow-2xl shadow-indigo-900/20 p-10 text-white group">
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-400/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

                <div className="relative flex flex-col md:flex-row items-center gap-8">
                    <EmployeeAvatar
                        avatarUrl={employee.avatar_url}
                        fullName={employee.full_name}
                        className="h-32 w-32 text-4xl border-4 border-white/30 shadow-2xl transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="text-center md:text-left space-y-3">
                        <div className="inline-flex px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-[10px] font-black uppercase tracking-[0.2em]">Profil Utilisateur</div>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight">{employee.full_name}</h1>
                        <p className="text-indigo-100/80 mt-1 flex items-center justify-center md:justify-start gap-2 text-lg font-medium">
                            <Briefcase className="h-5 w-5 opacity-70" />
                            {employee.role || 'Aucun rôle assigné'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Profile Info Cards with Glassmorphism */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/70 dark:bg-white/5 backdrop-blur-2xl rounded-[2rem] border border-gray-200 dark:border-white/10 p-6 shadow-xl shadow-indigo-900/5 hover:shadow-2xl transition-all group">
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-50 dark:bg-indigo-400/10 p-4 rounded-2xl group-hover:scale-110 transition-transform">
                            <Mail className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Email</p>
                            <p className="text-sm font-black text-gray-900 dark:text-white transition-colors">{employee.email}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white/70 dark:bg-white/5 backdrop-blur-2xl rounded-[2rem] border border-gray-200 dark:border-white/10 p-6 shadow-xl shadow-indigo-900/5 hover:shadow-2xl transition-all group">
                    <div className="flex items-center gap-4">
                        <div className="bg-emerald-50 dark:bg-emerald-400/10 p-4 rounded-2xl group-hover:scale-110 transition-transform">
                            <Phone className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Téléphone</p>
                            <p className="text-sm font-black text-gray-900 dark:text-white transition-colors">{employee.phone || 'Non renseigné'}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white/70 dark:bg-white/5 backdrop-blur-2xl rounded-[2rem] border border-gray-200 dark:border-white/10 p-6 shadow-xl shadow-indigo-900/5 hover:shadow-2xl transition-all group">
                    <div className="flex items-center gap-4">
                        <div className="bg-purple-50 dark:bg-purple-400/10 p-4 rounded-2xl group-hover:scale-110 transition-transform">
                            <Calendar className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Membre depuis</p>
                            <p className="text-sm font-black text-gray-900 dark:text-white transition-colors">
                                {new Date(employee.created_at).toLocaleDateString('fr-FR', {
                                    month: 'short',
                                    year: 'numeric'
                                })}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabbed Content: My Projects & Edit Profile */}
            <ProfileTabs employee={employee} projects={projects || []} />
        </div>
    )
}
