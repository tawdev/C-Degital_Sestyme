import { redirect } from 'next/navigation'
import Link from 'next/link'
import { logout, getSession } from '../auth/actions'
import { LayoutDashboard, Users, Briefcase, LogOut, User, MessageSquare, Video } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getUnreadCount } from './messages/actions'
import UnreadBadge from '@/components/chat/unread-badge'
import { getUnvalidatedNotesCount, getOwnedProjectIds } from '@/components/journal/actions'
import JournalBadge from '@/components/journal/journal-badge'

import { CallProvider } from '@/components/chat/call-manager'
import { RealtimeProvider } from '@/context/realtime-context'
import { AudioProvider } from '@/context/audio-context'
import { NotificationProvider } from '@/context/notification-context'
import MeetingNotificationBadge from '@/components/meetings/notification-badge'
import MeetingNotification from '@/components/meetings/meeting-notification'
import { ThemeToggle } from '@/components/theme-toggle'


export default async function MainLayout({ children }: { children: React.ReactNode }) {
    const session = await getSession()

    if (!session) {
        redirect('/auth/signout')
    }

    const displayName = session.full_name?.split(' ')[0] || session.email?.split('@')[0] || 'User'

    // Fetch user role and unread count
    const supabase = createClient()
    const [{ data: employee }, unreadCount, journalCount, ownedProjects] = await Promise.all([
        supabase
            .from('employees')
            .select('role, avatar_url, full_name, id')
            .eq('id', session.id)
            .single(),
        getUnreadCount(),
        getUnvalidatedNotesCount(),
        getOwnedProjectIds()
    ])

    const isAdmin = employee?.role === 'Administrator'
    const avatarUrl = employee?.avatar_url

    const currentUser = {
        id: session.id,
        full_name: employee?.full_name || displayName,
        avatar_url: avatarUrl
    }

    return (
        <AudioProvider>
            <NotificationProvider>
                <CallProvider currentUser={currentUser}>
                    <RealtimeProvider currentUserId={session.id}>
                        <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-[#050505] overflow-x-hidden">
                            {/* Global Notification */}
                            <MeetingNotification />
                            {/* Modern Header */}
                            <header className="bg-white/80 dark:bg-[#0a0515]/80 backdrop-blur-md border-b border-gray-200 dark:border-white/10 sticky top-0 z-50 shadow-sm w-full">
                                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                                    <div className="flex justify-between items-center h-16">
                                        {/* Logo */}
                                        <div className="flex items-center gap-8">
                                            <Link href="/dashboard" className="flex items-center gap-2 group">
                                                <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-2 rounded-lg group-hover:shadow-lg transition-shadow">
                                                    <LayoutDashboard className="h-5 w-5 text-white" />
                                                </div>
                                                
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
                                                {isAdmin && (
                                                    <NavLink href="/calls" icon={Video}>
                                                        Appels
                                                    </NavLink>
                                                )}
                                                <NavLink
                                                    href="/projects"
                                                    icon={Briefcase}
                                                >
                                                    Projects
                                                </NavLink>
                                                <NavLink
                                                    href="/messages"
                                                    icon={MessageSquare}
                                                    badge={<UnreadBadge initialCount={unreadCount} userId={session.id} />}
                                                >
                                                    Messages
                                                </NavLink>
                                                <NavLink
                                                    href="/meetings"
                                                    icon={Video}
                                                    badge={<MeetingNotificationBadge userId={session.id} />}
                                                >
                                                    Réunions
                                                </NavLink>
                                            </nav>
                                        </div>

                                        {/* User Menu */}
                                        <div className="flex items-center gap-4">
                                            <ThemeToggle />

                                            {/* Journal Notification Bell */}
                                            <JournalBadge initialCount={journalCount} userId={session.id} ownedProjectIds={ownedProjects} />

                                            {/* User Info */}
                                            <Link
                                                href="/profile"
                                                className="hidden sm:flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 hover:border-gray-300 dark:hover:border-white/20 transition-all cursor-pointer group/user"
                                            >
                                                <div className="flex-shrink-0 h-8 w-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold group-hover/user:shadow-md transition-all overflow-hidden border-2 border-white dark:border-white/20">
                                                    {avatarUrl ? (
                                                        <img
                                                            src={avatarUrl}
                                                            alt={displayName}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        displayName[0].toUpperCase()
                                                    )}
                                                </div>
                                                <div className="hidden lg:block text-left">
                                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover/user:text-indigo-600 dark:group-hover/user:text-indigo-400 transition-colors">{displayName}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">{session.email}</p>
                                                </div>
                                            </Link>

                                            {/* Logout Button */}
                                            <form action={logout}>
                                                <button
                                                    type="submit"
                                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                >
                                                    <LogOut className="h-4 w-4" />
                                                    <span className="hidden sm:inline">Sign out</span>
                                                </button>
                                            </form>
                                        </div>
                                    </div>
                                </div>

                                {/* Mobile Navigation */}
                                <div className="md:hidden border-t border-gray-200 bg-gray-50 overflow-x-auto custom-scrollbar">
                                    <div className="max-w-7xl mx-auto px-4 py-3 flex gap-2 min-w-max">
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
                                        {isAdmin && (
                                            <MobileNavLink href="/calls" icon={Video}>
                                                Appels
                                            </MobileNavLink>
                                        )}
                                        <MobileNavLink href="/projects" icon={Briefcase}>
                                            Projects
                                        </MobileNavLink>
                                        <MobileNavLink
                                            href="/messages"
                                            icon={MessageSquare}
                                            badge={<UnreadBadge initialCount={unreadCount} userId={session.id} />}
                                        >
                                            Messages
                                        </MobileNavLink>
                                        <MobileNavLink href="/profile" icon={User}>
                                            Profile
                                        </MobileNavLink>
                                        <MobileNavLink
                                            href="/meetings"
                                            icon={Video}
                                            badge={<MeetingNotificationBadge userId={session.id} />}
                                        >
                                            Réunions
                                        </MobileNavLink>
                                    </div>
                                </div>
                            </header>
                            <main className="flex-1 w-full max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 overflow-x-hidden">
                                {children}
                            </main>
                            <footer className="bg-white border-t border-gray-200 mt-auto">
                                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                                    <p className="text-center text-sm text-gray-500">
                                        © 2026 EmpManager. Enterprise Management System.
                                    </p>
                                </div>
                            </footer>
                        </div>
                    </RealtimeProvider>
                </CallProvider>
            </NotificationProvider>
        </AudioProvider>
    )
}

function NavLink({ href, icon: Icon, children, badge }: { href: string, icon: any, children: React.ReactNode, badge?: React.ReactNode }) {
    return (
        <Link
            href={href}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-white/5 rounded-lg transition-colors group relative"
        >
            <Icon className="h-4 w-4 text-gray-400 dark:text-gray-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
            {children}
            {badge && (
                <div className="absolute -top-1 -right-1">
                    {badge}
                </div>
            )}
        </Link>
    )
}

// Mobile Navigation Link Component
function MobileNavLink({ href, icon: Icon, children, badge }: { href: string, icon: any, children: React.ReactNode, badge?: React.ReactNode }) {
    return (
        <Link
            href={href}
            className="flex-1 flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium text-gray-600 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors relative"
        >
            <div className="relative">
                <Icon className="h-5 w-5" />
                {badge && (
                    <div className="absolute -top-2 -right-2">
                        {badge}
                    </div>
                )}
            </div>
            {children}
        </Link>
    )
}
