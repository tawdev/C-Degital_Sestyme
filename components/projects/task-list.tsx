'use client'

import { useState } from 'react'
import { CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react'
import { updateTaskStatus } from './actions'
import { useRouter } from 'next/navigation'

type Task = {
    id: string
    title: string
    status: 'pending' | 'in_progress' | 'completed' | 'todo' | 'done'
    project_id: string
    assignee_id: string | null
    assignee?: {
        full_name: string
    }
}

type TaskListProps = {
    tasks: Task[]
    projectId: string
    currentUserId: string
}

export default function TaskList({ tasks, projectId, currentUserId }: TaskListProps) {
    // Basic optimistic UI can be handled locally or just rely on server revalidation
    const router = useRouter()
    const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null)

    const handleStatusChange = async (taskId: string, newStatus: string) => {
        setUpdatingTaskId(taskId)
        const result = await updateTaskStatus(taskId, projectId, newStatus)
        setUpdatingTaskId(null)

        if (!result.success) {
            console.error("Task update failed:", result.message);
            alert(result.message) // Show detailed error
        } else {
            // Router refresh happens automatically via server action revalidatePath, but good to be explicit if needed
            // router.refresh() 
        }
    }

    if (!tasks || tasks.length === 0) {
        return (
            <div className="col-span-full py-8 text-center bg-gray-50/30 rounded-2xl border-2 border-dashed border-gray-100">
                <p className="text-sm font-medium text-gray-400 italic">Aucune tâche spécifique n'a été définie pour ce projet.</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tasks.map((task) => {
                const isAssignee = task.assignee_id === currentUserId
                const isUpdating = updatingTaskId === task.id
                const status = task.status as string // Handle mixed types safely

                // Fallback for old status values if migration didn't map them purely
                let statusColor = 'bg-gray-100 text-gray-600'
                let StatusIcon = Circle

                if (status === 'completed' || status === 'done') {
                    statusColor = 'bg-emerald-100 text-emerald-600'
                    StatusIcon = CheckCircle2
                } else if (status === 'in_progress') {
                    statusColor = 'bg-indigo-100 text-indigo-600'
                    StatusIcon = Clock
                } else {
                    statusColor = 'bg-amber-100 text-amber-600'
                    StatusIcon = Circle
                }

                return (
                    <div
                        key={task.id}
                        className={`
                            relative flex flex-col gap-3 p-4 bg-gray-50/50 rounded-2xl border 
                            ${isAssignee ? 'border-indigo-100 hover:border-indigo-300 bg-white shadow-sm' : 'border-gray-100 opacity-90'} 
                            transition-all group
                        `}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`p-1.5 rounded-lg shadow-sm ${statusColor}`}>
                                    <StatusIcon className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className={`text-sm font-bold ${status === 'completed' || status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                        {task.title}
                                    </p>
                                    <p className="text-[10px] font-black uppercase tracking-tight text-gray-400">
                                        {task.assignee ? `Assigné à: ${task.assignee.full_name}` : 'Non assigné'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Action Area */}
                        {isAssignee ? (
                            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                                <span className="text-[10px] uppercase font-bold text-indigo-400">Modifier Statut</span>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => handleStatusChange(task.id, 'pending')}
                                        disabled={isUpdating || status === 'pending'}
                                        className={`w-6 h-6 rounded-full border flex items-center justify-center hover:scale-110 transition-transform ${status === 'pending' ? 'bg-amber-100 border-amber-300 text-amber-600' : 'bg-white border-gray-200 text-gray-300'}`}
                                        title="En attente"
                                    >
                                        <div className="w-2 h-2 rounded-full bg-current" />
                                    </button>
                                    <button
                                        onClick={() => handleStatusChange(task.id, 'in_progress')}
                                        disabled={isUpdating || status === 'in_progress'}
                                        className={`w-6 h-6 rounded-full border flex items-center justify-center hover:scale-110 transition-transform ${status === 'in_progress' ? 'bg-indigo-100 border-indigo-300 text-indigo-600' : 'bg-white border-gray-200 text-gray-300'}`}
                                        title="En cours"
                                    >
                                        <Clock className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={() => handleStatusChange(task.id, 'completed')}
                                        disabled={isUpdating || status === 'completed'}
                                        className={`w-6 h-6 rounded-full border flex items-center justify-center hover:scale-110 transition-transform ${status === 'completed' ? 'bg-emerald-100 border-emerald-300 text-emerald-600' : 'bg-white border-gray-200 text-gray-300'}`}
                                        title="Terminé"
                                    >
                                        <CheckCircle2 className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-2 text-right">
                                <span className="text-[10px] text-gray-300 italic">Lecture seule</span>
                            </div>
                        )}

                        {isUpdating && (
                            <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-2xl">
                                <Clock className="animate-spin text-indigo-600 h-5 w-5" />
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
