'use client'

import React, { useState, useEffect } from 'react'
import { X, Search, UserPlus, Loader2 } from 'lucide-react'
import { getEmployees } from '@/app/(main)/chat/actions'
import EmployeeAvatar from '@/components/employee-avatar'

interface InviteParticipantModalProps {
    onClose: () => void
    onInvite: (userId: string, userName: string, userAvatar: string | null) => void
    currentParticipants: { id: string; name: string; avatar: string | null }[]
}

export default function InviteParticipantModal({ onClose, onInvite, currentParticipants }: InviteParticipantModalProps) {
    const [employees, setEmployees] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const data = await getEmployees()
                // Filter out current participants
                const participantIds = currentParticipants.map(p => p.id)
                const filtered = data.filter((emp: any) => !participantIds.includes(emp.id))
                setEmployees(filtered)
            } catch (err) {
                console.error('Error fetching employees for invite:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchEmployees()
    }, [currentParticipants])

    const filteredEmployees = employees.filter(emp =>
        emp.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-white/10 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-indigo-600/10 to-transparent">
                    <div>
                        <h3 className="text-xl font-bold text-white">Ajouter un participant</h3>
                        <p className="text-xs text-gray-400 mt-1">Invitez un collègue à rejoindre l'appel</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-4 bg-gray-950/50">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Rechercher par nom..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-gray-600"
                        />
                    </div>
                </div>

                {/* Employees List */}
                <div className="flex-1 overflow-y-auto p-2 max-h-[400px] min-h-[200px]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-12 gap-3 text-gray-500">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                            <p className="text-sm">Chargement des contacts...</p>
                        </div>
                    ) : filteredEmployees.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 gap-3 text-gray-500 text-center">
                            <p className="text-sm">Aucun contact disponible pour le moment.</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredEmployees.map((emp) => (
                                <button
                                    key={emp.id}
                                    onClick={() => {
                                        onInvite(emp.id, emp.full_name, emp.avatar_url)
                                        onClose()
                                    }}
                                    className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-all group border border-transparent hover:border-white/5"
                                >
                                    <EmployeeAvatar
                                        avatarUrl={emp.avatar_url}
                                        fullName={emp.full_name}
                                        className="w-10 h-10 border border-white/10"
                                    />
                                    <div className="flex-1 text-left">
                                        <p className="text-sm font-semibold text-white group-hover:text-indigo-400 transition-colors uppercase">{emp.full_name}</p>
                                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">{emp.role || 'Employé'}</p>
                                    </div>
                                    <div className="p-2 bg-indigo-500/10 rounded-xl group-hover:bg-indigo-500 text-indigo-400 group-hover:text-white transition-all transform scale-90 group-hover:scale-100">
                                        <UserPlus className="w-4 h-4" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-950/80 border-t border-white/5 text-center">
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest">Seuls les employés disponibles sont affichés</p>
                </div>
            </div>
        </div>
    )
}
