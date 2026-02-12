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
        <div className="max-w-7xl mx-auto space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <div className="flex items-center gap-3 mb-2 text-indigo-600 font-semibold">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            <Monitor className="w-5 h-5" />
                        </div>
                        <span className="text-sm tracking-wider uppercase">Administration</span>
                    </div>
                    <h1 className="text-3xl font-black text-gray-900">Enregistrements d'appels</h1>
                    <p className="text-gray-500 mt-1">Consultez, écoutez et visionnez tous les appels enregistrés du système.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Rechercher par nom..."
                            className="pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 w-64 text-gray-900"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <select
                        className="px-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 text-gray-900"
                        value={filterType}
                        onChange={(e: any) => setFilterType(e.target.value)}
                    >
                        <option value="all">Tous les types</option>
                        <option value="audio">Audio uniquement</option>
                        <option value="video">Vidéo uniquement</option>
                    </select>
                </div>
            </div>

            {/* Content Area */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-gray-500 font-medium animate-pulse text-gray-900">Chargement des enregistrements...</p>
                </div>
            ) : filteredLogs.length === 0 ? (
                <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-20 text-center">
                    <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FileVideo className="w-10 h-10 text-gray-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Aucun enregistrement trouvé</h3>
                    <p className="text-gray-500">Les nouveaux appels apparaîtront ici dès qu'ils seront terminés.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* List */}
                    <div className="lg:col-span-2 space-y-4">
                        {filteredLogs.map((log) => (
                            <div
                                key={log.id}
                                onClick={() => setSelectedCall(log)}
                                className={`group relative bg-white rounded-2xl p-5 border transition-all cursor-pointer ${selectedCall?.id === log.id ? 'border-indigo-600 shadow-md ring-1 ring-indigo-600' : 'border-gray-100 hover:border-indigo-200 hover:shadow-sm'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-4 rounded-xl shadow-sm ${log.type === 'video' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                        {log.type === 'video' ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-gray-900 truncate">
                                                {log.conversation?.is_group ? log.conversation.name : log.caller?.full_name}
                                            </span>
                                            {log.conversation?.is_group && (
                                                <span className="px-2 py-0.5 bg-gray-100 text-[10px] font-bold text-gray-500 rounded-md uppercase tracking-wider">Groupe</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-gray-500 font-medium">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {format(new Date(log.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5" />
                                                {formatDuration(log.duration)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-indigo-600 transition-colors">
                                            <Download className="w-5 h-5" />
                                        </button>
                                        <ChevronRight className={`w-5 h-5 transition-transform ${selectedCall?.id === log.id ? 'rotate-90 text-indigo-600' : 'text-gray-300'}`} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Preview Panel */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden sticky top-32">
                            {selectedCall ? (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                                    <div className="p-6 bg-gray-50 border-b border-gray-100">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="font-bold text-gray-900">Détails de l'appel</h3>
                                            <button
                                                onClick={() => setSelectedCall(null)}
                                                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                                            >
                                                <X className="w-4 h-4 text-gray-500" />
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-4 mb-6">
                                            <EmployeeAvatar
                                                avatarUrl={selectedCall.caller?.avatar_url}
                                                fullName={selectedCall.caller?.full_name}
                                                className="w-16 h-16 ring-4 ring-white shadow-md"
                                            />
                                            <div>
                                                <p className="font-black text-gray-900 text-lg">{selectedCall.caller?.full_name}</p>
                                                <p className="text-sm text-gray-500">{selectedCall.caller?.role || 'Employé'}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Durée</p>
                                                <p className="font-black text-indigo-600 text-xl">{formatDuration(selectedCall.duration)}</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Type</p>
                                                <p className="font-black text-gray-900 text-xl capitalize">{selectedCall.type}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-6 space-y-6">
                                        <div className="aspect-video bg-gray-950 rounded-2xl overflow-hidden shadow-inner relative group">
                                            {selectedCall.signed_url ? (
                                                <video
                                                    key={selectedCall.id}
                                                    src={selectedCall.signed_url}
                                                    controls
                                                    className="w-full h-full object-contain"
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm">
                                                    <MicOff className="w-10 h-10 mb-2 opacity-20" />
                                                    Enregistrement audio uniquement
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-3 pt-4">
                                            <a
                                                href={selectedCall.signed_url}
                                                download
                                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-indigo-100"
                                            >
                                                <Download className="w-5 h-5" />
                                                Télécharger le MP4
                                            </a>
                                            <button className="w-full bg-white hover:bg-red-50 text-red-600 border border-red-100 font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all">
                                                <Trash2 className="w-5 h-5" />
                                                Supprimer définitivement
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-12 text-center text-gray-400">
                                    <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Volume2 className="w-8 h-8" />
                                    </div>
                                    <p className="text-sm font-medium">Sélectionnez un appel pour voir les détails et lire l'enregistrement.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
