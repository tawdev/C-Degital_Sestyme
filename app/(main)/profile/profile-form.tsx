'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Save, Upload } from 'lucide-react'
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

    // Multi-select for specialization
    const [specializations, setSpecializations] = useState<string[]>(
        Array.isArray(employee.specialization) ? employee.specialization : (employee.specialization ? [employee.specialization] : [])
    )
    const [selectedSkills, setSelectedSkills] = useState<string[]>(employee.skills || [])

    const specializationSkills: Record<string, string[]> = {
        'Frontend': ['React', 'Vue', 'Next.js', 'HTML', 'CSS'],
        'Backend': ['Laravel', 'PHP', 'Node.js', 'Django'],
        'Design': ['Figma', 'Photoshop', 'Illustrator'],
        'Base de données': ['MySQL', 'PostgreSQL', 'MongoDB'],
    }

    // Combine skills from all selected specializations
    const availableSkills = Array.from(
        new Set(specializations.flatMap(spec => specializationSkills[spec] || []))
    )

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

        // Ensure multi-values are handled (FormData.append doesn't replace, it adds)
        // Actually, the checkboxes in the UI with name="specialization" and name="skills" 
        // will handle this automatically when using formData.getAll('specialization') in the action.

        const result = await updateProfile(formData)

        if (result.error) {
            setError(result.error)
            setLoading(false)
            return
        }

        setSuccess(true)
        setLoading(false)

        setTimeout(() => {
            router.refresh()
            setSuccess(false)
        }, 2000)
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Info */}
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
                        className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
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
                        className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
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
                        className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
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
                        className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                </div>

                {/* Multi-Specialization Selection */}
                <div className="md:col-span-2 space-y-6 bg-gray-50/50 p-6 rounded-xl border border-gray-100">
                    <div>
                        <label className="block text-sm font-bold text-gray-900 mb-3">
                            Domaines de Spécialisation (Sélection Multiple)
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {Object.keys(specializationSkills).map((spec) => (
                                <label
                                    key={spec}
                                    className={`relative flex items-center justify-center px-4 py-2.5 rounded-lg border text-sm font-semibold transition-all cursor-pointer select-none ${specializations.includes(spec)
                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                            : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-200 hover:bg-indigo-50'
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        name="specialization"
                                        value={spec}
                                        checked={specializations.includes(spec)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSpecializations([...specializations, spec])
                                            } else {
                                                setSpecializations(specializations.filter(s => s !== spec))
                                                // Also remove skills that belonged only to this spec 
                                                // (Optional: keep them if they exist in other selected specs)
                                                const remainingSpecs = specializations.filter(s => s !== spec)
                                                const stillAvailable = new Set(remainingSpecs.flatMap(s => specializationSkills[s] || []))
                                                setSelectedSkills(selectedSkills.filter(skill => stillAvailable.has(skill)))
                                            }
                                        }}
                                        className="sr-only"
                                    />
                                    {spec}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Combined Skills List */}
                    {availableSkills.length > 0 && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="block text-sm font-bold text-gray-900 mb-3">
                                Compétences Techniques Associées
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                                {availableSkills.map((skill) => (
                                    <label
                                        key={skill}
                                        className={`relative flex items-center justify-center px-4 py-2.5 rounded-lg border text-sm font-medium transition-all cursor-pointer select-none ${selectedSkills.includes(skill)
                                                ? 'bg-purple-600 border-purple-600 text-white shadow-md'
                                                : 'bg-white border-gray-200 text-gray-600 hover:border-purple-200 hover:bg-purple-50'
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            name="skills"
                                            value={skill}
                                            checked={selectedSkills.includes(skill)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedSkills([...selectedSkills, skill])
                                                } else {
                                                    setSelectedSkills(selectedSkills.filter(s => s !== skill))
                                                }
                                            }}
                                            className="sr-only"
                                        />
                                        {skill}
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Role (Read Only) */}
                <div>
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                        Professional Role
                    </label>
                    <input
                        type="text"
                        name="role"
                        id="role"
                        value={employee.role || 'Not assigned'}
                        disabled
                        className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-500 bg-gray-50 cursor-not-allowed opacity-75"
                    />
                    <p className="mt-1 text-[10px] text-gray-400 italic font-medium">Role is managed by administration</p>
                </div>

                {/* Avatar Upload */}
                <div>
                    <label htmlFor="avatar_url" className="block text-sm font-medium text-gray-700 mb-2">
                        Profile Picture
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            name="avatar_url"
                            id="avatar_url"
                            value={avatarUrl}
                            onChange={(e) => setAvatarUrl(e.target.value)}
                            placeholder="https://example.com/photo.jpg"
                            className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all flex-1"
                        />
                        <div className="relative">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                disabled={uploading}
                            />
                            <button
                                type="button"
                                disabled={uploading}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-sm font-medium h-full"
                            >
                                <Upload className="h-4 w-4" />
                                {uploading ? '...' : 'Upload'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Password Section */}
            <div className="pt-6 border-t border-gray-100">
                <div className="max-w-md">
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                        Update Password <span className="text-gray-400 font-normal ml-1">(leave blank to keep current)</span>
                    </label>
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            name="password"
                            id="password"
                            className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-10 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Messaging */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-2">
                    <p className="text-sm text-red-600 font-medium">{error}</p>
                </div>
            )}

            {success && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-2">
                    <p className="text-sm text-emerald-600 font-medium">Profile updated successfully!</p>
                </div>
            )}

            {/* Actions */}
            <div className="flex justify-end pt-4">
                <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
                >
                    <Save className="h-5 w-5" />
                    {loading ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </form>
    )
}
