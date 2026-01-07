import { redirect } from 'next/navigation'
import Link from 'next/link'
import { logout, getSession } from '../auth/actions'
import { LayoutDashboard, Users, Briefcase, LogOut, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
    const session = await getSession()

    if (!session) {
        redirect('/auth/login')
    }

    const displayName = session.full_name?.split(' ')[0] || session.email?.split('@')[0] || 'User'

    // Fetch user role
    const supabase = createClient()
    const { data: employee } = await supabase
        .from('employees')
        .select('role')
        .eq('id', session.id)
        .single()

    const isAdmin = employee?.role === 'Administrator'

    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            {/* Modern Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        {/* Logo */}
                        <div className="flex items-center gap-8">
                            <Link href="/dashboard" className="flex items-center gap-2 group">
                                <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-2 rounded-lg group-hover:shadow-lg transition-shadow">
                                    <LayoutDashboard className="h-5 w-5 text-white" />
                                </div>
                                <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                    EmpManager
                                </span>
                            </Link>

                            {/* Navigation */}
                            <nav className="hidden md:flex items-center gap-1">
                                {isAdmin && (
                                    <NavLink href="/dashboard" icon={LayoutDashboard}>
                                        Dashboard
                                    </NavLink>
                                )}
                                {isAdmin && (
                                    <NavLink href="/employees" icon={Users}>
                                        Employees
                                    </NavLink>
                                )}
                                <NavLink href="/projects" icon={Briefcase}>
                                    Projects
                                </NavLink>
                                <NavLink href="/profile" icon={User}>
                                    Profile
                                </NavLink>
                            </nav>
                        </div>

                        {/* User Menu */}
                        <div className="flex items-center gap-4">
                            {/* User Info */}
                            <div className="hidden sm:flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
                                <div className="flex-shrink-0 h-8 w-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                                    {displayName[0].toUpperCase()}
                                </div>
                                <div className="hidden lg:block">
                                    <p className="text-sm font-medium text-gray-900">{displayName}</p>
                                    <p className="text-xs text-gray-500">{session.email}</p>
                                </div>
                            </div>

                            {/* Logout Button */}
                            <form action={logout}>
                                <button
                                    type="submit"
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <LogOut className="h-4 w-4" />
                                    <span className="hidden sm:inline">Sign out</span>
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

                {/* Mobile Navigation */}
                <div className="md:hidden border-t border-gray-200 bg-gray-50">
                    <div className="max-w-7xl mx-auto px-4 py-3 flex gap-2">
                        {isAdmin && (
                            <MobileNavLink href="/dashboard" icon={LayoutDashboard}>
                                Dashboard
                            </MobileNavLink>
                        )}
                        {isAdmin && (
                            <MobileNavLink href="/employees" icon={Users}>
                                Employees
                            </MobileNavLink>
                        )}
                        <MobileNavLink href="/projects" icon={Briefcase}>
                            Projects
                        </MobileNavLink>
                        <MobileNavLink href="/profile" icon={User}>
                            Profile
                        </MobileNavLink>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 w-full max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                {children}
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-200 mt-auto">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <p className="text-center text-sm text-gray-500">
                        © 2026 EmpManager. Enterprise Management System.
                    </p>
                </div>
            </footer>
        </div>
    )
}

// Desktop Navigation Link Component
function NavLink({ href, icon: Icon, children }: { href: string, icon: any, children: React.ReactNode }) {
    return (
        <Link
            href={href}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors group"
        >
            <Icon className="h-4 w-4 text-gray-400 group-hover:text-indigo-600" />
            {children}
        </Link>
    )
}

// Mobile Navigation Link Component
function MobileNavLink({ href, icon: Icon, children }: { href: string, icon: any, children: React.ReactNode }) {
    return (
        <Link
            href={href}
            className="flex-1 flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium text-gray-600 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"
        >
            <Icon className="h-5 w-5" />
            {children}
        </Link>
    )
}
