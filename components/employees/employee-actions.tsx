'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MessageSquare, Phone, Video, Loader2 } from 'lucide-react'
import { startConversation } from '@/app/(main)/messages/actions'
import { useCall } from '@/components/chat/call-manager'

interface EmployeeActionsProps {
    employeeId: string
    employeeName: string
    employeeAvatar: string | null
}

export default function EmployeeActions({ employeeId, employeeName, employeeAvatar }: EmployeeActionsProps) {
    const router = useRouter()
    const { startCall } = useCall()
    const [loading, setLoading] = useState(false)
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [dropdownRef])

    const handleStartChat = async () => {
        setLoading(true)
        try {
            const conversationId = await startConversation(employeeId)
            if (conversationId) {
                router.push(`/messages/${conversationId}`)
            }
        } catch (error) {
            console.error('Failed to start chat:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleStartCall = async (type: 'audio' | 'video') => {
        setLoading(true)
        setIsMenuOpen(false)
        try {
            const conversationId = await startConversation(employeeId)
            if (conversationId) {
                startCall(conversationId, employeeId, employeeName, employeeAvatar, type)
            }
        } catch (error) {
            console.error('Failed to start call:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex items-center justify-end gap-2" ref={dropdownRef}>
            <button
                onClick={handleStartChat}
                disabled={loading}
                className="p-2 h-9 w-9 flex items-center justify-center rounded-full hover:bg-indigo-50 text-indigo-500 hover:text-indigo-600 dark:hover:bg-indigo-900/20 dark:text-indigo-400 transition-all duration-200 disabled:opacity-50"
                title="Démarrer une discussion"
            >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
            </button>

            <div className="relative">
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    disabled={loading}
                    className="p-2 h-9 w-9 flex items-center justify-center rounded-full hover:bg-emerald-50 text-emerald-500 hover:text-emerald-600 dark:hover:bg-emerald-900/20 dark:text-emerald-400 transition-all duration-200 disabled:opacity-50"
                    title="Appeler"
                >
                    <Phone className="h-4 w-4" />
                </button>

                {isMenuOpen && (
                    <div className="absolute right-0 mt-2 w-40 p-1 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl z-50 animate-in slide-in-from-top-2 duration-200">
                        <button
                            onClick={() => handleStartCall('audio')}
                            className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg text-gray-600 dark:text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400 transition-colors"
                        >
                            <Phone className="h-3.5 w-3.5" />
                            Appel audio
                        </button>
                        <button
                            onClick={() => handleStartCall('video')}
                            className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg text-gray-600 dark:text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-400 transition-colors"
                        >
                            <Video className="h-3.5 w-3.5" />
                            Appel vidéo
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
