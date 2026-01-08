'use client'

import { updateEmployee } from '../actions'
import { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, Save, ArrowLeft, ShieldCheck, Mail, Briefcase } from 'lucide-react'

export default function EditEmployeeForm({ employee }: { employee: any }) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        setError(null)
        setSuccess(false)

        try {
            const res = await updateEmployee(formData)
            if (res?.error) {
                setError(res.error)
                setLoading(false)
            } else {
                setSuccess(true)
                setLoading(false)
            }
        } catch (err) {
            setError("An unexpected error occurred.")
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Action Bar */}
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <Link
                    href="/employees"
                    className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-indigo-600 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to List
                </Link>
                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    Admin Access
                </div>
            </div>

            <form action={handleSubmit} className="bg-white shadow-xl shadow-indigo-900/5 rounded-2xl border border-gray-100 overflow-hidden">
                <input type="hidden" name="id" value={employee.id} />

                <div className="p-8 space-y-8">
                    {/* Header Section */}
                    <div className="border-b border-gray-50 pb-6">
                        <h2 className="text-xl font-extrabold text-gray-900">Information sur l'Employé</h2>
                        <p className="text-sm text-gray-500 mt-1">Mise à jour des identifiants et rôles administratifs.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-right">
                        {/* Full Name */}
                        <div className="space-y-2">
                            <label htmlFor="full_name" className="block text-sm font-bold text-gray-700">
                                Nom Complet
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="full_name"
                                    id="full_name"
                                    defaultValue={employee.full_name}
                                    required
                                    className="block w-full rounded-xl border-gray-200 py-3 px-4 text-gray-900 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-medium"
                                />
                            </div>
                        </div>

                        {/* Professional Role */}
                        <div className="space-y-2">
                            <label htmlFor="role" className="block text-sm font-bold text-gray-700">
                                Rôle Professionnel
                            </label>
                            <div className="relative">
                                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                                <select
                                    name="role"
                                    id="role"
                                    defaultValue={employee.role || ""}
                                    className="block w-full rounded-xl border-gray-200 py-3 pl-10 pr-4 text-gray-900 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-bold appearance-none bg-gray-50/50"
                                >
                                    <option value="">Sélectionner un rôle...</option>
                                    <option value="Administrator">Administrateur</option>
                                    <option value="Manager">Manager</option>
                                    <option value="Developer">Développeur</option>
                                    <option value="Designer">Designer</option>
                                    <option value="Project Manager">Chef de Projet</option>
                                    <option value="Team Lead">Lead Technique</option>
                                    <option value="Employee">Employé</option>
                                </select>
                            </div>
                        </div>

                        {/* Email Address */}
                        <div className="space-y-2">
                            <label htmlFor="email" className="block text-sm font-bold text-gray-700">
                                Adresse Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                                <input
                                    type="email"
                                    name="email"
                                    id="email"
                                    defaultValue={employee.email}
                                    required
                                    className="block w-full rounded-xl border-gray-200 py-3 pl-10 pr-4 text-gray-900 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-medium"
                                />
                            </div>
                        </div>

                        {/* Password Section */}
                        <div className="space-y-2">
                            <label htmlFor="password" className="block text-sm font-bold text-gray-700">
                                Mot de Passe <span className="text-gray-400 font-normal">(laisser vide pour ne pas changer)</span>
                            </label>
                            <div className="mt-2 relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    id="password"
                                    className="block w-full rounded-xl border-gray-200 py-3 px-4 pr-12 text-gray-900 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-medium"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-indigo-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Messages */}
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-bold animate-in shake duration-300">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-sm font-bold animate-in fade-in zoom-in duration-300">
                            Modifications enregistrées avec succès !
                        </div>
                    )}
                </div>

                <div className="px-8 py-6 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                    <p className="text-xs text-gray-400 italic">Dernière modification : {new Date().toLocaleDateString()}</p>
                    <div className="flex gap-4">
                        <Link
                            href="/employees"
                            className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-800 transition-colors"
                        >
                            Annuler
                        </Link>
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200 font-bold active:scale-95 disabled:opacity-50"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Chargement...
                                </span>
                            ) : (
                                <>
                                    <Save className="h-5 w-5" />
                                    Sauvegarder
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    )
}
