'use client'

import { useState } from 'react'
import { debugUserIdentity } from './debug-actions'

export default function DebugUserPanel() {
    const [email, setEmail] = useState('simoibaali2004@gmail.com')
    const [result, setResult] = useState<any>(null)
    const [loading, setLoading] = useState(false)

    const runDebug = async () => {
        setLoading(true)
        try {
            const data = await debugUserIdentity(email)
            setResult(data)
        } catch (err) {
            setResult({ error: 'Failed to run action' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="p-8 bg-white rounded-2xl shadow-xl mt-8 border border-gray-100">
            <h2 className="text-xl font-bold mb-4">User Identity Debugger</h2>
            <div className="flex gap-4 mb-6">
                <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="flex-1 rounded-xl border-gray-200"
                />
                <button
                    onClick={runDebug}
                    disabled={loading}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-xl disabled:opacity-50"
                >
                    {loading ? 'Checking...' : 'Check Identity'}
                </button>
            </div>

            {result && (
                <pre className="bg-gray-50 p-4 rounded-xl overflow-auto text-xs">
                    {JSON.stringify(result, null, 2)}
                </pre>
            )}
        </div>
    )
}
