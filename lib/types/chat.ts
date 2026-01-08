export type ChatRole = 'admin' | 'employee'

export interface ChatMessage {
    id: string
    conversation_id: string
    sender_id: string
    sender_role: ChatRole
    content: string
    created_at: string
}

export interface ChatConversation {
    id: string
    employee_id: string
    created_at: string
    // Optional joined data
    employee?: {
        full_name: string
        avatar_url: string | null
    }
}
