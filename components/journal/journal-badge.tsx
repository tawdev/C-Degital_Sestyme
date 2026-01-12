'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getUnvalidatedNotesCount, getUnvalidatedNotes } from './actions'
import { Bell } from 'lucide-react'

interface JournalBadgeProps {
    initialCount: number
    userId: string
    ownedProjectIds: string[] | 'ADMIN'
}

export default function JournalBadge({ initialCount, userId, ownedProjectIds }: JournalBadgeProps) {
    const [count, setCount] = useState(initialCount)
    const supabase = createClient()

    // track refs to avoid re-subscribing
    const ownedProjectsRef = useRef(ownedProjectIds)

    useEffect(() => {
        ownedProjectsRef.current = ownedProjectIds
    }, [ownedProjectIds])

    useEffect(() => {
        // Sync initial count just in case
        setCount(initialCount)
    }, [initialCount])

    useEffect(() => {
        // Subscribe to project_notes changes
        const channel = supabase
            .channel(`journal_badges_${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'project_notes'
                },
                (payload) => {
                    const event = payload.eventType
                    const newRecord = payload.new as any
                    const oldRecord = payload.old as any

                    // Filter Logic:
                    // 1. If ADMIN, listen to everything.
                    // 2. If Project Owner, check if project_id is in ownedProjectsRef.

                    const isAdmin = ownedProjectsRef.current === 'ADMIN'
                    const projectId = newRecord?.project_id || oldRecord?.project_id

                    const isRelevant = isAdmin || (
                        projectId &&
                        Array.isArray(ownedProjectsRef.current) &&
                        ownedProjectsRef.current.includes(projectId)
                    )

                    if (!isRelevant) return

                    // Logic for Badge Count Updates
                    // INSERT: If validated_at is null -> +1
                    if (event === 'INSERT') {
                        if (!newRecord.validated_at) {
                            setCount(c => c + 1)
                        }
                    }
                    // UPDATE: 
                    // - If old was unvalidated (null) and new is validated (not null) -> -1
                    // - If old was validated (not null) and new is unvalidated (null) -> +1
                    else if (event === 'UPDATE') {
                        const wasValidated = !!oldRecord.validated_at
                        const isValidated = !!newRecord.validated_at

                        if (!wasValidated && isValidated) {
                            setCount(c => Math.max(0, c - 1))
                        } else if (wasValidated && !isValidated) {
                            setCount(c => c + 1)
                        }
                    }
                    // DELETE: If old was unvalidated -> -1
                    else if (event === 'DELETE') {
                        // Note: oldRecord usually only contains ID for delete if replica identity not full. 
                        // But we can optimistically try. If we don't know status, fetching from server safely is better.
                        // However, we can't easily fetch just one deleted record status.
                        // Ideally, we re-fetch the count to be safe on DELETE.
                        // Or, we assume if we are receiving this event, we might decrement.
                        // Safe approach: Re-fetch count.
                        getUnvalidatedNotesCount().then(c => setCount(c))
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [userId, supabase])

    const [isOpen, setIsOpen] = useState(false)
    const [notes, setNotes] = useState<any[]>([])
    const [loadingNotes, setLoadingNotes] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [dropdownRef])

    const handleToggle = async () => {
        const newState = !isOpen
        setIsOpen(newState)

        if (newState) {
            setLoadingNotes(true)
            try {
                const data = await getUnvalidatedNotes()
                setNotes(data)
            } catch (err) {
                console.error("Failed to fetch notes", err)
            } finally {
                setLoadingNotes(false)
            }
        }
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <div
                className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer"
                onClick={handleToggle}
            >
                <Bell className="h-5 w-5" />
            </div>
            {count > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white animate-in zoom-in duration-300 pointer-events-none">
                    {count > 99 ? '99+' : count}
                </span>
            )}

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl shadow-indigo-900/10 border border-gray-100 overflow-hidden z-[100] animate-in slide-in-from-top-2 duration-200">
                    <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                        <h3 className="font-bold text-gray-900 text-xs uppercase tracking-widest">Notifications</h3>
                        <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{count} Pending</span>
                    </div>

                    <div className="max-h-[320px] overflow-y-auto">
                        {loadingNotes ? (
                            <div className="p-8 text-center text-gray-400 text-xs">Loading...</div>
                        ) : notes.length > 0 ? (
                            <div className="divide-y divide-gray-50">
                                {notes.map((note) => (
                                    <a
                                        key={note.id}
                                        href={`/projects/${note.project_id}`}
                                        className="block p-4 hover:bg-gray-50 transition-colors group"
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-bold text-xs text-indigo-600 group-hover:text-indigo-700">
                                                {note.projects?.project_name || 'Unknown Project'}
                                            </span>
                                            <span className="text-[10px] text-gray-400">
                                                {new Date(note.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                                            {note.content}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <div className="h-4 w-4 rounded-full bg-gray-100 flex items-center justify-center text-[8px] font-bold text-gray-500">
                                                {note.author?.full_name?.[0] || '?'}
                                            </div>
                                            <span className="text-[10px] text-gray-400 font-medium">
                                                {note.author?.full_name || 'Unknown'} asks for validation
                                            </span>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-gray-400 text-xs">
                                No unvalidated notes found.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
