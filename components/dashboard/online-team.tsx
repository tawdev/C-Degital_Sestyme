import { useRealtime } from '@/context/realtime-context'
import EmployeeAvatar from '@/components/employee-avatar'
import { Users, Circle } from 'lucide-react'

export default function OnlineTeam() {
    const { onlineUsers } = useRealtime()

    // Transform presence state into a flat array of unique members
    const members = Object.keys(onlineUsers).map(userId => {
        const states = onlineUsers[userId]
        const latestState = states[0] // Just take the first session
        return {
            id: userId,
            full_name: latestState.full_name || 'Inconnu',
            avatar_url: latestState.avatar_url || null
        }
    })

    if (members.length === 0) {
        return (
            <div className="flex items-center gap-3 text-gray-400">
                <Users className="h-5 w-5" />
                <span className="text-sm font-medium transition-all">Aucun membre en ligne</span>
            </div>
        )
    }

    return (
        <div className="flex items-center gap-4 animate-in fade-in duration-500">
            <div className="flex items-center gap-2">
                <div className="relative">
                    <Users className="h-5 w-5 text-emerald-600" />
                    <Circle className="absolute -top-1 -right-1 h-2.5 w-2.5 text-emerald-500 fill-emerald-500 animate-pulse" />
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {members.length} en ligne
                </span>
            </div>

            <div className="flex items-center -space-x-2">
                {members.slice(0, 5).map((member) => (
                    <div
                        key={member.id}
                        className="relative group lg:block"
                        title={member.full_name}
                    >
                        <EmployeeAvatar
                            avatarUrl={member.avatar_url}
                            fullName={member.full_name}
                            className="h-8 w-8 text-[10px] border-2 border-white dark:border-gray-800 shadow-sm ring-2 ring-emerald-100 dark:ring-emerald-900/20 transition-transform group-hover:scale-110"
                        />
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
                    </div>
                ))}
                {members.length > 5 && (
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-100 dark:bg-white/5 border-2 border-white dark:border-gray-800 text-[10px] font-black text-gray-600 dark:text-gray-400">
                        +{members.length - 5}
                    </div>
                )}
            </div>
        </div>
    )
}
