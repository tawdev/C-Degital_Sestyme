'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Save, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadAvatar } from '../employees/storage-actions'
import { updateProfile } from './actions'

export default function ProfileForm({ employee }: { employee: any }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
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

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(false)

        const formData = new FormData(e.currentTarget)
        formData.append('id', employee.id)
        formData.append('avatar_url', avatarUrl)

        const result = await updateProfile(formData)

        if (result.error) {
            setError(result.error)
            setLoading(false)
            return
        }

        setSuccess(true)
        setLoading(false)

        // Refresh the page to show updated data
        setTimeout(() => {
            router.refresh()
            setSuccess(false)
        }, 2000)
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name
                    </label>
                    <input
                        type="text"
                        name="full_name"
                        id="full_name"
                        defaultValue={employee.full_name}
                        required
                        className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address
                    </label>
                    <input
                        type="email"
                        name="email"
                        id="email"
                        defaultValue={employee.email}
                        required
                        className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number
                    </label>
                    <input
                        type="tel"
                        name="phone"
                        id="phone"
                        defaultValue={employee.phone || ''}
                        className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                        Role
                    </label>
                    <input
                        type="text"
                        name="role"
                        id="role"
                        value={employee.role || 'Not assigned'}
                        disabled
                        className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-500 bg-gray-50 cursor-not-allowed"
                    />
                </div>

                <div>
                    <label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700 mb-2">
                        Date of Birth
                    </label>
                    <input
                        type="date"
                        name="date_of_birth"
                        id="date_of_birth"
                        defaultValue={employee.date_of_birth ? new Date(employee.date_of_birth).toISOString().split('T')[0] : ''}
                        className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label htmlFor="avatar_url" className="block text-sm font-medium text-gray-700 mb-2">
                        Avatar URL
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            name="avatar_url"
                            id="avatar_url"
                            value={avatarUrl}
                            onChange={(e) => setAvatarUrl(e.target.value)}
                            placeholder="https://example.com/photo.jpg"
                            className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent flex-1"
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
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-200 transition-colors text-sm font-medium h-full"
                            >
                                <Upload className="h-4 w-4" />
                                {uploading ? '...' : 'Upload'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    New Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span>
                </label>
                <div className="relative">
                    <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        id="password"
                        className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-10 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}

            {success && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <p className="text-sm text-emerald-600">Profile updated successfully!</p>
                </div>
            )}

            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save className="h-4 w-4" />
                    {loading ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </form>
    )
}
