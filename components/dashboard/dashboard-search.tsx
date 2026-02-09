'use client'

import { useState, useEffect, useRef } from 'react'
import { searchDashboard } from '@/app/actions/dashboard-actions'
import { Search, X, Briefcase, Users, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function DashboardSearch() {
    const [isOpen, setIsOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<any>({ projects: [], employees: [] })
    const [loading, setLoading] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()

    // Keyboard shortcut (Ctrl+K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault()
                setIsOpen(true)
            }
            if (e.key === 'Escape') {
                setIsOpen(false)
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [])

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus()
        }
    }, [isOpen])

    // Debounced search
    useEffect(() => {
        if (query.length < 2) {
            setResults({ projects: [], employees: [] })
            return
        }

        setLoading(true)
        const timer = setTimeout(async () => {
            try {
                const data = await searchDashboard(query)
                setResults(data)
            } catch (error) {
                console.error('Search error:', error)
            } finally {
                setLoading(false)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [query])

    const handleClose = () => {
        setIsOpen(false)
        setQuery('')
        setResults({ projects: [], employees: [] })
    }

    const handleResultClick = (href: string) => {
        handleClose()
        router.push(href)
    }

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-gray-600 hover:text-gray-900 group"
            >
                <Search className="h-4 w-4" />
                <span className="text-sm font-medium">Recherche rapide...</span>
                <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-200 rounded text-xs font-mono text-gray-500">
                    Ctrl+K
                </kbd>
            </button>
        )
    }

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 animate-in fade-in duration-200"
                onClick={handleClose}
            />

            {/* Search Modal */}
            <div className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 px-4 animate-in slide-in-from-top-4 duration-300">
                <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                    {/* Search Input */}
                    <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
                        <Search className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Rechercher des projets ou des employés..."
                            className="flex-1 outline-none text-base text-gray-900 placeholder-gray-400"
                        />
                        {loading && <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />}
                        <button
                            onClick={handleClose}
                            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="h-4 w-4 text-gray-400" />
                        </button>
                    </div>

                    {/* Results */}
                    <div className="max-h-96 overflow-y-auto">
                        {query.length < 2 ? (
                            <div className="px-4 py-8 text-center text-sm text-gray-400">
                                Tapez au moins deux lettres pour rechercher
                            </div>
                        ) : results.projects.length === 0 && results.employees.length === 0 && !loading ? (
                            <div className="px-4 py-8 text-center text-sm text-gray-400">
                                Aucun résultat trouvé
                            </div>
                        ) : (
                            <div className="py-2">
                                {/* Projects */}
                                {results.projects.length > 0 && (
                                    <div className="mb-2">
                                        <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                            Projets
                                        </div>
                                        {results.projects.map((project: any) => (
                                            <button
                                                key={project.id}
                                                onClick={() => handleResultClick(`/projects/${project.id}`)}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                                            >
                                                <div className="p-2 bg-indigo-50 rounded-lg">
                                                    <Briefcase className="h-4 w-4 text-indigo-600" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-gray-900 truncate">
                                                        {project.project_name}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className={`text-xs px-2 py-0.5 rounded-full ${project.status === 'completed' ? 'bg-indigo-100 text-indigo-700' :
                                                            project.status === 'in_progress' ? 'bg-emerald-100 text-emerald-700' :
                                                                'bg-amber-100 text-amber-700'
                                                            }`}>
                                                            {project.status === 'in_progress' ? 'En cours' :
                                                                project.status === 'completed' ? 'Terminé' : 'En attente'}
                                                        </span>
                                                        <span className="text-xs text-gray-500">
                                                            {Math.round(project.progress)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Employees */}
                                {results.employees.length > 0 && (
                                    <div>
                                        <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                            Employés
                                        </div>
                                        {results.employees.map((employee: any) => (
                                            <button
                                                key={employee.id}
                                                onClick={() => handleResultClick(`/employees/${employee.id}`)}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                                            >
                                                <div className="p-2 bg-purple-50 rounded-lg">
                                                    <Users className="h-4 w-4 text-purple-600" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-gray-900 truncate">
                                                        {employee.full_name}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {employee.role}
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded font-mono">↑</kbd>
                                <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded font-mono">↓</kbd>
                                <span>Pour naviguer</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded font-mono">ESC</kbd>
                                <span>Pour fermer</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
