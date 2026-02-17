'use client'

import React, { useEffect, useState } from 'react'
import { getCallLogs } from '@/app/(main)/chat/actions'
import {
    Phone, Video, Calendar, Clock, User, Play, Pause,
    Download, Trash2, Search, Filter, Monitor, FileVideo,
    ChevronRight, ArrowLeft, MoreVertical, X,
    MonitorOff,
    MicOff,
    Volume2
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import EmployeeAvatar from '@/components/employee-avatar'

export default function CallsDashboard() {
    const [logs, setLogs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterType, setFilterType] = useState<'all' | 'audio' | 'video'>('all')
    const [selectedCall, setSelectedCall] = useState<any>(null)

    useEffect(() => {
        loadLogs()
    }, [])

    async function loadLogs() {
        setLoading(true)
        const res = await getCallLogs()
        if (res.success) {
            setLogs(res.logs)
        }
        setLoading(false)
    }

    const filteredLogs = logs.filter(log => {
        const matchesSearch = log.caller?.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.conversation?.name?.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesType = filterType === 'all' || log.type === filterType
        return matchesSearch && matchesType
    })

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    return (
        <div className="max-w-7xl mx-auto space-y-10 pb-12 transition-colors duration-500">
            {/* Header section with rich aesthetics */}
            <div className="relative overflow-hidden bg-white/70 dark:bg-white/5 backdrop-blur-2xl p-8 md:p-12 rounded-[2.5rem] border border-gray-200 dark:border-white/10 shadow-2xl shadow-indigo-900/5">
                {/* Background decorative elements */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-50 dark:bg-indigo-600/10 rounded-full blur-3xl opacity-50" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-50 dark:bg-purple-600/10 rounded-full blur-3xl opacity-50" />

                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 font-black">
                            <div className="p-2.5 bg-indigo-50 dark:bg-white/5 rounded-2xl shadow-sm border border-transparent dark:border-white/10">
                                <Monitor className="w-5 h-5" />
                            </div>
                            <span className="text-xs tracking-[0.2em] uppercase">Administration System</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-gray-900 dark:text-white tracking-tight">Historique des Appels</h1>
                        <p className="text-gray-500 dark:text-indigo-200/60 max-w-lg font-medium text-lg">Consultez, écoutez et visionnez tous les échanges enregistrés avec une clarté absolue.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative flex-1 sm:flex-none group">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Rechercher..."
                                className="pl-12 pr-4 py-4 bg-gray-50/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:bg-white dark:focus:bg-white/10 transition-all text-gray-900 dark:text-white placeholder:text-gray-400 w-full sm:w-64"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="relative w-full sm:w-auto">
                            <Filter className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            <select
                                className="pl-12 pr-10 py-4 bg-gray-50/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:bg-white dark:focus:bg-white/10 transition-all text-gray-900 dark:text-white appearance-none cursor-pointer w-full"
                                value={filterType}
                                onChange={(e: any) => setFilterType(e.target.value)}
                            >
                                <option value="all">Tous les types</option>
                                <option value="audio">Audio uniquement</option>
                                <option value="video">Vidéo uniquement</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 bg-white/50 dark:bg-white/5 backdrop-blur-xl rounded-[2.5rem] border border-dashed border-gray-200 dark:border-white/10">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-indigo-600/10 dark:border-white/5 rounded-full" />
                        <div className="absolute inset-0 w-16 h-16 border-4 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <p className="text-gray-900 dark:text-white font-black uppercase tracking-widest text-[10px] mt-8 animate-pulse">Synchronisation des enregistrements...</p>
                </div>
            ) : filteredLogs.length === 0 ? (
                <div className="bg-white/50 dark:bg-white/5 backdrop-blur-xl rounded-[2.5rem] border border-dashed border-gray-200 dark:border-white/10 p-20 text-center">
                    <div className="bg-gray-50 dark:bg-white/5 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                        <FileVideo className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                    </div>
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3 tracking-tight">Aucun enregistrement trouvé</h3>
                    <p className="text-gray-500 dark:text-indigo-200/40 max-w-sm mx-auto font-medium">Les nouveaux appels apparaîtront ici dès qu'ils seront terminés.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* List */}
                    <div className="lg:col-span-2 space-y-4">
                        {filteredLogs.map((log) => (
                            <div
                                key={log.id}
                                onClick={() => setSelectedCall(log)}
                                className={`group relative bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-[2rem] p-6 border transition-all cursor-pointer overflow-hidden ${selectedCall?.id === log.id
                                    ? 'border-indigo-600 dark:border-indigo-500 shadow-xl shadow-indigo-900/10 ring-1 ring-indigo-600 dark:ring-indigo-500'
                                    : 'border-transparent hover:border-indigo-100 dark:hover:border-white/10 hover:shadow-2xl shadow-indigo-900/5'}`}
                            >
                                <div className="flex items-center gap-5">
                                    <div className={`p-4 rounded-[1.2rem] shadow-sm shrink-0 border transition-colors ${log.type === 'video'
                                        ? 'bg-purple-50 dark:bg-purple-400/10 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-400/20'
                                        : 'bg-blue-50 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-400/20'}`}>
                                        {log.type === 'video' ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`text-lg font-black truncate transition-colors ${selectedCall?.id === log.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-white'}`}>
                                                {log.conversation?.is_group ? log.conversation.name : log.caller?.full_name}
                                            </span>
                                            {log.conversation?.is_group && (
                                                <span className="px-3 py-1 bg-gray-100 dark:bg-white/10 text-[9px] font-black text-gray-500 dark:text-gray-400 rounded-lg uppercase tracking-widest border border-gray-200 dark:border-white/5">Groupe</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-6 text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                                                {format(new Date(log.created_at), "d MMMM yyyy", { locale: fr })}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                                                {formatDuration(log.duration)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 transition-all group-hover:translate-x-0 sm:translate-x-4 opacity-0 group-hover:opacity-100">
                                        <button className="p-3 bg-gray-50 dark:bg-white/5 hover:bg-indigo-50 dark:hover:bg-indigo-400/10 rounded-xl text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 border border-transparent hover:border-indigo-100 dark:hover:border-indigo-400/20 transition-all">
                                            <Download className="w-5 h-5" />
                                        </button>
                                        <ChevronRight className={`w-6 h-6 transition-all ${selectedCall?.id === log.id ? 'rotate-90 text-indigo-600 dark:text-indigo-400 scale-125' : 'text-gray-200 dark:text-white/5'}`} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Preview Panel */}
                    <div className="lg:col-span-1">
                        {/* Preview Panel with Glassmorphism */}
                        <div className="lg:col-span-1">
                            <div className="bg-white/70 dark:bg-white/5 backdrop-blur-2xl rounded-[2.5rem] border border-gray-100 dark:border-white/10 shadow-2xl shadow-indigo-900/10 overflow-hidden sticky top-32 transition-colors">
                                {selectedCall ? (
                                    <div className="animate-in fade-in slide-in-from-right-8 duration-700">
                                        <div className="p-8 bg-gray-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5">
                                            <div className="flex items-center justify-between mb-8">
                                                <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">Détails de l'appel</h3>
                                                <button
                                                    onClick={() => setSelectedCall(null)}
                                                    className="p-3 bg-white dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20 rounded-full transition-all border border-gray-100 dark:border-white/10 shadow-sm"
                                                >
                                                    <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                                </button>
                                            </div>

                                            <div className="flex items-center gap-5 mb-8">
                                                <EmployeeAvatar
                                                    avatarUrl={selectedCall.caller?.avatar_url}
                                                    fullName={selectedCall.caller?.full_name}
                                                    className="w-20 h-20 ring-4 ring-white dark:ring-white/10 shadow-2xl"
                                                />
                                                <div className="space-y-1">
                                                    <p className="font-black text-gray-900 dark:text-white text-xl tracking-tight">{selectedCall.caller?.full_name}</p>
                                                    <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{selectedCall.caller?.role || 'Membre de l\'équipe'}</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-white/50 dark:bg-white/5 backdrop-blur-sm p-5 rounded-[1.5rem] border border-white dark:border-white/10 shadow-inner">
                                                    <p className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Durée</p>
                                                    <p className="font-black text-indigo-600 dark:text-indigo-400 text-2xl tracking-tighter">{formatDuration(selectedCall.duration)}</p>
                                                </div>
                                                <div className="bg-white/50 dark:bg-white/5 backdrop-blur-sm p-5 rounded-[1.5rem] border border-white dark:border-white/10 shadow-inner">
                                                    <p className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Format</p>
                                                    <p className="font-black text-gray-900 dark:text-white text-2xl capitalize tracking-tighter">{selectedCall.type}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-8 space-y-8">
                                            <div className="aspect-video bg-gray-950 rounded-[2rem] overflow-hidden shadow-2xl relative group ring-1 ring-white/10">
                                                {selectedCall.signed_url ? (
                                                    <video
                                                        key={selectedCall.id}
                                                        src={selectedCall.signed_url}
                                                        controls
                                                        className="w-full h-full object-contain"
                                                    />
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8 text-center">
                                                        <div className="bg-white/5 p-5 rounded-full mb-4">
                                                            <MicOff className="w-10 h-10 opacity-40 text-gray-400" />
                                                        </div>
                                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600">Enregistrement audio</p>
                                                        <p className="text-xs font-medium text-gray-700 mt-2">Visuel non disponible</p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-4">
                                                <a
                                                    href={selectedCall.signed_url}
                                                    download
                                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-[1.5rem] flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-xl shadow-indigo-900/20 uppercase tracking-widest text-xs"
                                                >
                                                    <Download className="w-5 h-5" />
                                                    Télécharger l'archive
                                                </a>
                                                <button className="w-full bg-white dark:bg-white/5 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20 font-black py-5 rounded-[1.5rem] flex items-center justify-center gap-3 transition-all uppercase tracking-widest text-xs">
                                                    <Trash2 className="w-5 h-5" />
                                                    Supprimer l'archive
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-16 text-center animate-in fade-in duration-500">
                                        <div className="bg-indigo-50 dark:bg-indigo-400/10 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner border border-transparent dark:border-indigo-400/20">
                                            <Volume2 className="w-10 h-10 text-indigo-400 dark:text-indigo-500 animate-pulse" />
                                        </div>
                                        <h4 className="text-gray-900 dark:text-white font-black text-lg mb-2 tracking-tight">Lecteur inactif</h4>
                                        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 max-w-[200px] mx-auto leading-relaxed">Veuillez sélectionner un enregistrement pour activer les contrôles multimédias.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
