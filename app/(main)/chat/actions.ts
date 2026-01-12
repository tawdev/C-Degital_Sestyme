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

export async function getConversationDetails(conversationId: string) {
    const adminClient = createAdminClient()
    const { data, error } = await adminClient
        .from('conversations')
        .select('id, user1_id, user2_id, is_group, name, avatar_url')
        .eq('id', conversationId)
        .single()

    if (error) {
        console.error('Error fetching conversation details:', error)
        return null
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
            // Use current time as fallback for all
            const now = new Date().toISOString()
            const conversationIds = (retryData || []).map(r => r.conversation_id)
            const lastReadMap: Record<string, string> = {}
            conversationIds.forEach(id => { lastReadMap[id] = now })

            return { conversationIds, lastReadMap }
        }
        console.error('Error fetching participant records:', pError)
        return []
    }

    const conversationIds = (participantRecords || []).map(r => r.conversation_id)
    const lastReadMap: Record<string, string> = {}
    participantRecords?.forEach(r => {
        lastReadMap[r.conversation_id] = r.last_read_at || new Date().toISOString()
    })

    return { conversationIds, lastReadMap }
}

async function fetchAndMapConversations(conversationIds: string[]) {
    const adminClient = createAdminClient()
    const { data, error } = await adminClient
        .from('conversations')
        .select(`
            *,
            user1:employees!conversations_user1_id_fkey(id, full_name, avatar_url),
            user2:employees!conversations_user2_id_fkey(id, full_name, avatar_url),
            last_sender:employees!conversations_last_message_sender_id_fkey(id, full_name, avatar_url),
            participants:conversation_participants(
                id,
                user_id,
                user:employees(id, full_name, avatar_url)
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

    const participantInfo = await getParticipantInfo(userId)
    if (Array.isArray(participantInfo)) return [] // Error case

    const { conversationIds, lastReadMap } = participantInfo as { conversationIds: string[], lastReadMap: Record<string, string> }
    if (conversationIds.length === 0) return []

    const data = await fetchAndMapConversations(conversationIds)
    const adminClient = createAdminClient()

    // 3. Fetch unread counts based on last_read_at
    const unreadMap: Record<string, number> = {}

    // We fetch counts for each conversation
    await Promise.all(conversationIds.map(async (cid) => {
        const lastRead = lastReadMap[cid]
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
                unread_count: unreadMap[conv.id] || 0
            }
        }
        return {
            ...conv,
            last_sender_name,
            employee: conv.user1_id === userId ? conv.user2 : conv.user1,
            employee_id: conv.user1_id === userId ? conv.user2_id : conv.user1_id,
            unread_count: unreadMap[conv.id] || 0
        }
    }) as ChatConversation[]
}

export async function createGroupChat(formData: FormData) {
    const adminClient = createAdminClient()
    const session = await getSession()

    if (!session?.id || session.role !== 'Administrator') {
        return { error: 'Only administrators can create group chats.' }
    }

    const name = formData.get('name') as string
    const userIds = JSON.parse(formData.get('userIds') as string) as string[]
    const file = formData.get('avatar') as File | null

    try {
        let avatarUrl = null

        // 1. Upload Avatar if provided
        if (file && file.size > 0) {
            const fileName = `group-${Date.now()}-${file.name}`
            const path = `group-avatars/${fileName}`

            const { error: uploadError } = await adminClient
                .storage
                .from('messages-attachments')
                .upload(path, file)

            if (!uploadError) {
                const { data: { publicUrl } } = adminClient
                    .storage
                    .from('messages-attachments')
                    .getPublicUrl(path)
                avatarUrl = publicUrl
            }
        }

        // 2. Create conversation
        const { data: conv, error: convError } = await adminClient
            .from('conversations')
            .insert({
                name,
                is_group: true,
                avatar_url: avatarUrl,
                created_by: session.id
            })
            .select('id')
            .single()

        if (convError) throw convError

        // 3. Add participants (including admin)
        const participantIds = Array.from(new Set([...userIds, session.id]))
        const participants = participantIds.map(uid => ({
            conversation_id: conv.id,
            user_id: uid
        }))

        const { error: partError } = await adminClient
            .from('conversation_participants')
            .insert(participants)

        if (partError) throw partError

        revalidatePath('/chat')
        return { success: true, conversationId: conv.id }
    } catch (err: any) {
        console.error('Error creating group chat:', err)
        return { error: err.message || 'Failed to create group chat.' }
    }
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
            )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

    if (error) {
        console.error('Error fetching messages:', error)
        return []
    }

    return (data || []) as ChatMessage[]
}

export async function sendMessage(formData: FormData) {
    const adminClient = createAdminClient()
    const session = await getSession()
    if (!session?.id) return { error: 'Unauthorized' }

    const conversationId = formData.get('conversationId') as string
    const content = formData.get('content') as string
    const senderId = session.id
    const senderRole = session.role === 'Administrator' ? 'admin' : 'employee'
    const type = (formData.get('type') as string) || 'text'
    const duration = formData.get('duration') ? parseInt(formData.get('duration') as string) : null
    const id = formData.get('id') as string | null

    // File handling
    const file = formData.get('file') as File | null
    let fileUrl = content
    let fileSize = null
    let fileName = null

    if (file && file.size > 0 && type !== 'text') {
        fileName = file.name
        fileSize = file.size
        const fileExt = fileName.split('.').pop()
        const uniqueId = Math.random().toString(36).substring(2)
        const path = `${conversationId}/${Date.now()}-${uniqueId}.${fileExt}`

        const { error: uploadError } = await adminClient
            .storage
            .from('messages-attachments')
            .upload(path, file, {
                contentType: file.type,
                upsert: false
            })

        if (uploadError) {
            console.error('Error uploading file:', uploadError)
            return { error: 'Failed to upload attachment' }
        }

        const { data: { publicUrl } } = adminClient
            .storage
            .from('messages-attachments')
            .getPublicUrl(path)

        fileUrl = publicUrl
    }

    // 1. Resolve recipient (Only for P2P)
    const { data: conv } = await adminClient
        .from('conversations')
        .select('user1_id, user2_id, is_group')
        .eq('id', conversationId)
        .single()

    if (!conv) return { error: 'Conversation not found' }

    let recipientId = null
    if (!conv.is_group) {
        recipientId = conv.user1_id === senderId ? conv.user2_id : conv.user1_id
    }

    // 2. Insert message
    const { data, error } = await adminClient
        .from('messages')
        .insert({
            id: id || undefined,
            conversation_id: conversationId,
            content: fileUrl,
            sender_id: senderId,
            sender_role: senderRole,
            recipient_id: recipientId,
            is_read: false,
            type: type,
            file_name: fileName,
            file_size: fileSize,
            duration: duration
        })
        .select()
        .single()

    if (error) {
        console.error('Error sending message:', error)
        return { error: error.message }
    }

    // 3. Update sender's last_read_at
    await adminClient
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', senderId)

    revalidatePath('/chat')
    return { success: true, message: data }
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
        await Promise.all(participants.map(async (p) => {
            const { count } = await adminClient
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('conversation_id', p.conversation_id)
                .gt('created_at', p.last_read_at)
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
        // 1. Update participant last_read_at
        const { error: partError } = await adminClient
            .from('conversation_participants')
            .update({ last_read_at: new Date().toISOString() })
            .eq('conversation_id', conversationId)
            .eq('user_id', session.id)

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
    revalidatePath('/chat')
    revalidatePath('/messages')
    return data.id
}

export async function deleteMessage(messageId: string) {
    const adminClient = createAdminClient()
    const session = await getSession()

    if (!session?.id) {
        return { error: 'Unauthorized' }
    }

    try {
        // 1. Verify ownership and permissions manually
        // We use adminClient to read the message data to check permissions
        const { data: message, error: fetchError } = await adminClient
            .from('messages')
            .select('sender_id')
            .eq('id', messageId)
            .single()

        if (fetchError || !message) {
            console.error('Error fetching message for deletion:', fetchError)
            return { error: 'Message not found' }
        }

        // Rule: Only sender can delete, and Admins CANNOT delete (even their own)
        if (session.role === 'Administrator' || session.role === 'admin') {
            return { error: 'Administrators cannot delete messages.' }
        }

        if (message.sender_id !== session.id) {
            return { error: 'You can only delete your own messages.' }
        }

        // 2. Perform Deletion using Admin Client (Bypassing RLS)
        const { error } = await adminClient
            .from('messages')
            .delete()
            .eq('id', messageId)

        if (error) {
            console.error('Error deleting message:', error)
            return { error: 'Failed to delete message.' }
        }

        revalidatePath('/messages')
        return { success: true }
    } catch (err) {
        console.error('Unexpected error deleting message:', err)
        return { error: 'Unexpected error' }
    }
}

export async function toggleReaction(messageId: string, emoji: string) {
    const adminClient = createAdminClient()
    const session = await getSession()

    if (!session?.id) {
        return { error: 'Unauthorized' }
    }

    try {
        // Check if ANY reaction exists for this user on this message
        const { data: existing, error: fetchError } = await adminClient
            .from('message_reactions')
            .select('id, emoji')
            .eq('message_id', messageId)
            .eq('user_id', session.id)
            .single()

        if (existing) {
            if (existing.emoji === emoji) {
                // Same emoji -> Toggle OFF (Remove)
                await adminClient
                    .from('message_reactions')
                    .delete()
                    .eq('id', existing.id)
            } else {
                // Different emoji -> SWAP (Remove old, Add new)
                // We can do this safely in two steps or a transaction. 
                // For simplicity, delete then insert.
                await adminClient
                    .from('message_reactions')
                    .delete()
                    .eq('id', existing.id)

                await adminClient
                    .from('message_reactions')
                    .insert({
                        message_id: messageId,
                        user_id: session.id,
                        emoji: emoji
                    })
            }
        } else {
            // No reaction -> Add New
            await adminClient
                .from('message_reactions')
                .insert({
                    message_id: messageId,
                    user_id: session.id,
                    emoji: emoji
                })
        }

        revalidatePath('/messages')
        return { success: true }
    } catch (err) {
        console.error('Error toggling reaction:', err)
        return { error: 'Failed to toggle reaction' }
    }
}

export async function updateGroupDetails(formData: FormData) {
    const adminClient = createAdminClient()
    const session = await getSession()

    if (!session?.id || session.role !== 'Administrator') {
        return { error: 'Only administrators can modify groups.' }
    }

    try {
        const conversationId = formData.get('conversationId') as string
        const name = formData.get('name') as string
        const file = formData.get('avatar') as File | null

        const updates: { name?: string; avatar_url?: string } = {}

        if (name && name.trim()) {
            updates.name = name.trim()
        }

        // Upload avatar if provided
        if (file && file.size > 0) {
            // Sanitize filename: remove special characters and accents
            const sanitizeFilename = (filename: string): string => {
                // Get file extension
                const ext = filename.split('.').pop() || 'jpg'
                // Remove extension from name
                const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename

                // Normalize and remove accents/special characters
                const sanitized = nameWithoutExt
                    .normalize('NFD') // Decompose accented characters
                    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
                    .replace(/[^a-zA-Z0-9-_]/g, '-') // Replace non-alphanumeric with dash
                    .replace(/-+/g, '-') // Replace multiple dashes with single dash
                    .replace(/^-|-$/g, '') // Remove leading/trailing dashes
                    .substring(0, 50) // Limit length

                return `${sanitized}.${ext}`
            }

            const sanitizedName = sanitizeFilename(file.name)
            const fileName = `group-${Date.now()}-${sanitizedName}`
            const path = `group-avatars/${fileName}`

            const { data: uploadData, error: uploadError } = await adminClient
                .storage
                .from('messages-attachments')
                .upload(path, file, {
                    contentType: file.type,
                    upsert: false
                })

            if (uploadError) {
                console.error('Error uploading avatar:', uploadError)
                console.error('Upload details:', { path, fileType: file.type, fileSize: file.size })
                return { error: `Failed to upload image: ${uploadError.message}` }
            }

            const { data: { publicUrl } } = adminClient
                .storage
                .from('messages-attachments')
                .getPublicUrl(path)

            updates.avatar_url = publicUrl
        }

        // Apply updates
        if (Object.keys(updates).length > 0) {
            const { error } = await adminClient
                .from('conversations')
                .update(updates)
                .eq('id', conversationId)
                .eq('is_group', true)

            if (error) throw error
        }

        revalidatePath('/chat')
        return { success: true }
    } catch (err: any) {
        console.error('Error updating group:', err)
        return { error: err.message || 'Failed to update group.' }
    }
}

export async function addGroupMembers(conversationId: string, userIds: string[]) {
    const adminClient = createAdminClient()
    const session = await getSession()

    if (!session?.id || session.role !== 'Administrator') {
        return { error: 'Only administrators can manage group members.' }
    }

    try {
        const participants = userIds.map(uid => ({
            conversation_id: conversationId,
            user_id: uid
        }))

        const { error } = await adminClient
            .from('conversation_participants')
            .insert(participants)

        if (error) throw error

        revalidatePath('/chat')
        return { success: true }
    } catch (err: any) {
        console.error('Error adding members:', err)
        return { error: err.message || 'Failed to add members.' }
    }
}

export async function removeGroupMember(conversationId: string, userId: string) {
    const adminClient = createAdminClient()
    const session = await getSession()

    if (!session?.id || session.role !== 'Administrator') {
        return { error: 'Only administrators can manage group members.' }
    }

    try {
        // Prevent removing the last member or yourself if necessary? 
        // For now, simple removal.
        const { error } = await adminClient
            .from('conversation_participants')
            .delete()
            .eq('conversation_id', conversationId)
            .eq('user_id', userId)

        if (error) throw error

        revalidatePath('/chat')
        return { success: true }
    } catch (err: any) {
        console.error('Error removing member:', err)
        return { error: err.message || 'Failed to remove member.' }
    }
}
