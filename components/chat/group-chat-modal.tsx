import { useState, useRef } from 'react'
import { X, Users, Loader2, Check, Camera } from 'lucide-react'
import { createGroupChat } from '@/app/(main)/chat/actions'
import EmployeeAvatar from '@/components/employee-avatar'
import { useRouter } from 'next/navigation'

interface GroupChatModalProps {
    isOpen: boolean
    onClose: () => void
    contacts: any[]
}

export default function GroupChatModal({ isOpen, onClose, contacts }: GroupChatModalProps) {
    const [name, setName] = useState('')
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [avatarFile, setAvatarFile] = useState<File | null>(null)
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()

    if (!isOpen) return null

    const toggleUser = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setAvatarFile(file)
            const reader = new FileReader()
            reader.onloadend = () => setAvatarPreview(reader.result as string)
            reader.readAsDataURL(file)
        }
    }

    const handleCreate = async () => {
        if (!name.trim()) return setError('Please enter a group name')
        if (selectedIds.length === 0) return setError('Please select at least one member')

        setLoading(true)
        setError(null)

        try {
            const formData = new FormData()
            formData.append('name', name)
            formData.append('userIds', JSON.stringify(selectedIds))
            if (avatarFile) formData.append('avatar', avatarFile)

            const res = await createGroupChat(formData)
            if (res.error) {
                setError(res.error)
            } else {
                router.push(`/chat?id=${res.conversationId}`)
                onClose()
            }
        } catch (err) {
            setError('An unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-2 text-indigo-600">
                        <Users className="w-5 h-5" />
                        <h3 className="font-bold text-gray-900">Create Group Chat</h3>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 flex-1 overflow-y-auto space-y-6">
                    {/* Avatar Upload */}
                    <div className="flex flex-col items-center gap-2">
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="relative w-20 h-20 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-all overflow-hidden group"
                        >
                            {avatarPreview ? (
                                <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <Camera className="w-8 h-8 text-gray-400" />
                            )}
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Camera className="w-6 h-6 text-white" />
                            </div>
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/*"
                            className="hidden"
                        />
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Group Avatar</span>
                    </div>

                    {/* Group Name input */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                            Group Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Project Alpha Team"
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm text-gray-900"
                        />
                    </div>

                    {/* Member selection */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 ml-1">
                            Select Members ({selectedIds.length})
                        </label>
                        <div className="space-y-1">
                            {contacts.map((contact) => (
                                <button
                                    key={contact.id}
                                    onClick={() => toggleUser(contact.id)}
                                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all border ${selectedIds.includes(contact.id)
                                        ? 'bg-indigo-50 border-indigo-100 shadow-sm'
                                        : 'border-transparent hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="relative">
                                        <EmployeeAvatar
                                            avatarUrl={contact.avatar_url}
                                            fullName={contact.full_name || contact.fullName}
                                        />
                                        {selectedIds.includes(contact.id) && (
                                            <div className="absolute -top-1 -right-1 bg-indigo-600 text-white rounded-full p-0.5 shadow-sm">
                                                <Check className="w-3 h-3" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">
                                            {contact.full_name || contact.fullName}
                                        </p>
                                        <p className="text-[10px] text-gray-500">{contact.role || 'Member'}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-100">
                    {error && (
                        <p className="text-xs text-red-500 mb-3 ml-1 flex items-center gap-1 animate-in slide-in-from-top-1">
                            {error}
                        </p>
                    )}
                    <button
                        onClick={handleCreate}
                        disabled={loading || !name.trim() || selectedIds.length === 0}
                        className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <Users className="w-5 h-5" />
                                <span>Create Group</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
