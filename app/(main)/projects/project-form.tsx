'use client'

import { createProject, updateProject } from './actions'
import { useState } from 'react'
import Link from 'next/link'

export default function ProjectForm({ employees, project }: { employees: any[], project?: any }) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        setError(null)
        const action = project ? updateProject : createProject
        const res = await action(formData)
        if (res?.error) {
            setError(res.error)
            setLoading(false)
        }
    }

    return (
        <form action={handleSubmit} className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl md:col-span-2">
            {project && <input type="hidden" name="id" value={project.id} />}

            <div className="px-4 py-6 sm:p-8">
                <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">

                    <div className="sm:col-span-4">
                        <label htmlFor="project_name" className="block text-sm font-medium leading-6 text-gray-900">Project Name</label>
                        <div className="mt-2">
                            <input type="text" name="project_name" id="project_name" defaultValue={project?.project_name} required className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                        </div>
                    </div>

                    <div className="sm:col-span-4">
                        <label htmlFor="domain_name" className="block text-sm font-medium leading-6 text-gray-900">Domain Name</label>
                        <div className="mt-2">
                            <input type="text" name="domain_name" id="domain_name" defaultValue={project?.domain_name} className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                        </div>
                    </div>

                    <div className="sm:col-span-3">
                        <label htmlFor="language" className="block text-sm font-medium leading-6 text-gray-900">Language</label>
                        <div className="mt-2">
                            <input type="text" name="language" id="language" defaultValue={project?.language} placeholder="e.g. Arabic, French" className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                        </div>
                    </div>

                    <div className="sm:col-span-3">
                        <label htmlFor="project_size" className="block text-sm font-medium leading-6 text-gray-900">Project Size</label>
                        <div className="mt-2">
                            <input type="text" name="project_size" id="project_size" defaultValue={project?.project_size} placeholder="e.g. Small, Medium, Large" className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                        </div>
                    </div>

                    {/* Show assignment and status only if editing or if multiple employees available */}
                    {(project || employees.length > 1) && (
                        <div className="sm:col-span-3">
                            <label htmlFor="employee_id" className="block text-sm font-medium leading-6 text-gray-900">Assigned To</label>
                            <div className="mt-2">
                                <select id="employee_id" name="employee_id" defaultValue={project?.employee_id || ''} className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                                    <option value="">Unassigned</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {!project && employees.length === 1 && (
                        <input type="hidden" name="employee_id" value={employees[0].id} />
                    )}

                    {project && (
                        <div className="sm:col-span-3">
                            <label htmlFor="status" className="block text-sm font-medium leading-6 text-gray-900">Status</label>
                            <div className="mt-2">
                                <select id="status" name="status" defaultValue={project?.status} className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6">
                                    <option value="pending">Pending</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="sm:col-span-3">
                        <label htmlFor="start_date" className="block text-sm font-medium leading-6 text-gray-900">Start Date</label>
                        <div className="mt-2">
                            <input type="date" name="start_date" id="start_date" defaultValue={project?.start_date?.split('T')[0]} className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                        </div>
                    </div>

                    <div className="sm:col-span-3">
                        <label htmlFor="end_date" className="block text-sm font-medium leading-6 text-gray-900">End Date</label>
                        <div className="mt-2">
                            <input type="date" name="end_date" id="end_date" defaultValue={project?.end_date?.split('T')[0]} className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                        </div>
                    </div>

                    {project && (
                        <div className="sm:col-span-3">
                            <label htmlFor="progress" className="block text-sm font-medium leading-6 text-gray-900">Progress (0-100)</label>
                            <div className="mt-2">
                                <input type="number" name="progress" id="progress" min="0" max="100" defaultValue={project?.progress} className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                            </div>
                        </div>
                    )}

                    <div className="col-span-full">
                        <label htmlFor="comment" className="block text-sm font-medium leading-6 text-gray-900">Internal Comments</label>
                        <div className="mt-2">
                            <textarea id="comment" name="comment" rows={3} defaultValue={project?.comment} className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"></textarea>
                        </div>
                    </div>

                    {error && (
                        <div className="sm:col-span-6 text-red-600 text-sm">{error}</div>
                    )}
                </div>
            </div>
            <div className="flex items-center justify-end gap-x-6 border-t border-gray-900/10 px-4 py-4 sm:px-8">
                <Link href="/projects" className="text-sm font-semibold leading-6 text-gray-900">Cancel</Link>
                <button type="submit" disabled={loading} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50">
                    {loading ? 'Saving...' : 'Save'}
                </button>
            </div>
        </form>
    )
}
