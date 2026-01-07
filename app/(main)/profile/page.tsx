import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/app/auth/actions'
import { redirect } from 'next/navigation'
import ProfileTabs from './profile-tabs'
import { Mail, Phone, Briefcase, Calendar } from 'lucide-react'

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
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg p-8 text-white">
                <div className="flex items-center gap-6">
                    <div className="flex-shrink-0 h-24 w-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-4xl font-bold border-4 border-white/30">
                        {employee.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">{employee.full_name}</h1>
                        <p className="text-indigo-100 mt-1 flex items-center gap-2">
                            <Briefcase className="h-4 w-4" />
                            {employee.role || 'No role assigned'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Profile Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-50 p-3 rounded-lg">
                            <Mail className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Email</p>
                            <p className="text-sm font-medium text-gray-900">{employee.email}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-50 p-3 rounded-lg">
                            <Phone className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Phone</p>
                            <p className="text-sm font-medium text-gray-900">{employee.phone || 'Not provided'}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-purple-50 p-3 rounded-lg">
                            <Calendar className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Member Since</p>
                            <p className="text-sm font-medium text-gray-900">
                                {new Date(employee.created_at).toLocaleDateString('en-US', {
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
