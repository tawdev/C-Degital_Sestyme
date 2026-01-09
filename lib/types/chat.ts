export type ChatRole = 'admin' | 'employee'

export interface ChatMessage {
    id: string
    conversation_id: string
    sender_id: string
    sender_role: ChatRole
    recipient_id: string
    content: string
    is_read: boolean
    created_at: string
}

export interface ChatConversation {
    id: string
    user1_id: string
    user2_id: string
    employee_id: string // Resolved for UI convenience
    created_at: string
    unread_count?: number
    // Joined data
    employee?: {
        id: string
        full_name: string
        avatar_url: string | null
        role?: string
    }
}
