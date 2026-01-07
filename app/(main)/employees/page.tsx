import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Trash2, Edit, UserPlus, Mail, Phone, Briefcase } from 'lucide-react'
import { deleteEmployee } from './actions'
import { getSession } from '@/app/auth/actions'
import { redirect } from 'next/navigation'

interface Employee {
    id: string
    full_name: string
    role: string | null
    email: string
    phone: string | null
    created_at: string
}

export default async function EmployeesPage() {
    // Check if user is admin
    const session = await getSession()

    if (!session) {
        redirect('/auth/login')
    }

    const supabase = createClient()

    // Get user role
    const { data: currentUser } = await supabase
        .from('employees')
        .select('role')
        .eq('id', session.id)
        .single()

    // Redirect non-admin users to projects page
    if (currentUser?.role !== 'Administrator') {
        redirect('/projects')
    }

    // Fetch employees data
    const { data } = await supabase
        .from('employees')
        .select('id, full_name, role, email, phone, created_at')
        .order('created_at', { ascending: false })

    const employees = (data as unknown as Employee[]) || []

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Employees</h1>
                    <p className="mt-2 text-gray-600">Manage your team members and their roles</p>
                </div>
                <Link
                    href="/employees/new"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg font-medium"
                >
                    <UserPlus className="h-5 w-5" />
                    Add Employee
                </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-50 p-3 rounded-lg">
                            <Briefcase className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Total Employees</p>
                            <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-50 p-3 rounded-lg">
                            <UserPlus className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Active Members</p>
                            <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-purple-50 p-3 rounded-lg">
                            <Mail className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Departments</p>
                            <p className="text-2xl font-bold text-gray-900">{new Set(employees.map(e => e.role).filter(Boolean)).size}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Employee
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Role
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Contact
                                </th>
                                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {employees.map((employee) => (
                                <tr key={employee.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                                                {employee.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">{employee.full_name}</div>
                                                <div className="text-sm text-gray-500 flex items-center gap-1">
                                                    <Mail className="h-3 w-3" />
                                                    {employee.email}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {employee.role ? (
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                                {employee.role}
                                            </span>
                                        ) : (
                                            <span className="text-sm text-gray-400">No role</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {employee.phone ? (
                                            <div className="flex items-center gap-1 text-sm text-gray-600">
                                                <Phone className="h-4 w-4" />
                                                {employee.phone}
                                            </div>
                                        ) : (
                                            <span className="text-sm text-gray-400">No phone</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end gap-2">
                                            <Link
                                                href={`/employees/${employee.id}`}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-lg transition-colors"
                                            >
                                                <Edit className="h-4 w-4" />
                                                Edit
                                            </Link>
                                            <form action={deleteEmployee}>
                                                <input type="hidden" name="id" value={employee.id} />
                                                <button
                                                    type="submit"
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    Delete
                                                </button>
                                            </form>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {employees.length === 0 && (
                        <div className="text-center py-12">
                            <Briefcase className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                            <p className="text-gray-500 text-sm">No employees found. Add your first employee to get started.</p>
                            <Link
                                href="/employees/new"
                                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                            >
                                <UserPlus className="h-4 w-4" />
                                Add Employee
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
