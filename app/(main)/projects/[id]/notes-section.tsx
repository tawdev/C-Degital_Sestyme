'use client'

import { useState } from 'react'
import { MessageSquare, Plus, Edit2, Trash2, CheckCircle2, X, Send } from 'lucide-react'
import { addNote, updateNote, deleteNote, validateNote } from './actions'

interface Note {
    id: string
    project_id: string
    author_id: string
    content: string
    created_at: string
    updated_at: string
    validated_at: string | null
    author?: {
        full_name: string
        role: string
    }
}

interface NotesSectionProps {
    projectId: string
    projectOwnerId: string | null
    currentUserId: string
    notes: Note[]
    notesValidatedAt: string | null // Keep for backward compat or remove if unused? Removing usage.
    isAdmin?: boolean
}

export default function NotesSection({
    projectId,
    projectOwnerId,
    currentUserId,
    notes,
    notesValidatedAt,
    isAdmin = false
}: NotesSectionProps) {
    const [isAddingNote, setIsAddingNote] = useState(false)
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
    const [editContent, setEditContent] = useState('')

    const isProjectOwner = projectOwnerId === currentUserId
    const canAddNote = !isAddingNote && (!isProjectOwner || isAdmin)

    return (
        <div className="bg-white rounded-3xl shadow-xl shadow-indigo-900/5 border border-gray-100 overflow-hidden pb-8">
            {/* Header */}
            <div className="bg-gray-50/50 px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-indigo-100/50 rounded-xl text-indigo-600">
                        <MessageSquare className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-black tracking-tight">
                            Journal de Bord ({notes.length})
                        </h2>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Suivi des interventions techniques</p>
                    </div>
                </div>

                {canAddNote && (
                    <button
                        onClick={() => setIsAddingNote(true)}
                        className="group inline-flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-indigo-600 transition-all text-xs font-black uppercase tracking-widest shadow-lg shadow-gray-900/10 active:scale-95"
                    >
                        <Plus className="h-4 w-4 group-hover:rotate-90 transition-transform" />
                        Ajouter une Note
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="px-8 pt-8 space-y-6">
                {/* Add Note Form */}
                {isAddingNote && (
                    <form
                        action={async (formData) => {
                            await addNote(formData);
                            setIsAddingNote(false);
                        }}
                        className="bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100 animate-in zoom-in-95 duration-300"
                    >
                        <input type="hidden" name="project_id" value={projectId} />
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest px-1">Nouvelle Intervention</label>
                            <textarea
                                name="content"
                                rows={3}
                                placeholder="Décrivez votre intervention ou remarque technique..."
                                required
                                className="w-full rounded-xl border border-indigo-100 bg-white px-5 py-4 text-black focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none font-medium placeholder:text-gray-400"
                            />
                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsAddingNote(false)}
                                    className="px-6 py-2.5 text-gray-500 hover:text-gray-800 transition-all text-xs font-black uppercase tracking-widest"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    className="inline-flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20"
                                >
                                    <Send className="h-4 w-4" />
                                    Publier
                                </button>
                            </div>
                        </div>
                    </form>
                )}

                {/* Notes List */}
                {notes.length > 0 ? (
                    <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-6 before:w-px before:bg-gray-50 before:hidden md:before:block">
                        {notes.map((note) => {
                            const isAuthor = note.author_id === currentUserId
                            const isEditing = editingNoteId === note.id
                            const isValidated = !!note.validated_at

                            return (
                                <div
                                    key={note.id}
                                    className="relative flex flex-col md:flex-row gap-6 animate-in slide-in-from-left-4 duration-500"
                                >
                                    {/* Author Mini Avatar */}
                                    <div className="hidden md:flex flex-shrink-0 h-12 w-12 bg-white border border-gray-100 rounded-2xl shadow-sm items-center justify-center z-10">
                                        <div className="h-8 w-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-[10px] font-black">
                                            {note.author?.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'UN'}
                                        </div>
                                    </div>

                                    {/* Note Bubble/Card */}
                                    <div className={`flex-1 rounded-3xl p-6 border transition-all ${isValidated
                                        ? 'bg-emerald-50/50 border-emerald-100/50'
                                        : 'bg-gray-50/50 border-gray-100 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-900/[0.02]'}`}>

                                        {/* Note Header */}
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex flex-col">
                                                <h4 className="text-sm font-black text-black tracking-tight">
                                                    {note.author?.full_name || 'Expert Anonyme'}
                                                </h4>
                                                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-tight">
                                                    <span>{note.author?.role || 'Contributor'}</span>
                                                    <span className="h-1 w-1 bg-gray-300 rounded-full" />
                                                    <span>{new Date(note.created_at).toLocaleDateString('fr-FR', {
                                                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                                    })}</span>
                                                    {note.updated_at !== note.created_at && <span className="text-indigo-400">(édité)</span>}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2">
                                                {isValidated ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-lg">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        Validé
                                                    </span>
                                                ) : (
                                                    <div className="flex gap-1">
                                                        {(isProjectOwner || isAdmin) && (
                                                            <form action={async (formData) => {
                                                                if (confirm('Clôturer le Journal ?\nLa validation verrouille le journal de bord et confirme l\'état actuel.')) {
                                                                    await validateNote(formData)
                                                                }
                                                            }}>
                                                                <input type="hidden" name="note_id" value={note.id} />
                                                                <input type="hidden" name="project_id" value={projectId} />
                                                                <button
                                                                    type="submit"
                                                                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-indigo-700 transition-all mr-2"
                                                                >
                                                                    Valider
                                                                </button>
                                                            </form>
                                                        )}

                                                        {isAuthor && !isEditing && (
                                                            <>
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingNoteId(note.id)
                                                                        setEditContent(note.content)
                                                                    }}
                                                                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                                    title="Modifier"
                                                                >
                                                                    <Edit2 className="h-3.5 w-3.5" />
                                                                </button>
                                                                <form action={async (formData) => {
                                                                    await deleteNote(formData);
                                                                }}>
                                                                    <input type="hidden" name="note_id" value={note.id} />
                                                                    <input type="hidden" name="project_id" value={projectId} />
                                                                    <button
                                                                        type="submit"
                                                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                                                        title="Supprimer"
                                                                        onClick={(e) => {
                                                                            if (!confirm('Voulez-vous vraiment supprimer cette note ?')) {
                                                                                e.preventDefault()
                                                                            }
                                                                        }}
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </button>
                                                                </form>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Note Content */}
                                        {isEditing ? (
                                            <form
                                                action={async (formData) => {
                                                    await updateNote(formData);
                                                    setEditingNoteId(null);
                                                    setEditContent('');
                                                }}
                                                className="space-y-3"
                                            >
                                                <input type="hidden" name="note_id" value={note.id} />
                                                <input type="hidden" name="project_id" value={projectId} />
                                                <textarea
                                                    name="content"
                                                    value={editContent}
                                                    onChange={(e) => setEditContent(e.target.value)}
                                                    rows={3}
                                                    required
                                                    className="w-full rounded-2xl border border-indigo-100 bg-white px-5 py-4 text-black focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none font-medium"
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingNoteId(null)
                                                            setEditContent('')
                                                        }}
                                                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-all"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-[10px] font-black uppercase tracking-widest shadow-md"
                                                    >
                                                        Sauvegarder
                                                    </button>
                                                </div>
                                            </form>
                                        ) : (
                                            <div className={`rounded-2xl p-5 border shadow-inner ${isValidated
                                                ? 'bg-emerald-100/30 border-emerald-100/50'
                                                : 'bg-white/50 border-white/80'}`}>
                                                <p className="text-sm text-gray-700 leading-relaxed font-medium whitespace-pre-wrap">
                                                    {note.content}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-gray-50/30 rounded-3xl border-2 border-dashed border-gray-100">
                        <div className="bg-white h-20 w-20 rounded-full shadow-lg flex items-center justify-center mx-auto mb-6">
                            <MessageSquare className="h-10 w-10 text-gray-200" />
                        </div>
                        <h3 className="text-lg font-black text-black tracking-tight">Aucune Note pour le Moment</h3>
                        <p className="text-sm text-gray-400 mt-2 font-medium">Capturez les moments clés du projet ici.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
