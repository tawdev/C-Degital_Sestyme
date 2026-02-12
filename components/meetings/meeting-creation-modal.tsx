'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Video, Users, Loader2, Check, Calendar, Clock, Type, AlignLeft } from 'lucide-react'
import { createMeeting, getEmployees } from '@/app/(main)/chat/actions'
import EmployeeAvatar from '@/components/employee-avatar'
import { useRouter } from 'next/navigation'

interface MeetingCreationModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function MeetingCreationModal({ isOpen, onClose }: MeetingCreationModalProps) {
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [scheduledAt, setScheduledAt] = useState('')
    const [type, setType] = useState<'audio' | 'video'>('video')
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [employees, setEmployees] = useState<any[]>([])
    const [loadingEmployees, setLoadingEmployees] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    useEffect(() => {
        if (isOpen) {
            loadEmployees()
            // Initialize with a default time: 30 minutes from now
            const now = new Date()
            now.setMinutes(now.getMinutes() + 30)
            now.setSeconds(0, 0)

            // Format for datetime-local: YYYY-MM-DDTHH:mm
            const year = now.getFullYear()
            const month = String(now.getMonth() + 1).padStart(2, '0')
            const day = String(now.getDate()).padStart(2, '0')
            const hours = String(now.getHours()).padStart(2, '0')
            const minutes = String(now.getMinutes()).padStart(2, '0')

            setScheduledAt(`${year}-${month}-${day}T${hours}:${minutes}`)
        }
    }, [isOpen])

    async function loadEmployees() {
        setLoadingEmployees(true)
        try {
            const data = await getEmployees()
            setEmployees(data)
        } catch (err) {
            console.error('Error loading employees:', err)
        } finally {
            setLoadingEmployees(false)
        }
    }

    if (!isOpen) return null

    const toggleUser = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    const handleCreate = async () => {
        if (!title.trim()) return setError('Veuillez entrer un titre pour la réunion')
        if (selectedIds.length === 0) return setError('Veuillez sélectionner au moins un participant')

        setSubmitting(true)
        setError(null)

        try {
            const formData = new FormData()
            formData.append('title', title)
            formData.append('description', description)

            // Convert to ISO string for storage - ensures accuracy across timezones
            const dateObj = new Date(scheduledAt)

            // Simple validation: must be a valid date and must be in the future (with 1min grace)
            if (isNaN(dateObj.getTime())) {
                setSubmitting(false)
                return setError('Date/Heure invalide')
            }
            if (dateObj.getTime() < Date.now() - 60000) {
                setSubmitting(false)
                return setError('La réunion doit être prévue dans le futur')
            }

            formData.append('scheduledAt', dateObj.toISOString())
            formData.append('type', type)
            formData.append('userIds', JSON.stringify(selectedIds))

            const res = await createMeeting(formData)
            if (res.error) {
                setError(res.error)
            } else {
                router.refresh()
                onClose()
            }
        } catch (err) {
            setError('Une erreur inattendue est survenue')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-3 text-indigo-600">
                        <div className="p-2 bg-indigo-100 rounded-xl">
                            <Video className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-gray-900 leading-tight">Nouvelle Réunion</h3>
                            <p className="text-xs text-gray-500 font-medium tracking-tight">Planifiez ou démarrez une réunion instantanée</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 flex-1 overflow-y-auto space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Left Column: Details */}
                        <div className="space-y-6">
                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
                                    <Type className="w-3.5 h-3.5" />
                                    Titre de la réunion
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="ex: Réunion d'équipe hebdomadaire"
                                    className="w-full px-5 py-3.5 bg-gray-50 border border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm text-gray-900 font-medium placeholder:text-gray-400 shadow-sm"
                                />
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
                                    <AlignLeft className="w-3.5 h-3.5" />
                                    Description (Optionnel)
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="De quoi allons-nous parler ?"
                                    rows={3}
                                    className="w-full px-5 py-3.5 bg-gray-50 border border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm text-gray-900 font-medium placeholder:text-gray-400 shadow-sm resize-none"
                                />
                            </div>

                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 ml-1">
                                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                                    Planification
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="relative group/input">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/input:text-indigo-500 transition-colors pointer-events-none">
                                            <Calendar className="w-4 h-4" />
                                        </div>
                                        <input
                                            type="date"
                                            value={scheduledAt.split('T')[0] || ''}
                                            onChange={(e) => {
                                                const time = scheduledAt.split('T')[1] || '12:00'
                                                setScheduledAt(`${e.target.value}T${time}`)
                                            }}
                                            className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-sm font-bold text-gray-900 shadow-sm"
                                        />
                                    </div>
                                    <div className="relative group/input">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/input:text-indigo-500 transition-colors pointer-events-none">
                                            <Clock className="w-4 h-4" />
                                        </div>
                                        <input
                                            type="time"
                                            lang="fr-FR"
                                            step="60"
                                            value={scheduledAt.split('T')[1] || ''}
                                            onChange={(e) => {
                                                const date = scheduledAt.split('T')[0] || new Date().toISOString().split('T')[0]
                                                setScheduledAt(`${date}T${e.target.value}`)
                                            }}
                                            className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-sm font-bold text-gray-900 shadow-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">
                                    <Video className="w-3.5 h-3.5 text-indigo-500" />
                                    Mode de communication
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setType('video')}
                                        className={`flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all ${type === 'video' ? 'border-indigo-600 bg-indigo-50 text-indigo-600 shadow-md' : 'border-gray-50 bg-gray-50 text-gray-500 hover:border-gray-200 hover:bg-white'}`}
                                    >
                                        <Video className="w-5 h-5" />
                                        <span className="text-xs font-black uppercase tracking-widest text-center">Vidéo + Audio</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setType('audio')}
                                        className={`flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all ${type === 'audio' ? 'border-indigo-600 bg-indigo-50 text-indigo-600 shadow-md' : 'border-gray-50 bg-gray-50 text-gray-500 hover:border-gray-200 hover:bg-white'}`}
                                    >
                                        <Clock className="w-5 h-5" />
                                        <span className="text-xs font-black uppercase tracking-widest text-center">Audio Seul</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Participants */}
                        <div className="flex flex-col h-[400px]">
                            <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">
                                <Users className="w-3.5 h-3.5" />
                                Inviter des participants ({selectedIds.length})
                            </label>
                            <div className="flex-1 bg-gray-50/50 rounded-2xl border border-gray-100 overflow-y-auto p-2 space-y-1">
                                {loadingEmployees ? (
                                    <div className="flex items-center justify-center h-full">
                                        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                                    </div>
                                ) : (
                                    employees.map((emp) => (
                                        <button
                                            key={emp.id}
                                            onClick={() => toggleUser(emp.id)}
                                            className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all border ${selectedIds.includes(emp.id)
                                                ? 'bg-white border-indigo-100 shadow-sm'
                                                : 'border-transparent hover:bg-white hover:shadow-sm'
                                                }`}
                                        >
                                            <div className="relative">
                                                <EmployeeAvatar
                                                    avatarUrl={emp.avatar_url}
                                                    fullName={emp.full_name}
                                                    className="w-10 h-10 ring-2 ring-transparent group-hover:ring-indigo-100"
                                                />
                                                {selectedIds.includes(emp.id) && (
                                                    <div className="absolute -top-1 -right-1 bg-indigo-600 text-white rounded-full p-0.5 shadow-sm">
                                                        <Check className="w-3 h-3" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 text-left min-w-0">
                                                <p className="text-sm font-bold text-gray-900 truncate uppercase tracking-tight">
                                                    {emp.full_name}
                                                </p>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{emp.role || 'Employé'}</p>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-gray-50 border-t border-gray-100">
                    {error && (
                        <div className="bg-red-50 text-red-600 text-xs font-bold py-3 px-4 rounded-xl mb-4 flex items-center gap-2 border border-red-100 animate-in slide-in-from-top-2">
                            <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
                            {error}
                        </div>
                    )}
                    <div className="flex gap-4">
                        <button
                            onClick={onClose}
                            className="flex-1 py-4 bg-white text-gray-600 rounded-2xl font-bold border border-gray-200 hover:bg-gray-50 transition-all active:scale-[0.98]"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={submitting || !title.trim() || selectedIds.length === 0}
                            className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                        >
                            {submitting ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <>
                                    <Video className="w-6 h-6" />
                                    <span className="uppercase tracking-widest text-sm">Organiser la réunion</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
