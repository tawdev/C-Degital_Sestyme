'use client'

import { useState } from 'react'
import { login, signup } from '../actions'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Loader2, ShieldCheck } from 'lucide-react'

export default function LoginPage() {
    const [isLogin, setIsLogin] = useState(true)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showPassword, setShowPassword] = useState(false)

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        setError(null)

        try {
            const action = isLogin ? login : signup
            const result: any = await action(formData)

            if (result?.error) {
                setError(result.error)
            }
        } catch (e) {
            console.error(e)
            setError("Une erreur inattendue est survenue.")
        } finally {
            setLoading(false)
        }
    }

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.3
            }
        }
    } as const

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: {
                type: 'spring',
                stiffness: 100
            }
        }
    } as const

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-[#0a0515] relative overflow-hidden transition-colors duration-500">
            {/* Animated Background Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 dark:bg-indigo-600/20 blur-[100px] rounded-full animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 dark:bg-purple-600/20 blur-[100px] rounded-full animate-pulse" />

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="w-full max-w-lg relative z-10"
            >
                {/* Logo & Header */}
                <motion.div variants={itemVariants} className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-gradient-to-br from-indigo-600 to-purple-700 shadow-2xl shadow-indigo-500/30 mb-6 group hover:scale-110 transition-transform duration-500">
                        <ShieldCheck className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight mb-3">
                        {isLogin ? 'Connectez-vous' : 'Créer un compte'}
                    </h1>
                    <p className="text-gray-500 dark:text-indigo-200/60 font-medium text-lg">
                        Accédez à votre espace de gestion premium
                    </p>
                </motion.div>

                {/* Login Card */}
                <motion.div
                    variants={itemVariants}
                    className="bg-white/70 dark:bg-white/5 backdrop-blur-2xl rounded-[2.5rem] border border-gray-200 dark:border-white/10 p-10 shadow-2xl"
                >
                    <form action={handleSubmit} className="space-y-6">
                        {!isLogin && (
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 dark:text-indigo-300/50 uppercase tracking-[0.2em] ml-2">Nom complet</label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-indigo-400/50 transition-colors group-focus-within:text-indigo-500" />
                                    <input
                                        name="full_name"
                                        type="text"
                                        placeholder="Jean Dupont"
                                        required
                                        className="w-full pl-12 pr-4 py-4 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-indigo-200/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-white/10 transition-all font-medium"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 dark:text-indigo-300/50 uppercase tracking-[0.2em] ml-2">Email Professionnel</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-indigo-400/50 transition-colors group-focus-within:text-indigo-500" />
                                <input
                                    name="email"
                                    type="email"
                                    placeholder="jean@entreprise.fr"
                                    required
                                    className="w-full pl-12 pr-4 py-4 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-indigo-200/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-white/10 transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 dark:text-indigo-300/50 uppercase tracking-[0.2em] ml-2">Mot de passe</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-indigo-400/50 transition-colors group-focus-within:text-indigo-500" />
                                <input
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••••••"
                                    required
                                    className="w-full pl-12 pr-12 py-4 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-indigo-200/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-white/10 transition-all font-medium"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 dark:text-indigo-400/50 hover:text-indigo-500 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <AnimatePresence mode="wait">
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-bold flex items-center gap-2"
                                >
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                    {error}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <motion.button
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            disabled={loading}
                            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    {isLogin ? 'Se connecter' : "S'inscrire"}
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </motion.button>
                    </form>

                    <div className="mt-8 text-center">
                        <button
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-gray-500 dark:text-indigo-300/50 hover:text-indigo-600 dark:hover:text-white text-xs font-black uppercase tracking-widest transition-colors"
                        >
                            {isLogin ? "Pas encore de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
                        </button>
                    </div>
                </motion.div>
            </motion.div>

            {/* Footer Attribution */}
            <motion.p
                variants={itemVariants}
                className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-black text-gray-400 dark:text-indigo-300/20 uppercase tracking-[0.3em]"
            >
                © 2026 EmpManager • Sécurisé par Système Digital
            </motion.p>
        </div>
    )
}
