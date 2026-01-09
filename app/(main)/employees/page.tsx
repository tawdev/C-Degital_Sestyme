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
            name: 'Total Team',
            value: employees.length,
            icon: Users,
            color: 'from-blue-500 to-indigo-600',
            bgColor: 'bg-blue-50',
            iconColor: 'text-blue-600',
            description: 'Registered employees'
        },
        {
            name: 'Active Staff',
            value: employees.length,
            icon: UserPlus,
            color: 'from-emerald-500 to-teal-600',
            bgColor: 'bg-emerald-50',
            iconColor: 'text-emerald-600',
            description: 'Currently operative'
        },
        {
            name: 'Specializations',
            value: new Set(employees.map(e => e.role).filter(Boolean)).size,
            icon: Briefcase,
            color: 'from-purple-500 to-pink-600',
            bgColor: 'bg-purple-50',
            iconColor: 'text-purple-600',
            description: 'Unique job roles'
        }
    ]

    return (
        <div className="max-w-[1600px] mx-auto space-y-10 pb-12">
            {/* Premium Header */}
            <div className="relative overflow-hidden bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Team Management</h1>
                        <p className="mt-2 text-lg text-gray-500 font-medium">Oversee your organization's talent and organizational structure.</p>
                    </div>
                    <Link
                        href="/employees/new"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 border border-transparent rounded-xl text-base font-semibold text-white hover:bg-gray-800 transition-all duration-200 shadow-lg shadow-gray-200"
                    >
                        <UserPlus className="h-5 w-5" />
                        Onboard New Member
                    </Link>
                </div>
                <div className="absolute top-0 right-0 mt-[-10%] mr-[-5%] w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-50"></div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat) => (
                    <div
                        key={stat.name}
                        className="group relative bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-xl transition-all duration-300"
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">{stat.name}</p>
                                <p className="mt-2 text-4xl font-black text-gray-900">{stat.value}</p>
                                <p className="mt-1 text-sm text-gray-500">{stat.description}</p>
                            </div>
                            <div className={`${stat.bgColor} p-4 rounded-2xl group-hover:scale-110 transition-transform duration-300`}>
                                <stat.icon className={`h-7 w-7 ${stat.iconColor}`} />
                            </div>
                        </div>
                        <div className={`absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r ${stat.color} rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                    </div>
                ))}
            </div>

            {/* Team Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">Personnel Roster</h2>
                    <div className="text-sm text-gray-500 font-medium">
                        Showing {employees.length} team members
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50/50">
                            <tr>
                                <th scope="col" className="px-8 py-5 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">
                                    Team Member
                                </th>
                                <th scope="col" className="px-8 py-5 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">
                                    Role & Status
                                </th>
                                <th scope="col" className="px-8 py-5 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">
                                    Contact Details
                                </th>
                                <th scope="col" className="px-8 py-5 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">
                                    Management
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-50">
                            {employees.map((employee) => (
                                <tr key={employee.id} className="hover:bg-gray-50/80 transition-all group">
                                    <td className="px-8 py-6 whitespace-nowrap">
                                        <div className="flex items-center gap-4">
                                            <div className="flex-shrink-0">
                                                <EmployeeAvatar
                                                    avatarUrl={employee.avatar_url}
                                                    fullName={employee.full_name}
                                                    className="h-12 w-12 text-sm shadow-sm border-2 border-white ring-1 ring-gray-100"
                                                />
                                            </div>
                                            <div>
                                                <div className="text-base font-bold text-gray-900">{employee.full_name}</div>
                                                <div className="text-xs font-medium text-gray-400">Joined {new Date(employee.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 whitespace-nowrap">
                                        <div className="flex flex-col gap-1.5">
                                            {employee.role ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-tighter">
                                                    {employee.role}
                                                </span>
                                            ) : (
                                                <span className="text-xs font-medium text-gray-400 italic">No assigned role</span>
                                            )}
                                            <div className="flex items-center gap-1.5">
                                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Active Member</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 whitespace-nowrap">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                                                <Mail className="h-3.5 w-3.5 text-gray-300" />
                                                {employee.email}
                                            </div>
                                            {employee.phone && (
                                                <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                                                    <Phone className="h-3.5 w-3.5 text-gray-300" />
                                                    {employee.phone}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end gap-2 translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                            <Link
                                                href={`/employees/${employee.id}/view`}
                                                className="p-2.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
                                                title="View Profile"
                                            >
                                                <Eye className="h-5 w-5" />
                                            </Link>
                                            <Link
                                                href={`/employees/${employee.id}`}
                                                className="p-2.5 text-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition-all"
                                                title="Edit Member"
                                            >
                                                <Edit className="h-5 w-5" />
                                            </Link>
                                            <form action={deleteEmployee} className="inline-block">
                                                <input type="hidden" name="id" value={employee.id} />
                                                <button
                                                    type="submit"
                                                    className="p-2.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all"
                                                    title="Delete Member"
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
                        <div className="text-center py-20 px-8">
                            <div className="bg-gray-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                <Users className="h-10 w-10 text-gray-200" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">No team members yet</h3>
                            <p className="text-gray-500 max-w-sm mx-auto mb-8">Begin building your organization by onboarding your first personnel asset.</p>
                            <Link
                                href="/employees/new"
                                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all font-bold"
                            >
                                <Plus className="h-5 w-5" />
                                Onboard Member
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
