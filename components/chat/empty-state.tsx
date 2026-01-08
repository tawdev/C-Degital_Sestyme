'use client'

import { MessageSquare } from 'lucide-react'

export default function EmptyState() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center transition-all animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6 relative">
                <div className="absolute inset-0 bg-indigo-100 rounded-full animate-pulse opacity-50" />
                <MessageSquare className="w-10 h-10 text-indigo-600 relative z-10" />
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-2">
                Sélectionnez un utilisateur pour commencer à chatter
            </h3>

            <p className="text-sm text-gray-500 mt-1 max-w-sm leading-relaxed">
                Sélectionnez un collègue dans la barre latérale pour afficher l'historique des messages et démarrer une nouvelle discussion en temps réel.
            </p>

            <div className="mt-8 flex gap-2">
                <div className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-500 border border-gray-200">
                    Haute Performance
                </div>
                <div className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-500 border border-gray-200">
                    Chiffrement Complet
                </div>
            </div>
        </div>
    )
}
