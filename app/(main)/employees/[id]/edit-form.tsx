'use client'

import { updateEmployee } from '../actions'
import { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, Upload } from 'lucide-react'
import { uploadAvatar } from '../storage-actions'

export default function EditEmployeeForm({ employee }: { employee: any }) {
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showPassword, setShowPassword] = useState(false)
    const [avatarUrl, setAvatarUrl] = useState(employee.avatar_url || '')

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        setError(null)

        const formData = new FormData()
        formData.append('file', file)

        const res = await uploadAvatar(formData)
        if (res.error) {
            setError(res.error)
        } else if (res.publicUrl) {
            setAvatarUrl(res.publicUrl)
        }
        setUploading(false)
    }

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        setError(null)
        const res = await updateEmployee(formData)
        if (res?.error) {
            setError(res.error)
            setLoading(false)
        }
    }

    return (
        <form action={handleSubmit} className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl md:col-span-2">
            <input type="hidden" name="id" value={employee.id} />
            <div className="px-4 py-6 sm:p-8">
                <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
                    <div className="sm:col-span-4">
                        <label htmlFor="full_name" className="block text-sm font-medium leading-6 text-gray-900">Full Name</label>
                        <div className="mt-2">
                            <input type="text" name="full_name" id="full_name" defaultValue={employee.full_name} required className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                        </div>
                    </div>

                    <div className="sm:col-span-4">
                        <label htmlFor="role" className="block text-sm font-medium leading-6 text-gray-900">Role / Title</label>
                        <div className="mt-2">
                            <select
                                name="role"
                                id="role"
                                defaultValue={employee.role || ""}
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                            >
                                <option value="">Select a role...</option>
                                <option value="Administrator">Administrator</option>
                                <option value="Manager">Manager</option>
                                <option value="Developer">Developer</option>
                                <option value="Designer">Designer</option>
                                <option value="Project Manager">Project Manager</option>
                                <option value="Team Lead">Team Lead</option>
                                <option value="Employee">Employee</option>
                            </select>
                        </div>
                    </div>

                    <div className="sm:col-span-4">
                        <label htmlFor="email" className="block text-sm font-medium leading-6 text-gray-900">Email Address</label>
                        <div className="mt-2">
                            <input type="email" name="email" id="email" defaultValue={employee.email} required className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                        </div>
                    </div>

                    <div className="sm:col-span-4">
                        <label htmlFor="password" className="block text-sm font-medium leading-6 text-gray-900">Password (leave blank to keep current)</label>
                        <div className="mt-2 relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                id="password"
                                className="block w-full rounded-md border-0 py-1.5 pr-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? (
                                    <EyeOff className="h-5 w-5" />
                                ) : (
                                    <Eye className="h-5 w-5" />
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="sm:col-span-4">
                        <label htmlFor="phone" className="block text-sm font-medium leading-6 text-gray-900">Phone</label>
                        <div className="mt-2">
                            <input type="tel" name="phone" id="phone" defaultValue={employee.phone} className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                        </div>
                    </div>

                    <div className="sm:col-span-4">
                        <label htmlFor="avatar_url" className="block text-sm font-medium leading-6 text-gray-900">Avatar URL</label>
                        <div className="mt-2 flex gap-2">
                            <input
                                type="text"
                                name="avatar_url"
                                id="avatar_url"
                                value={avatarUrl}
                                onChange={(e) => setAvatarUrl(e.target.value)}
                                placeholder="https://example.com/photo.jpg"
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                            />
                            <div className="relative">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    disabled={uploading}
                                />
                                <button
                                    type="button"
                                    disabled={uploading}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md border border-gray-300 hover:bg-gray-200 transition-colors text-sm font-medium h-full"
                                >
                                    <Upload className="h-4 w-4" />
                                    {uploading ? '...' : 'Upload'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="sm:col-span-4">
                        <label htmlFor="date_of_birth" className="block text-sm font-medium leading-6 text-gray-900">Date of Birth</label>
                        <div className="mt-2">
                            <input type="date" name="date_of_birth" id="date_of_birth" defaultValue={employee.date_of_birth ? new Date(employee.date_of_birth).toISOString().split('T')[0] : ''} className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                        </div>
                    </div>

                    {error && (
                        <div className="sm:col-span-6 text-red-600 text-sm">{error}</div>
                    )}
                </div>
            </div>
            <div className="flex items-center justify-end gap-x-6 border-t border-gray-900/10 px-4 py-4 sm:px-8">
                <Link href="/employees" className="text-sm font-semibold leading-6 text-gray-900">Cancel</Link>
                <button type="submit" disabled={loading} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50">
                    {loading ? 'Saving...' : 'Save'}
                </button>
            </div>
        </form>
    )
}
