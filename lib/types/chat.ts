export type ChatRole = 'admin' | 'employee'

export interface ChatMessage {
    id: string
    conversation_id: string
    sender_id: string
    sender_role: ChatRole
    recipient_id: string
    content: string
    is_read: boolean
    type: string
    file_name?: string | null
    file_size?: number | null
    duration?: number | null
    created_at: string
    reactions: {
        id: string
        user_id: string
        emoji: string
    }[]
    sender?: {
        id: string
        full_name: string
        avatar_url: string | null
    }
}

export interface ChatMessageReaction {
    id: string
    message_id: string
    user_id: string
    emoji: string
}

export interface ChatParticipant {
    id: string
    conversation_id: string
    user_id: string
    user?: {
        id: string
        full_name: string
        avatar_url: string | null
        role?: string
    }
    last_read_at: string
}

export interface ChatConversation {
    id: string
    user1_id?: string
    user2_id?: string
    employee_id?: string // Resolved for UI convenience for P2P
    is_group: boolean
    name?: string
    avatar_url?: string | null
    created_at: string
    unread_count?: number
    // Joined data
    employee?: {
        id: string
        full_name: string
        avatar_url: string | null
        role?: string
    }
    participants?: ChatParticipant[]
    // Last activity fields
    last_message_at?: string
    last_message_content?: string
    last_message_sender_id?: string
    last_sender_name?: string
}
