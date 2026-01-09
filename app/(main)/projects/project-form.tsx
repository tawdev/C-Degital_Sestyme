'use client'

import { createProject, updateProject } from './actions'
import { useState } from 'react'
import Link from 'next/link'
import { Save, ArrowLeft, Type, Globe, Languages, TrendingUp, User, Calendar, Percent, FileText, CheckSquare, Plus, Trash2 } from 'lucide-react'

export default function ProjectForm({ employees, project, currentUserId }: { employees: any[], project?: any, currentUserId?: string }) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [tasks, setTasks] = useState<{ id?: string, title: string, status: string, assigned_to?: string }[]>(project?.project_tasks || [])
    const [collaborators, setCollaborators] = useState<string[]>(project?.project_collaborators?.map((c: any) => c.employee_id) || [])

    const addTask = () => {
        setTasks([...tasks, { title: '', status: 'pending', assigned_to: '' }])
    }

    const removeTask = (index: number) => {
        setTasks(tasks.filter((_, i) => i !== index))
    }

    const updateTask = (index: number, field: string, value: string) => {
        const newTasks = [...tasks]
        newTasks[index] = { ...newTasks[index], [field]: value } as any
        setTasks(newTasks)
    }

    // Calculate progress automatically if tasks exist
    const calculatedProgress = tasks.length > 0
        ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100)
        : (project?.progress || 0)

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        setError(null)

        // Add tasks to formData as JSON
        formData.append('tasks', JSON.stringify(tasks))
        formData.append('collaborators', JSON.stringify(collaborators))

        const action = project ? updateProject : createProject
        try {
            const res = await action(formData)
            if (res?.error) {
                setError(res.error)
                setLoading(false)
            }
        } catch (err) {
            setError("Une erreur inattendue s'est produite.")
            setLoading(false)
        }
    }

    return (
        <form action={handleSubmit} className="bg-white shadow-xl shadow-indigo-900/5 rounded-3xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            {project && <input type="hidden" name="id" value={project.id} />}

            <div className="p-8 space-y-8">
                {/* Section 1: Informations Générales */}
                <div className="space-y-6">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">Informations Générales</h3>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="project_name" className="block text-sm font-bold text-gray-700">Nom du Projet</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Type className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    name="project_name"
                                    id="project_name"
                                    defaultValue={project?.project_name}
                                    required
                                    placeholder="Ex: Refonte Site Web E-commerce"
                                    className="block w-full rounded-xl border-gray-200 py-3 pl-10 pr-4 text-black shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-medium placeholder:text-gray-400"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label htmlFor="domain_name" className="block text-sm font-bold text-gray-700">Nom de Domaine</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Globe className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        name="domain_name"
                                        id="domain_name"
                                        defaultValue={project?.domain_name}
                                        placeholder="Ex: www.monclient.com"
                                        className="block w-full rounded-xl border-gray-200 py-3 pl-10 pr-4 text-black shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-medium placeholder:text-gray-400"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="language" className="block text-sm font-bold text-gray-700">Langage / Techno</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Languages className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        name="language"
                                        id="language"
                                        defaultValue={project?.language}
                                        placeholder="Ex: Next.js, PHP, React..."
                                        className="block w-full rounded-xl border-gray-200 py-3 pl-10 pr-4 text-black shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-medium placeholder:text-gray-400"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="project_size" className="block text-sm font-bold text-gray-700">Taille du Projet</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <TrendingUp className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    name="project_size"
                                    id="project_size"
                                    defaultValue={project?.project_size}
                                    placeholder="Ex: Small, Medium, Large, Enterprise"
                                    className="block w-full rounded-xl border-gray-200 py-3 pl-10 pr-4 text-black shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-medium placeholder:text-gray-400"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 2: Affectation & Statut */}
                <div className="space-y-6">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">Organisation</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {(project || employees.length > 1) && (
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-gray-700">Responsable Assigné</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <User className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        disabled
                                        value={employees.find(e => e.id === (project?.employee_id || currentUserId))?.full_name || 'Non Assigné'}
                                        className="block w-full rounded-xl border-gray-200 py-3 pl-10 pr-10 text-gray-500 bg-gray-100 shadow-sm font-bold cursor-not-allowed"
                                    />
                                    <input type="hidden" name="employee_id" value={project?.employee_id || currentUserId || ''} />
                                </div>
                            </div>
                        )}

                        {(project || employees.length > 1) && (
                            <div className="space-y-2">
                                <label htmlFor="collaborators" className="block text-sm font-bold text-gray-700">Collaborateurs</label>
                                <div className="space-y-2">
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {collaborators.map(collabId => {
                                            const emp = employees.find(e => e.id === collabId)
                                            return emp ? (
                                                <span key={collabId} className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold">
                                                    {emp.full_name}
                                                    <button type="button" onClick={() => setCollaborators(collaborators.filter(id => id !== collabId))} className="hover:text-red-500">
                                                        <Trash2 className="h-3 w-3" />
                                                    </button>
                                                </span>
                                            ) : null
                                        })}
                                    </div>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <User className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                        </div>
                                        <select
                                            onChange={(e) => {
                                                if (e.target.value && !collaborators.includes(e.target.value)) {
                                                    setCollaborators([...collaborators, e.target.value])
                                                }
                                                e.target.value = ''
                                            }}
                                            className="block w-full rounded-xl border-gray-200 py-3 pl-10 pr-10 text-black shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-bold appearance-none bg-gray-50/50"
                                        >
                                            <option value="">Ajouter un collaborateur...</option>
                                            {employees.filter(e => e.id !== (project?.employee_id || currentUserId || '') && !collaborators.includes(e.id) && e.role !== 'Administrator').map(emp => (
                                                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <input type="hidden" name="collaborators" value={JSON.stringify(collaborators)} />
                                </div>
                            </div>
                        )}

                        {!project && employees.length === 1 && (
                            <input type="hidden" name="employee_id" value={employees[0].id} />
                        )}

                        {project && (
                            <div className="space-y-2">
                                <label htmlFor="status" className="block text-sm font-bold text-gray-700">
                                    Statut Actuel {tasks.length > 0 && <span className="text-[10px] text-indigo-500 ml-1">(Auto via progression)</span>}
                                </label>
                                <div className="relative group">
                                    <select
                                        id="status"
                                        name="status"
                                        value={tasks.length > 0
                                            ? (calculatedProgress === 100 ? 'completed' : calculatedProgress > 0 ? 'in_progress' : 'pending')
                                            : undefined
                                        }
                                        defaultValue={tasks.length === 0 ? project?.status : undefined}
                                        disabled={tasks.length > 0}
                                        className={`block w-full rounded-xl border-gray-200 py-3 pl-4 pr-10 text-black shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-bold appearance-none ${tasks.length > 0 ? 'bg-gray-50 cursor-not-allowed' : 'bg-gray-50/50'}`}
                                    >
                                        <option value="pending">En Attente</option>
                                        <option value="in_progress">En Cours</option>
                                        <option value="completed">Terminé</option>
                                    </select>
                                    {tasks.length > 0 && (
                                        <input
                                            type="hidden"
                                            name="status"
                                            value={calculatedProgress === 100 ? 'completed' : calculatedProgress > 0 ? 'in_progress' : 'pending'}
                                        />
                                    )}
                                </div>
                            </div>
                        )}

                        {project && (
                            <div className="space-y-2">
                                <label htmlFor="progress" className="block text-sm font-bold text-gray-700">
                                    Progression (%) {tasks.length > 0 && <span className="text-[10px] text-indigo-500 ml-1">(Calculé via tâches)</span>}
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Percent className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                    </div>
                                    <input
                                        type="number"
                                        name="progress"
                                        id="progress"
                                        min="0"
                                        max="100"
                                        value={tasks.length > 0 ? calculatedProgress : undefined}
                                        defaultValue={tasks.length === 0 ? project?.progress : undefined}
                                        readOnly={tasks.length > 0}
                                        className={`block w-full rounded-xl border-gray-200 py-3 pl-10 pr-4 text-black shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-medium ${tasks.length > 0 ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Section 3: Planning - Dates are now automatic */}
                <div className="space-y-6">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">
                        Planning Prévisionnel
                        <span className="text-[10px] text-indigo-500 ml-2">(Automatique)</span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-gray-700">
                                Date de Début
                                <span className="text-[10px] text-indigo-500 ml-1 font-normal">(Auto)</span>
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Calendar className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="date"
                                    value={project?.start_date?.split('T')[0] || new Date().toISOString().split('T')[0]}
                                    readOnly
                                    disabled
                                    className="block w-full rounded-xl border-gray-200 py-3 pl-10 pr-4 text-gray-700 shadow-sm bg-gray-50 cursor-not-allowed font-medium"
                                />
                            </div>
                            <p className="text-[10px] text-gray-500 italic">Définie automatiquement à la création</p>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-gray-700">
                                Date de Fin
                                <span className="text-[10px] text-indigo-500 ml-1 font-normal">(Auto)</span>
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Calendar className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="date"
                                    value={project?.end_date?.split('T')[0] || ''}
                                    readOnly
                                    disabled
                                    placeholder="Sera définie à 100%"
                                    className="block w-full rounded-xl border-gray-200 py-3 pl-10 pr-4 text-gray-700 shadow-sm bg-gray-50 cursor-not-allowed font-medium"
                                />
                            </div>
                            <p className="text-[10px] text-gray-500 italic">
                                {project?.end_date ? 'Projet terminé' : 'Sera définie lorsque toutes les tâches sont terminées (100%)'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Section 4: Tâches du Projet */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-4">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Liste des Tâches</h3>
                        <button
                            type="button"
                            onClick={addTask}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                            <Plus className="h-3 w-3" />
                            Ajouter une Tâche
                        </button>
                    </div>

                    <div className="space-y-3">
                        {tasks.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-100">
                                <CheckSquare className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                                <p className="text-sm font-medium text-gray-400">Aucune tâche définie pour ce projet</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                {tasks.map((task, index) => (
                                    <div key={index} className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow group">
                                        <div className="flex-1 relative">
                                            <input
                                                type="text"
                                                value={task.title}
                                                onChange={(e) => updateTask(index, 'title', e.target.value)}
                                                placeholder="Titre de la tâche..."
                                                className="block w-full border-none p-0 text-sm font-bold text-black focus:ring-0 placeholder:text-gray-400 bg-transparent"
                                            />
                                            {/* Assignment Dropdown if collaborators exist */}
                                            {(collaborators.length > 0 || project?.employee_id) && (
                                                <div className="mt-2">
                                                    <select
                                                        value={task.assigned_to || ''}
                                                        onChange={(e) => updateTask(index, 'assigned_to', e.target.value)}
                                                        className="text-xs border-none bg-gray-50 text-gray-500 rounded px-2 py-1 focus:ring-0 cursor-pointer hover:bg-gray-100"
                                                    >
                                                        <option value="">Non assignée</option>
                                                        {project?.employee_id && (
                                                            <option value={project.employee_id}>
                                                                {employees.find(e => e.id === project.employee_id)?.full_name || 'Responsable'}
                                                            </option>
                                                        )}
                                                        {collaborators.map(id => {
                                                            const emp = employees.find(e => e.id === id)
                                                            return emp ? <option key={id} value={id}>{emp.full_name}</option> : null
                                                        })}
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={task.status}
                                                onChange={(e) => updateTask(index, 'status', e.target.value)}
                                                className="text-[10px] font-black uppercase tracking-tight py-1 pl-2 pr-6 border-gray-200 rounded-lg bg-gray-50 focus:ring-indigo-500 focus:border-indigo-500"
                                            >
                                                <option value="pending">En Attente</option>
                                                <option value="completed">Terminé</option>
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => removeTask(index)}
                                                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Section 5: Détails */}
                <div className="space-y-6">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">Description & Objectifs</h3>
                    <div className="space-y-2">
                        <div className="relative group">
                            <div className="absolute top-3 left-3 flex items-start pointer-events-none">
                                <FileText className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                            </div>
                            <textarea
                                id="comment"
                                name="comment"
                                rows={4}
                                defaultValue={project?.comment}
                                placeholder="Détaillez les objectifs principaux ou les notes critiques pour ce projet..."
                                className="block w-full rounded-xl border-gray-200 py-3 pl-10 pr-4 text-black shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-medium placeholder:text-gray-400 resize-none"
                            ></textarea>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-bold animate-in shake duration-300 flex items-center gap-2">
                        <div className="h-2 w-2 bg-red-500 rounded-full" />
                        {error}
                    </div>
                )}
            </div>

            <div className="px-8 py-6 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                <Link
                    href="/projects"
                    className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-800 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Annuler
                </Link>
                <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200 font-bold active:scale-95 disabled:opacity-50 disabled:active:scale-100 text-sm"
                >
                    {loading ? (
                        <>
                            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Sauvegarde...
                        </>
                    ) : (
                        <>
                            <Save className="h-4 w-4" />
                            Enregistrer le Projet
                        </>
                    )}
                </button>
            </div>
        </form>
    )
}
