'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { ChatMessage, ChatConversation } from '@/lib/types/chat'
import { getSession } from '@/app/auth/actions'

export async function getEmployees() {
    const adminClient = createAdminClient()
    const { data, error } = await adminClient
        .from('employees')
        .select('id, full_name, avatar_url, role')
        .order('full_name')

    if (error) {
        console.error('Error fetching employees:', error)
        return []
    }
    return data
}

export async function getConversations() {
    const adminClient = createAdminClient()
    const session = await getSession()
    if (!session?.id) return []
    const userId = session.id

    // 1. Fetch conversations
    const { data: convs, error } = await adminClient
        .from('conversations')
        .select(`
            *,
            user1:employees!conversations_user1_id_fkey(full_name, avatar_url, role),
            user2:employees!conversations_user2_id_fkey(full_name, avatar_url, role)
        `)
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching conversations:', error)
        return []
    }

    // 2. Fetch unread counts for these conversations
    const { data: unreadMessages } = await adminClient
        .from('messages')
        .select('conversation_id')
        .eq('recipient_id', userId)
        .eq('is_read', false)
        // Add a dummy query param or order to discourage any potential middleware caching
        .order('id', { ascending: true })

    const unreadMap: Record<string, number> = {}
    unreadMessages?.forEach(msg => {
        unreadMap[msg.conversation_id] = (unreadMap[msg.conversation_id] || 0) + 1
    })

    // Map to include "other participant" info easily and attach unread count
    return convs.map(conv => ({
        ...conv,
        employee: conv.user1_id === userId ? conv.user2 : conv.user1,
        employee_id: conv.user1_id === userId ? conv.user2_id : conv.user1_id,
        unread_count: unreadMap[conv.id] || 0
    })) as ChatConversation[]
}

export async function getMessages(conversationId: string) {
    const adminClient = createAdminClient()

    const { data, error } = await adminClient
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

    if (error) {
        console.error('Error fetching messages:', error)
        return []
    }

    return data as ChatMessage[]
}

export async function sendMessage(conversationId: string, content: string, senderId: string, senderRole: 'admin' | 'employee') {
    const adminClient = createAdminClient()

    // 1. Resolve recipient from conversation
    const { data: conv } = await adminClient
        .from('conversations')
        .select('user1_id, user2_id')
        .eq('id', conversationId)
        .single()

    if (!conv) return { error: 'Conversation not found' }

    const recipientId = conv.user1_id === senderId ? conv.user2_id : conv.user1_id

    // 2. Insert message with recipient_id for high-performance RLS
    const { data, error } = await adminClient
        .from('messages')
        .insert({
            conversation_id: conversationId,
            content,
            sender_id: senderId,
            sender_role: senderRole,
            recipient_id: recipientId,
            is_read: false
        })
        .select()
        .single()

    if (error) {
        console.error('Error sending message:', error)
        return { error: error.message }
    }

    revalidatePath('/messages')
    return { success: true, message: data }
}

/**
 * PRODUCTION: Fetches exact unread count for the current user.
 * Uses head: true to avoid fetching data, making it O(1) with the database index.
 */
export async function getUnreadCount(): Promise<number> {
    const adminClient = createAdminClient()
    const session = await getSession()
    if (!session?.id) return 0

    try {
        const { count, error } = await adminClient
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('recipient_id', session.id)
            .eq('is_read', false)

        if (error) {
            // Log real errors, but handle missing column gracefully for rollout
            if (error.code !== 'PGRST204' && !error.message?.includes('is_read')) {
                console.error('Error fetching unread count:', error)
            }
            return 0
        }

        return count || 0
    } catch (err) {
        return 0
    }
}

/**
 * Marks all unread messages in a conversation as read.
 * Atomic update restricted by RLS for security.
 */
export async function markConversationAsRead(conversationId: string): Promise<void> {
    const adminClient = createAdminClient()
    const session = await getSession()
    if (!session?.id) return

    try {
        const { error } = await adminClient
            .from('messages')
            .update({ is_read: true })
            .eq('conversation_id', conversationId)
            .eq('recipient_id', session.id)
            .eq('is_read', false)

        if (error) {
            if (error.code !== 'PGRST204' && !error.message?.includes('is_read')) {
                console.error('Error marking conversation as read:', error)
            }
        }
    } catch (err) {
        // Ignore
    }

    revalidatePath('/messages')
}

export async function startConversation(targetId: string) {
    const adminClient = createAdminClient()
    const session = await getSession()

    if (!session?.id) {
        console.error('[startConversation] No active session found')
        return null
    }

    const user1 = session.id
    const user2 = targetId

    console.log(`[startConversation] Checking/Starting chat between ${user1} and ${user2}`)

    // 1. Try to find existing first
    const { data: convs, error: fetchError } = await adminClient
        .from('conversations')
        .select('id, user1_id, user2_id')
        .or(`user1_id.eq.${user1},user2_id.eq.${user1}`)

    if (fetchError) {
        console.error('[startConversation] Error fetching existing conversations:', fetchError)
    }

    const existing = convs?.find(c =>
        (c.user1_id === user1 && c.user2_id === user2) ||
        (c.user1_id === user2 && c.user2_id === user1)
    )

    if (existing) {
        console.log('[startConversation] Found existing conversation:', existing.id)
        return existing.id
    }

    console.log('[startConversation] No existing conversation found, creating new one...')

    // Insert new conversation
    const { data, error } = await adminClient
        .from('conversations')
        .insert({
            user1_id: user1,
            user2_id: user2
        })
        .select('id')
        .single()

    if (error) {
        console.error('[startConversation] Error creating conversation:', error)
        return null
    }

    console.log('[startConversation] Successfully created conversation:', data.id)
    revalidatePath('/messages')
    return data.id
}
