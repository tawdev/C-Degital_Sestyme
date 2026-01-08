import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/app/auth/actions'
import { Mail, Phone, Briefcase, Calendar, ChevronLeft, Award, Code2, Cake, FolderOpen, Clock } from 'lucide-react'
import Link from 'next/link'
import EmployeeAvatar from '@/components/employee-avatar'

export default async function EmployeeViewPage({ params }: { params: { id: string } }) {
    const session = await getSession()
    if (!session) redirect('/auth/login')

    const supabase = createClient()

    // Fetch employee data and their projects
    const [
        { data: employee },
        { data: projects }
    ] = await Promise.all([
        supabase
            .from('employees')
            .select('*')
            .eq('id', params.id)
            .single(),
        supabase
            .from('projects')
            .select('*')
            .eq('employee_id', params.id)
            .order('created_at', { ascending: false })
    ])

    if (!employee) notFound()

    const specializations = Array.isArray(employee.specialization)
        ? employee.specialization
        : (employee.specialization ? [employee.specialization] : [])

    const skills = Array.isArray(employee.skills) ? employee.skills : []

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Navigation */}
            <div className="flex items-center justify-between">
                <Link
                    href="/employees"
                    className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Back to Employees
                </Link>
                <div className="flex gap-3">
                    <Link
                        href={`/employees/${employee.id}`}
                        className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
                    >
                        Edit Profile
                    </Link>
                </div>
            </div>

            {/* Profile Header Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="h-32 bg-gradient-to-r from-indigo-600 to-purple-600" />
                <div className="px-8 pb-8">
                    <div className="relative flex items-end gap-6 -mt-12 mb-6">
                        <EmployeeAvatar
                            avatarUrl={employee.avatar_url}
                            fullName={employee.full_name}
                            className="h-32 w-32 text-4xl border-4 border-white shadow-lg rounded-2xl font-bold"
                        />
                        <div className="pb-2">
                            <h1 className="text-3xl font-bold text-gray-900">{employee.full_name}</h1>
                            <p className="text-indigo-600 font-semibold flex items-center gap-2 mt-1">
                                <Briefcase className="h-4 w-4" />
                                {employee.role || 'No role assigned'}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                                <Mail className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs text-gray-500 font-medium">Email</p>
                                <p className="text-sm font-semibold text-gray-900 truncate">{employee.email}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
                                <Phone className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-medium">WhatsApp</p>
                                <p className="text-sm font-semibold text-gray-900">{employee.phone || '-'}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="bg-pink-100 p-2 rounded-lg text-pink-600">
                                <Cake className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-medium">Birthday</p>
                                <p className="text-sm font-semibold text-gray-900">
                                    {employee.date_of_birth ? new Date(employee.date_of_birth).toLocaleDateString('fr-FR', {
                                        day: '2-digit',
                                        month: 'long'
                                    }) : '-'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
                                <Calendar className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-medium">Joined</p>
                                <p className="text-sm font-semibold text-gray-900">
                                    {new Date(employee.created_at).toLocaleDateString('fr-FR', {
                                        month: 'short',
                                        year: 'numeric'
                                    })}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-8">
                    {/* Projects Section */}
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <FolderOpen className="h-6 w-6 text-indigo-600" />
                                <h2 className="text-xl font-bold text-gray-900">Projets Affectés</h2>
                            </div>
                            <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold uppercase tracking-wider">
                                {projects?.length || 0} Total
                            </span>
                        </div>

                        {projects && projects.length > 0 ? (
                            <div className="space-y-4">
                                {projects.map((project) => (
                                    <div key={project.id} className="p-4 rounded-xl border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all group">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h3 className="font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">
                                                    {project.name}
                                                </h3>
                                                <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                                                    {project.description}
                                                </p>
                                                <div className="flex items-center gap-4 mt-3">
                                                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        {new Date(project.created_at).toLocaleDateString('fr-FR')}
                                                    </div>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${project.status === 'completed'
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : 'bg-amber-100 text-amber-700'
                                                        }`}>
                                                        {project.status}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-2xl">
                                <FolderOpen className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                                <p className="text-gray-400 text-sm">Aucun projet en cours pour cet employé.</p>
                            </div>
                        )}
                    </div>

                    {/* Expertise & Specialization */}
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-6">
                            <Award className="h-6 w-6 text-indigo-600" />
                            <h2 className="text-xl font-bold text-gray-900">Expertise & Spécialisation</h2>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-8">
                            {specializations.length > 0 ? specializations.map(spec => (
                                <span key={spec} className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold border border-indigo-100 shadow-sm">
                                    {spec}
                                </span>
                            )) : (
                                <p className="text-sm text-gray-400 italic">Aucune spécialisation listée</p>
                            )}
                        </div>

                        <div className="flex items-center gap-3 mb-6 pt-6 border-t border-gray-100">
                            <Code2 className="h-6 w-6 text-purple-600" />
                            <h2 className="text-xl font-bold text-gray-900">Compétences Techniques</h2>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {skills.length > 0 ? skills.map(skill => (
                                <span key={skill} className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium border border-purple-100 shadow-sm">
                                    {skill}
                                </span>
                            )) : (
                                <p className="text-sm text-gray-400 italic">Aucune compétence listée</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Statut Employé</h3>
                        <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                            <div className="h-2.5 w-2.5 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-sm font-bold text-emerald-800 tracking-tight">Membre Actif du Staff</span>
                        </div>
                    </div>

                    <div className="bg-slate-900 p-6 rounded-2xl shadow-lg text-white">
                        <h3 className="text-xs font-bold uppercase tracking-widest mb-2 opacity-60">Actions de Direction</h3>
                        <div className="space-y-3 mt-4">
                            <Link
                                href={`/messages/new?employee_id=${employee.id}`}
                                className="block w-full text-center py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-bold transition-all shadow-indigo-900/20 shadow-lg"
                            >
                                Ouvrir un Chat Direct
                            </Link>
                            <Link
                                href={`/employees/${employee.id}`}
                                className="block w-full text-center py-3 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-all border border-white/5"
                            >
                                Modifier l'Employé
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
