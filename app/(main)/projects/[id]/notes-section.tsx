'use client'

import { useState } from 'react'
import { MessageSquare, Plus, Edit2, Trash2, CheckCircle2, X } from 'lucide-react'
import { addNote, updateNote, deleteNote, validateNotes } from './actions'

interface Note {
    id: string
    project_id: string
    author_id: string
    content: string
    created_at: string
    updated_at: string
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
    notesValidatedAt: string | null
}

export default function NotesSection({
    projectId,
    projectOwnerId,
    currentUserId,
    notes,
    notesValidatedAt
}: NotesSectionProps) {
    const [isAddingNote, setIsAddingNote] = useState(false)
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
    const [editContent, setEditContent] = useState('')

    const isProjectOwner = projectOwnerId === currentUserId

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <MessageSquare className="h-5 w-5 text-indigo-600" />
                        <h2 className="text-lg font-semibold text-gray-900">
                            Notes ({notes.length})
                        </h2>
                        {notesValidatedAt && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <CheckCircle2 className="h-3 w-3" />
                                Validated
                            </span>
                        )}
                    </div>

                    {/* زر إضافة ملاحظة - متاح للجميع */}
                    {/* Add note button - available to everyone */}
                    {/* زر إضافة ملاحظة - مسموح فقط لغير صاحب المشروع */}
                    {/* Add note button - allowed only for non-owners */}
                    {!isAddingNote && !isProjectOwner && (
                        <button
                            onClick={() => setIsAddingNote(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                        >
                            <Plus className="h-4 w-4" />
                            Add Note
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
                {/* Add Note Form */}
                {isAddingNote && (
                    <form action={addNote} className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                        <input type="hidden" name="project_id" value={projectId} />
                        <textarea
                            name="content"
                            rows={3}
                            placeholder="Write your note here..."
                            required
                            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                        />
                        <div className="flex justify-end gap-2 mt-3">
                            <button
                                type="button"
                                onClick={() => setIsAddingNote(false)}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                            >
                                Add Note
                            </button>
                        </div>
                    </form>
                )}

                {/* Notes List */}
                {notes.length > 0 ? (
                    <div className="space-y-3">
                        {notes.map((note) => {
                            const isAuthor = note.author_id === currentUserId
                            const isEditing = editingNoteId === note.id

                            return (
                                <div
                                    key={note.id}
                                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                                >
                                    {/* Note Header */}
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="flex-shrink-0 h-8 w-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                                                {note.author?.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'UN'}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">
                                                    {note.author?.full_name || 'Unknown'}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {new Date(note.created_at).toLocaleDateString('en-US', {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                    {note.updated_at !== note.created_at && ' (edited)'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Actions - صاحب الملاحظة فقط */}
                                        {/* Actions - note author only */}
                                        {isAuthor && !isEditing && (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        setEditingNoteId(note.id)
                                                        setEditContent(note.content)
                                                    }}
                                                    className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                <form action={deleteNote}>
                                                    <input type="hidden" name="note_id" value={note.id} />
                                                    <input type="hidden" name="project_id" value={projectId} />
                                                    <button
                                                        type="submit"
                                                        className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors"
                                                        title="Delete"
                                                        onClick={(e) => {
                                                            if (!confirm('Are you sure you want to delete this note?')) {
                                                                e.preventDefault()
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </form>
                                            </div>
                                        )}
                                    </div>

                                    {/* Note Content */}
                                    {isEditing ? (
                                        <form action={updateNote} className="mt-3">
                                            <input type="hidden" name="note_id" value={note.id} />
                                            <input type="hidden" name="project_id" value={projectId} />
                                            <textarea
                                                name="content"
                                                value={editContent}
                                                onChange={(e) => setEditContent(e.target.value)}
                                                rows={3}
                                                required
                                                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                                            />
                                            <div className="flex justify-end gap-2 mt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingNoteId(null)
                                                        setEditContent('')
                                                    }}
                                                    className="px-3 py-1.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="submit"
                                                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                                                >
                                                    Save
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                            {note.content}
                                        </p>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="text-center py-12 text-gray-500">
                        <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-sm">No notes yet. Be the first to add one!</p>
                    </div>
                )}

                {/* Validate Button - صاحب المشروع فقط */}
                {/* Validate button - project owner only */}
                {isProjectOwner && notes.length > 0 && (
                    <div className="pt-4 border-t border-gray-200">
                        <form action={validateNotes}>
                            <input type="hidden" name="project_id" value={projectId} />
                            <button
                                type="submit"
                                disabled={!!notesValidatedAt}
                                className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${notesValidatedAt
                                    ? 'bg-green-100 text-green-800 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700'
                                    }`}
                            >
                                <CheckCircle2 className="h-5 w-5" />
                                {notesValidatedAt ? 'Notes Already Validated' : 'Valider les notes'}
                            </button>
                        </form>
                        {notesValidatedAt && (
                            <p className="text-xs text-gray-500 text-center mt-2">
                                Validated on {new Date(notesValidatedAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
