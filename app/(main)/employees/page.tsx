import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Trash2, Edit, UserPlus, Mail, Phone, Briefcase, Eye, ArrowUpRight, Plus, Users } from 'lucide-react'
import { deleteEmployee } from './actions'
import { getSession } from '@/app/auth/actions'
import { redirect } from 'next/navigation'
import EmployeeAvatar from '@/components/employee-avatar'


interface Employee {
    id: string
    full_name: string
    role: string | null
    email: string
    phone: string | null
    avatar_url: string | null
    date_of_birth: string | null
    created_at: string
}

export default async function EmployeesPage() {
    const session = await getSession()

    if (!session) {
        redirect('/auth/login')
    }

    const supabase = createClient()

    const { data: currentUser } = await supabase
        .from('employees')
        .select('role')
        .eq('id', session.id)
        .single()

    if (currentUser?.role !== 'Administrator') {
        redirect('/projects')
    }

    const { data } = await supabase
        .from('employees')
        .select('id, full_name, role, email, phone, avatar_url, date_of_birth, created_at')
        .order('created_at', { ascending: false })

    const employees = (data as unknown as Employee[]) || []

    const stats = [
        {
            name: 'Équipe totale',
            value: employees.length,
            icon: Users,
            color: 'from-blue-500 to-indigo-600',
            bgColor: 'bg-blue-50',
            iconColor: 'text-blue-600',
            description: 'Employés inscrits'
        },
        {
            name: 'Personnel actif',
            value: employees.length,
            icon: UserPlus,
            color: 'from-emerald-500 to-teal-600',
            bgColor: 'bg-emerald-50',
            iconColor: 'text-emerald-600',
            description: 'Actuellement opérationnel'
        },
        {
            name: 'Spécialisations',
            value: new Set(employees.map(e => e.role).filter(Boolean)).size,
            icon: Briefcase,
            color: 'from-purple-500 to-pink-600',
            bgColor: 'bg-purple-50',
            iconColor: 'text-purple-600',
            description: 'Rôles uniques'
        }
    ]

    return (
        <div className="max-w-7xl mx-auto space-y-10 pb-12 transition-colors duration-500">
            {/* Premium Header */}
            <div className="relative overflow-hidden bg-white/70 dark:bg-white/5 backdrop-blur-2xl rounded-[2.5rem] border border-gray-200 dark:border-white/10 p-8 md:p-10 shadow-2xl shadow-indigo-900/5">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div>
                        <h1 className="text-4xl lg:text-5xl font-black text-gray-900 dark:text-white tracking-tight">
                            Gestion de l'équipe
                        </h1>
                        <p className="mt-3 text-lg text-gray-500 dark:text-indigo-200/60 font-medium max-w-2xl">
                            Supervisez les talents et la structure organisationnelle de votre entreprise avec une précision absolue.
                        </p>
                    </div>
                    <Link
                        href="/employees/new"
                        className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-indigo-900/20 hover:scale-[1.02] active:scale-[0.98] w-full md:w-auto justify-center"
                    >
                        <UserPlus className="h-5 w-5" />
                        Nouveau Membre
                    </Link>
                </div>
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 dark:bg-indigo-600/20 blur-[100px] rounded-full animate-pulse"></div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat) => (
                    <div
                        key={stat.name}
                        className="group relative bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-[2rem] border border-gray-200 dark:border-white/10 p-8 hover:bg-white/90 dark:hover:bg-white/10 transition-all duration-300 overflow-hidden shadow-sm hover:shadow-xl"
                    >
                        <div className="flex items-start justify-between relative z-10">
                            <div>
                                <p className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.2em] mb-3">{stat.name}</p>
                                <p className="text-5xl font-black text-gray-900 dark:text-white transition-colors">{stat.value}</p>
                                <p className="mt-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{stat.description}</p>
                            </div>
                            <div className={`${stat.bgColor} dark:bg-white/5 p-4 rounded-2xl group-hover:scale-110 transition-all duration-500 border border-transparent dark:group-hover:border-white/20`}>
                                <stat.icon className={`h-8 w-8 ${stat.iconColor}`} />
                            </div>
                        </div>
                        <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.color} opacity-10 dark:opacity-30 group-hover:opacity-100 transition-opacity duration-500`}></div>
                    </div>
                ))}
            </div>

            {/* Team Table */}
            <div className="bg-white/70 dark:bg-white/5 backdrop-blur-2xl rounded-[2.5rem] border border-gray-200 dark:border-white/10 overflow-hidden shadow-sm">
                <div className="p-8 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/5">
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white transition-colors tracking-tight">Registre du personnel</h2>
                    <div className="px-4 py-1.5 bg-indigo-500/5 dark:bg-indigo-400/10 rounded-full text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest border border-indigo-100 dark:border-indigo-400/20">
                        {employees.length} Mises à jour
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100 dark:divide-white/5">
                        <thead className="bg-gray-50/50 dark:bg-white/5">
                            <tr>
                                <th scope="col" className="px-8 py-6 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">
                                    Membre de l'équipe
                                </th>
                                <th scope="col" className="px-8 py-6 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">
                                    Rôle & Statut
                                </th>
                                <th scope="col" className="px-8 py-6 text-left text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">
                                    Coordonnées
                                </th>
                                <th scope="col" className="px-8 py-6 text-right text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">
                                    Gestion
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-transparent divide-y divide-gray-50 dark:divide-white/5">
                            {employees.map((employee) => (
                                <tr key={employee.id} className="hover:bg-indigo-50/30 dark:hover:bg-white/5 transition-all group relative">
                                    <td className="px-8 py-6 whitespace-nowrap">
                                        <div className="flex items-center gap-4">
                                            <div className="flex-shrink-0">
                                                <EmployeeAvatar
                                                    avatarUrl={employee.avatar_url}
                                                    fullName={employee.full_name}
                                                    className="h-14 w-14 text-sm font-black shadow-lg border-2 border-white dark:border-white/10 ring-1 ring-gray-100 dark:ring-white/5"
                                                />
                                            </div>
                                            <div>
                                                <div className="text-lg font-black text-gray-900 dark:text-white transition-colors">{employee.full_name}</div>
                                                <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">Inscrit en {new Date(employee.created_at).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 whitespace-nowrap">
                                        <div className="flex flex-col gap-2">
                                            {employee.role ? (
                                                <span className="inline-flex items-center w-fit px-3 py-1 rounded-xl text-[10px] font-black bg-indigo-50 dark:bg-indigo-400/10 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-400/20 uppercase tracking-wider">
                                                    {employee.role}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-600 italic uppercase">Aucun rôle assigné</span>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse"></div>
                                                <span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Actif</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 whitespace-nowrap">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2.5 text-sm font-bold text-gray-600 dark:text-gray-400 transition-colors">
                                                <Mail className="h-4 w-4 text-indigo-400/60" />
                                                {employee.email}
                                            </div>
                                            {employee.phone && (
                                                <div className="flex items-center gap-2.5 text-sm font-bold text-gray-600 dark:text-gray-400 transition-colors">
                                                    <Phone className="h-4 w-4 text-indigo-400/60" />
                                                    {employee.phone}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end gap-3 translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500">
                                            <Link
                                                href={`/employees/${employee.id}/view`}
                                                className="p-3 bg-white dark:bg-white/5 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-white border border-gray-100 dark:border-white/10 rounded-2xl transition-all shadow-sm hover:shadow-md"
                                                title="Voir le profil"
                                            >
                                                <Eye className="h-5 w-5" />
                                            </Link>
                                            <Link
                                                href={`/employees/${employee.id}`}
                                                className="p-3 bg-indigo-50 dark:bg-indigo-400/10 text-indigo-400 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-white border border-indigo-100 dark:border-indigo-400/20 rounded-2xl transition-all shadow-sm hover:shadow-md"
                                                title="Modifier le membre"
                                            >
                                                <Edit className="h-5 w-5" />
                                            </Link>
                                            <form action={deleteEmployee} className="inline-block">
                                                <input type="hidden" name="id" value={employee.id} />
                                                <button
                                                    type="submit"
                                                    className="p-3 bg-red-50 dark:bg-red-400/10 text-red-400 dark:text-red-300 hover:text-red-700 dark:hover:text-white border border-red-100 dark:border-red-400/20 rounded-2xl transition-all shadow-sm hover:shadow-md"
                                                    title="Supprimer le membre"
                                                >
                                                    <Trash2 className="h-5 w-5" />
                                                </button>
                                            </form>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {employees.length === 0 && (
                        <div className="text-center py-32 px-8">
                            <div className="bg-gray-50 dark:bg-white/5 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                                <Users className="h-12 w-12 text-gray-300 dark:text-gray-600" />
                            </div>
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3 tracking-tight">Pas encore de membres d'équipe</h3>
                            <p className="text-gray-500 dark:text-indigo-200/40 max-w-sm mx-auto mb-10 font-medium">Commencez à bâtir votre organisation en recrutant votre premier employé de talent.</p>
                            <Link
                                href="/employees/new"
                                className="inline-flex items-center gap-3 px-10 py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-2xl shadow-indigo-200 dark:shadow-none transition-all font-black uppercase tracking-widest text-sm"
                            >
                                <Plus className="h-5 w-5" />
                                Recruter un membre
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
