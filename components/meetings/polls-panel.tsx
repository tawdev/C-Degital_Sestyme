'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart3, Plus, X, Trash2, CheckCircle2 } from 'lucide-react'
import { useCall } from '@/components/providers/call-provider'

export const PollsPanel = ({ onClose }: { onClose: () => void }) => {
    const { polls, createPoll, voteInPoll, closePoll, meeting, currentUser } = useCall()
    const [isCreating, setIsCreating] = useState(false)
    const [question, setQuestion] = useState('')
    const [options, setOptions] = useState(['', ''])

    const isHost = meeting?.host_id === currentUser?.id

    const handleAddOption = () => setOptions([...options, ''])
    const handleRemoveOption = (index: number) => setOptions(options.filter((_, i) => i !== index))
    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...options]
        newOptions[index] = value
        setOptions(newOptions)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (question.trim() && options.every(o => o.trim())) {
            createPoll(question, options)
            setQuestion('')
            setOptions(['', ''])
            setIsCreating(false)
        }
    }

    return (
        <div className="h-full flex flex-col bg-gray-950/80 backdrop-blur-xl border-l border-white/5 w-80 shadow-2xl">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-sm font-black uppercase tracking-widest text-white">Sondages</h2>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                    <X className="w-4 h-4 text-gray-400" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <AnimatePresence mode="wait">
                    {isCreating ? (
                        <motion.form
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            onSubmit={handleSubmit}
                            className="space-y-4"
                        >
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Question</label>
                                <textarea
                                    value={question}
                                    onChange={(e) => setQuestion(e.target.value)}
                                    placeholder="Posez votre question..."
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[100px] resize-none"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Options</label>
                                {options.map((option, index) => (
                                    <div key={index} className="flex gap-2">
                                        <input
                                            value={option}
                                            onChange={(e) => handleOptionChange(index, e.target.value)}
                                            placeholder={`Option ${index + 1}`}
                                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                            required
                                        />
                                        {options.length > 2 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveOption(index)}
                                                className="p-2 text-gray-500 hover:text-red-400"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {options.length < 5 && (
                                    <button
                                        type="button"
                                        onClick={handleAddOption}
                                        className="w-full py-2 border border-dashed border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-white/5 transition-all"
                                    >
                                        + Ajouter une option
                                    </button>
                                )}
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsCreating(false)}
                                    className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    className="flex-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-lg"
                                >
                                    Lancer
                                </button>
                            </div>
                        </motion.form>
                    ) : (
                        <div className="space-y-6">
                            {isHost && (
                                <button
                                    onClick={() => setIsCreating(true)}
                                    className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all"
                                >
                                    <Plus className="w-4 h-4" />
                                    Créer un sondage
                                </button>
                            )}

                            <div className="space-y-4">
                                {polls.length === 0 ? (
                                    <div className="py-12 flex flex-col items-center justify-center gap-4 border border-dashed border-white/5 rounded-3xl">
                                        <BarChart3 className="w-8 h-8 text-gray-700" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-600">Aucun sondage</p>
                                    </div>
                                ) : (
                                    polls.map((poll) => {
                                        const totalVotes = poll.votes.size
                                        const userVote = poll.votes.get(currentUser?.id)

                                        return (
                                            <motion.div
                                                key={poll.id}
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="bg-white/5 border border-white/5 rounded-3xl overflow-hidden"
                                            >
                                                <div className="p-5 space-y-4">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <h3 className="text-xs font-black uppercase tracking-tight text-white leading-relaxed">
                                                            {poll.question}
                                                        </h3>
                                                        {!poll.isOpen && (
                                                            <span className="shrink-0 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-[8px] font-black uppercase">Terminé</span>
                                                        )}
                                                    </div>

                                                    <div className="space-y-2">
                                                        {poll.options.map((option, index) => {
                                                            const voteCount = Array.from(poll.votes.values()).filter(v => v === index).length
                                                            const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0
                                                            const isVoted = userVote === index

                                                            return (
                                                                <button
                                                                    key={index}
                                                                    disabled={!poll.isOpen || userVote !== undefined}
                                                                    onClick={() => voteInPoll(poll.id, index)}
                                                                    className={`w-full group relative h-10 rounded-xl overflow-hidden transition-all ${isVoted ? 'bg-indigo-600/20' : 'bg-white/5 hover:bg-white/10'}`}
                                                                >
                                                                    {/* Progress Bar */}
                                                                    <motion.div
                                                                        initial={{ width: 0 }}
                                                                        animate={{ width: `${percentage}%` }}
                                                                        className={`absolute inset-y-0 left-0 ${isVoted ? 'bg-indigo-600/30' : 'bg-white/10'}`}
                                                                    />

                                                                    <div className="absolute inset-0 px-4 flex items-center justify-between">
                                                                        <span className="text-[10px] font-black uppercase tracking-tight text-white/90">{option}</span>
                                                                        <div className="flex items-center gap-2">
                                                                            {isVoted && <CheckCircle2 className="w-3 h-3 text-indigo-400" />}
                                                                            <span className="text-[9px] font-black text-gray-500">{Math.round(percentage)}%</span>
                                                                        </div>
                                                                    </div>
                                                                </button>
                                                            )
                                                        })}
                                                    </div>

                                                    <div className="flex items-center justify-between pt-2">
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                                                            {totalVotes} vote(s)
                                                        </span>
                                                        {isHost && poll.isOpen && (
                                                            <button
                                                                onClick={() => closePoll(poll.id)}
                                                                className="text-[9px] font-black uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors"
                                                            >
                                                                Fermer
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
