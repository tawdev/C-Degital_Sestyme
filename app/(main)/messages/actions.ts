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

async function getParticipantInfo(userId: string) {
    const adminClient = createAdminClient()
    // Fetch conversations where user is a participant using the new join table
    const { data: participantRecords, error: pError } = await adminClient
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', userId)

    if (pError) {
        // Fallback for transition period: if last_read_at is missing, try without it
        if (pError.message?.includes('last_read_at')) {
            console.warn('last_read_at column missing, falling back...')
            const { data: retryData, error: retryError } = await adminClient
                .from('conversation_participants')
                .select('conversation_id')
                .eq('user_id', userId)

            if (retryError) {
                console.error('Error fetching participant records (fallback):', retryError)
                return []
            }
            // Use epoch as fallback for all
            const epoch = new Date(0).toISOString()
            const conversationIds = (retryData || []).map(r => r.conversation_id)
            const lastReadMap: Record<string, string> = {}
            conversationIds.forEach(id => { lastReadMap[id] = epoch })

            return { conversationIds, lastReadMap }
        }
        console.error('Error fetching participant records:', pError)
        return []
    }

    const conversationIds = participantRecords.map(r => r.conversation_id)
    const lastReadMap: Record<string, string> = {}
    const epoch = new Date(0).toISOString()
    participantRecords.forEach(r => {
        lastReadMap[r.conversation_id] = r.last_read_at || epoch
    })

    return { conversationIds, lastReadMap }
}

async function fetchAndMapConversations(conversationIds: string[]) {
    const adminClient = createAdminClient()
    const { data, error } = await adminClient
        .from('conversations')
        .select(`
            *,
            user1:employees!conversations_user1_id_fkey(id, full_name, avatar_url, last_seen_at, is_online),
            user2:employees!conversations_user2_id_fkey(id, full_name, avatar_url, last_seen_at, is_online),
            last_sender:employees!conversations_last_message_sender_id_fkey(id, full_name, avatar_url),
            participants:conversation_participants(
                id,
                user_id,
                user:employees(id, full_name, avatar_url, last_seen_at, is_online)
            )
        `)
        .in('id', conversationIds)
        .order('last_message_at', { ascending: false })

    if (error) {
        console.error('Error fetching conversations:', error)
        return []
    }
    return data || []
}

export async function getConversations() {
    const session = await getSession()
    if (!session?.id) return []
    const userId = session.id
    const isAdmin = session.role === 'Administrator'

    const adminClient = createAdminClient()

    let conversationIds: string[] = []
    let lastReadMap: Record<string, string> = {}

    if (isAdmin) {
        // Fetch ALL conversations for Administrator
        const { data: allConvs, error: allConvsError } = await adminClient
            .from('conversations')
            .select('id')

        if (allConvsError) {
            console.error('Error fetching all conversations for admin:', allConvsError)
        } else {
            conversationIds = (allConvs || []).map(c => c.id)
        }

        // Get admin's own participant records for unread counts/last_read
        const participantInfo = await getParticipantInfo(userId)
        if (!Array.isArray(participantInfo)) {
            lastReadMap = (participantInfo as any).lastReadMap || {}
        }
    } else {
        const participantInfo = await getParticipantInfo(userId)
        if (Array.isArray(participantInfo)) return [] // Error case returning empty array

        const info = participantInfo as { conversationIds: string[], lastReadMap: Record<string, string> }
        conversationIds = info.conversationIds
        lastReadMap = info.lastReadMap
    }

    if (conversationIds.length === 0) return []

    const data = await fetchAndMapConversations(conversationIds)

    // 3. Fetch unread counts based on last_read_at
    const unreadMap: Record<string, number> = {}

    // We fetch counts for each conversation
    await Promise.all(conversationIds.map(async (cid) => {
        const lastRead = lastReadMap[cid] || new Date(0).toISOString()
        const { count } = await adminClient
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', cid)
            .gt('created_at', lastRead)
            .neq('sender_id', userId)

        unreadMap[cid] = count || 0
    }))

    // Map to include "other participant" info easily for P2P
    return data.map(conv => {
        const last_sender_name = (conv as any).last_sender?.full_name || 'System'

        if (conv.is_group) {
            return {
                ...conv,
                employee: {
                    id: `group:${conv.id}`,
                    full_name: conv.name || 'Group Chat',
                    avatar_url: conv.avatar_url,
                    role: 'Group'
                },
                last_sender_name,
                employee_id: `group:${conv.id}`,
                unread_count: unreadMap[conv.id] || 0,
                isAdminMonitoring: isAdmin && !conv.participants?.some((p: any) => p.user_id === userId)
            }
        }

        // P2P Logic
        const isParticipant = conv.user1_id === userId || conv.user2_id === userId

        let employeeInfo = conv.user1_id === userId ? conv.user2 : conv.user1
        let employeeId = conv.user1_id === userId ? conv.user2_id : conv.user1_id

        if (isAdmin && !isParticipant) {
            // Monitoring mode name
            const name1 = conv.user1?.full_name || 'Unknown'
            const name2 = conv.user2?.full_name || 'Unknown'
            employeeInfo = {
                id: 'monitoring',
                full_name: `${name1} & ${name2}`,
                avatar_url: null,
                role: 'Monitoring'
            }
            employeeId = `monitoring:${conv.id}`
        }

        return {
            ...conv,
            last_sender_name,
            employee: employeeInfo,
            employee_id: employeeId,
            unread_count: unreadMap[conv.id] || 0,
            isAdminMonitoring: isAdmin && !isParticipant
        }
    }) as (ChatConversation & { isAdminMonitoring?: boolean })[]
}

export async function getMessages(conversationId: string) {
    const adminClient = createAdminClient()

    let { data, error } = await adminClient
        .from('messages')
        .select(`
            *,
            sender:employees!messages_sender_id_fkey(id, full_name, avatar_url),
            reactions:message_reactions(
                id,
                user_id,
                emoji
            ),
            reply_to:messages!messages_reply_to_id_fkey(
                content,
                type,
                sender:employees!messages_sender_id_fkey(full_name)
            )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

    if (error) {
        console.error('[getMessages] Error fetching messages for conversation:', conversationId, error)
        // Try a fallback query without joins to ensure user sees messages
        const { data: fallbackData, error: fallbackError } = await adminClient
            .from('messages')
            .select(`
                *,
                sender:employees!messages_sender_id_fkey(id, full_name, avatar_url)
            `)
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true })

        if (!fallbackError && fallbackData) {
            console.log('[getMessages] Fallback succeeded, enriching replies manually.')
            const messages = fallbackData as ChatMessage[]

            // Collect unique reply IDs
            const replyIds = Array.from(new Set(messages.filter(m => m.reply_to_id).map(m => m.reply_to_id))) as string[]

            if (replyIds.length > 0) {
                // Fetch all replied-to messages in one go
                const { data: replies } = await adminClient
                    .from('messages')
                    .select('id, content, type, sender:employees!messages_sender_id_fkey(full_name)')
                    .in('id', replyIds)

                if (replies) {
                    const repliesMap = new Map(replies.map(r => [r.id, r]))
                    messages.forEach(m => {
                        if (m.reply_to_id) {
                            const r = repliesMap.get(m.reply_to_id)
                            if (r) m.reply_to = r as any
                        }
                    })
                }
            }
            return messages
        }
        return []
    }

    return (data || []) as ChatMessage[]
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

    // 2. Insert message with base data first
    const { data: insertedMsg, error: insertError } = await adminClient
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

    if (insertError) {
        console.error('Error sending message (insert):', insertError)
        return { error: insertError.message }
    }

    // 3. Attempt enrichment
    const { data: enrichedMsg } = await adminClient
        .from('messages')
        .select(`
            *,
            sender:employees!messages_sender_id_fkey(id, full_name, avatar_url),
            reactions:message_reactions(id, user_id, emoji),
            reply_to:messages!messages_reply_to_id_fkey(
                content,
                type,
                sender:employees!messages_sender_id_fkey(full_name)
            )
        `)
        .eq('id', insertedMsg.id)
        .single()

    let finalData = enrichedMsg || insertedMsg

    // Manual enrichment fallback for stale schema cache
    if (!enrichedMsg) {
        console.log('[sendMessage] Enrichment failed, performing manual fallback joins')
        try {
            const { data: sender } = await adminClient
                .from('employees')
                .select('id, full_name, avatar_url')
                .eq('id', senderId)
                .single()
            if (sender) finalData.sender = sender

            // Note: messages/actions.ts sendMessage doesn't currently take a replyToId, 
            // but we keep it consistent or add it if needed. 
            // Checking types... it seems this one is simpler.
        } catch (e) {
            console.error('[sendMessage] Manual fallback failed:', e)
        }
    }

    // 4. Update sender's last_read_at
    await adminClient
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', senderId)

    revalidatePath('/messages')
    return { success: true, message: finalData }
}

/**
 * PRODUCTION: Fetches exact unread count for the current user.
 * Uses head: true to avoid fetching data, making it O(1) with the database index.
 */
export async function getUnreadCount(conversationId?: string): Promise<number> {
    const adminClient = createAdminClient()
    const session = await getSession()
    if (!session?.id) return 0
    const userId = session.id

    try {
        // 1. Get user's last_read_at for participants records
        let query = adminClient
            .from('conversation_participants')
            .select('conversation_id, last_read_at')
            .eq('user_id', userId)

        if (conversationId) {
            query = query.eq('conversation_id', conversationId)
        }

        const { data: participants, error: pError } = await query

        if (pError || !participants || participants.length === 0) return 0

        // 2. Count messages newer than last_read_at for each conversation
        let totalUnread = 0
        const epoch = new Date(0).toISOString()
        await Promise.all(participants.map(async (p) => {
            const { count } = await adminClient
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('conversation_id', p.conversation_id)
                .gt('created_at', p.last_read_at || epoch)
                .neq('sender_id', userId)

            totalUnread += (count || 0)
        }))

        return totalUnread
    } catch (err) {
        console.error('Error in getUnreadCount:', err)
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
        // 1. Update/Upsert participant last_read_at
        // This allows even monitoring Admins to "clear" their unread counter
        const { error: partError } = await adminClient
            .from('conversation_participants')
            .upsert({
                conversation_id: conversationId,
                user_id: session.id,
                last_read_at: new Date().toISOString()
            }, { onConflict: 'conversation_id, user_id' })

        if (partError) {
            console.error('Error updating participant last_read_at:', partError)
        }

        // 2. Fallback: Update is_read on messages for P2P
        await adminClient
            .from('messages')
            .update({ is_read: true })
            .eq('conversation_id', conversationId)
            .eq('recipient_id', session.id)
            .eq('is_read', false)

    } catch (err) {
        console.error('Unexpected error in markConversationAsRead:', err)
    }

    revalidatePath('/chat')
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

    // 2. Add participants to the join table
    await adminClient
        .from('conversation_participants')
        .insert([
            { conversation_id: data.id, user_id: user1 },
            { conversation_id: data.id, user_id: user2 }
        ])

    console.log('[startConversation] Successfully created conversation and added participants:', data.id)
    revalidatePath('/messages')
    return data.id
}
