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
        <form onSubmit={handleSubmit} className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Basic Info */}
                <div className="space-y-2">
                    <label htmlFor="full_name" className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">
                        Nom Complet
                    </label>
                    <input
                        type="text"
                        name="full_name"
                        id="full_name"
                        defaultValue={employee.full_name}
                        required
                        className="block w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 px-5 py-3.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="email" className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">
                        Adresse Email
                    </label>
                    <input
                        type="email"
                        name="email"
                        id="email"
                        defaultValue={employee.email}
                        required
                        className="block w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 px-5 py-3.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="phone" className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">
                        Téléphone
                    </label>
                    <input
                        type="tel"
                        name="phone"
                        id="phone"
                        defaultValue={employee.phone || ''}
                        className="block w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 px-5 py-3.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="date_of_birth" className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">
                        Date de Naissance
                    </label>
                    <input
                        type="date"
                        name="date_of_birth"
                        id="date_of_birth"
                        defaultValue={employee.date_of_birth ? new Date(employee.date_of_birth).toISOString().split('T')[0] : ''}
                        className="block w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 px-5 py-3.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none [color-scheme:light] dark:[color-scheme:dark]"
                    />
                </div>

                {/* Multi-Specialization Selection */}
                <div className="md:col-span-2 space-y-8 bg-gray-50/50 dark:bg-white/5 p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/10 transition-all duration-500">
                    <div className="space-y-4">
                        <label className="block text-xs font-black text-gray-900 dark:text-white uppercase tracking-[0.2em]">
                            Domaines de Spécialisation
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {Object.keys(specializationSkills).map((spec) => (
                                <label
                                    key={spec}
                                    className={`relative flex items-center justify-center px-4 py-3 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all cursor-pointer select-none ${specializations.includes(spec)
                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-900/20 scale-[1.02]'
                                        : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:border-indigo-300 dark:hover:border-indigo-500/30'
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
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                            <label className="block text-xs font-black text-gray-900 dark:text-white uppercase tracking-[0.2em]">
                                Compétences Techniques
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                                {availableSkills.map((skill) => (
                                    <label
                                        key={skill}
                                        className={`relative flex items-center justify-center px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer select-none ${selectedSkills.includes(skill)
                                            ? 'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-900/20'
                                            : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:border-purple-300 dark:hover:border-purple-500/30'
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
                <div className="space-y-2">
                    <label htmlFor="role" className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">
                        Rôle Professionnel
                    </label>
                    <input
                        type="text"
                        name="role"
                        id="role"
                        value={employee.role || 'Non assigné'}
                        disabled
                        className="block w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-5 py-3.5 text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-75 outline-none font-medium"
                    />
                    <p className="px-1 text-[9px] text-gray-400 italic font-bold uppercase tracking-tighter">Le rôle est géré par l'administration</p>
                </div>

                {/* Avatar Upload */}
                <div className="space-y-2">
                    <label htmlFor="avatar_url" className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">
                        Photo de Profil
                    </label>
                    <div className="flex gap-3">
                        <input
                            type="text"
                            name="avatar_url"
                            id="avatar_url"
                            value={avatarUrl}
                            onChange={(e) => setAvatarUrl(e.target.value)}
                            placeholder="https://example.com/photo.jpg"
                            className="block w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 px-5 py-3.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none flex-1"
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
                                className="inline-flex items-center gap-2 px-6 py-3.5 bg-white dark:bg-white/10 text-gray-700 dark:text-gray-200 rounded-2xl border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/20 transition-all text-xs font-black uppercase tracking-widest h-full"
                            >
                                <Upload className="h-4 w-4" />
                                {uploading ? '...' : 'Upload'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Password Section */}
            <div className="pt-10 border-t border-gray-100 dark:border-white/5">
                <div className="max-w-md space-y-2">
                    <label htmlFor="password" className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">
                        Changer le mot de passe <span className="text-gray-300 dark:text-gray-600 font-medium ml-1 lowercase">(laisser vide pour conserver l'actuel)</span>
                    </label>
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            name="password"
                            id="password"
                            className="block w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 px-5 py-3.5 pr-12 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                        >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Messaging */}
            {error && (
                <div className="bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20 rounded-2xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-widest">{error}</p>
                </div>
            )}

            {success && (
                <div className="bg-emerald-50 dark:bg-emerald-400/10 border border-emerald-200 dark:border-emerald-400/20 rounded-2xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Profil mis à jour avec succès !</p>
                </div>
            )}

            {/* Actions */}
            <div className="flex justify-end pt-6">
                <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-xl shadow-indigo-900/20 hover:shadow-2xl hover:shadow-indigo-900/30 text-xs font-black uppercase tracking-[0.2em] disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-1 active:translate-y-0"
                >
                    <Save className="h-5 w-5" />
                    {loading ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </button>
            </div>
        </form>
    )
}
