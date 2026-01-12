'use client'

import { useState, useEffect, useRef } from 'react'
import { X, UserPlus, Trash2, Loader2, Save, User as UserIcon, Image as ImageIcon } from 'lucide-react'
import { updateGroupDetails, addGroupMembers, removeGroupMember, getEmployees } from '@/app/(main)/chat/actions'
import EmployeeAvatar from '@/components/employee-avatar'

interface GroupSettingsModalProps {
    isOpen: boolean
    onClose: () => void
    conversationId: string
    groupName: string
    members: any[]
}

export default function GroupSettingsModal({ isOpen, onClose, conversationId, groupName, members }: GroupSettingsModalProps) {
    const [name, setName] = useState(groupName)
    const [allEmployees, setAllEmployees] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [selectedAvatar, setSelectedAvatar] = useState<File | null>(null)
    const avatarInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isOpen) {
            setName(groupName)
            loadEmployees()
        }
    }, [isOpen, groupName])

    useEffect(() => {
        if (members.length > 0 && allEmployees.length > 0) {
            console.log('[Group Settings Debug] Members:', members.map(m => ({ id: m.id, name: m.full_name })))
            console.log('[Group Settings Debug] All Employees:', allEmployees.map(e => ({ id: e.id, name: e.full_name })))
        }
    }, [members, allEmployees])

    const loadEmployees = async () => {
        const emps = await getEmployees()
        setAllEmployees(emps)
    }

    if (!isOpen) return null

    const handleUpdateName = async () => {
        if ((!name.trim() || name === groupName) && !selectedAvatar) return
        setActionLoading('name')

        const formData = new FormData()
        formData.append('conversationId', conversationId)
        formData.append('name', name.trim())
        if (selectedAvatar) {
            formData.append('avatar', selectedAvatar)
        }

        const res = await updateGroupDetails(formData)
        if (res.error) {
            alert(res.error)
        } else {
            setSelectedAvatar(null) // Clear after successful upload
        }
        setActionLoading(null)
    }

    const handleRemoveMember = async (userId: string) => {
        if (members.length <= 1) {
            alert("Cannot remove the last member.")
            return
        }
        if (!confirm("Are you sure you want to remove this member?")) return

        setActionLoading(userId)
        const res = await removeGroupMember(conversationId, userId)
        if (res.error) alert(res.error)
        setActionLoading(null)
    }

    const handleAddMember = async (userId: string) => {
        setActionLoading('add-' + userId)
        const res = await addGroupMembers(conversationId, [userId])
        if (res.error) alert(res.error)
        setActionLoading(null)
    }

    const availableEmployees = allEmployees.filter(emp => {
        // Check if employee is already a member
        const isAlreadyMember = members.some(m => {
            // Handle both string and object member IDs
            const memberId = typeof m === 'string' ? m : m?.id
            const matches = memberId === emp.id

            if (matches) {
                console.log(`[Filter Debug] Excluding ${emp.full_name} (${emp.id}) - already member`)
            }

            return matches
        })

        // Check if name matches search
        const matchesSearch = emp.full_name?.toLowerCase().includes(search.toLowerCase())

        if (!isAlreadyMember && matchesSearch) {
            console.log(`[Filter Debug] Including ${emp.full_name} (${emp.id}) - not a member`)
        }

        return !isAlreadyMember && matchesSearch
    })

    console.log('[Filter Summary]', {
        totalEmployees: allEmployees.length,
        currentMembers: members.length,
        membersIds: members.map(m => m?.id || m),
        availableCount: availableEmployees.length
    })

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-indigo-50/50">
                    <h2 className="text-lg font-bold text-gray-900">Group Settings</h2>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors text-gray-500">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Rename Section */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Group Name</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ex: DIGITTA"
                                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <input
                                ref={avatarInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        setSelectedAvatar(e.target.files[0])
                                    }
                                }}
                            />
                            <button
                                onClick={() => avatarInputRef.current?.click()}
                                className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-colors"
                                title="Upload group image"
                            >
                                <ImageIcon className="h-4 w-4" />
                            </button>
                            <button
                                onClick={handleUpdateName}
                                disabled={actionLoading === 'name' || (name === groupName && !selectedAvatar) || (!name.trim() && !selectedAvatar)}
                                className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                                {actionLoading === 'name' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            </button>
                        </div>
                        {selectedAvatar && (
                            <p className="text-xs text-indigo-600 mt-1">
                                Image sélectionnée: {selectedAvatar.name}
                            </p>
                        )}
                    </div>

                    {/* Members List */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex justify-between">
                            <span>Current Members</span>
                            <span>{members.length}</span>
                        </label>
                        <div className="space-y-2">
                            {members.map(member => (
                                <div key={member.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <EmployeeAvatar avatarUrl={member.avatar_url} fullName={member.full_name} />
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-gray-900 truncate">{member.full_name}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveMember(member.id)}
                                        disabled={actionLoading === member.id}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                                    >
                                        {actionLoading === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Add Members Section */}
                    <div className="space-y-3 pt-4 border-t border-gray-100">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex justify-between">
                            <span>Add New Members</span>
                            <span className="text-indigo-600">{availableEmployees.length} disponible{availableEmployees.length !== 1 ? 's' : ''}</span>
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search employees..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none pl-10"
                            />
                            <UserPlus className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                            {availableEmployees.map(emp => (
                                <div key={emp.id} className="flex items-center justify-between p-2 hover:bg-indigo-50 rounded-xl transition-colors">
                                    <div className="flex items-center gap-3">
                                        <EmployeeAvatar avatarUrl={emp.avatar_url} fullName={emp.full_name} />
                                        <p className="text-sm font-medium text-gray-700">{emp.full_name}</p>
                                    </div>
                                    <button
                                        onClick={() => handleAddMember(emp.id)}
                                        disabled={actionLoading === 'add-' + emp.id}
                                        className="p-2 text-indigo-600 hover:bg-white rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {actionLoading === 'add-' + emp.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                                    </button>
                                </div>
                            ))}
                            {availableEmployees.length === 0 && search && (
                                <p className="text-center py-4 text-xs text-gray-500 italic">No matching employees found.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-100">
                    <button
                        onClick={onClose}
                        className="w-full bg-white border border-gray-200 text-gray-700 py-2 rounded-xl text-sm font-bold hover:bg-gray-100 transition-colors shadow-sm"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
