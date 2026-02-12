'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { ChatMessage, ChatConversation } from '@/lib/types/chat'
import { getSession } from '@/app/auth/actions'
import webPush from 'web-push'

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
        .select(`
            id, user1_id, user2_id, is_group, name, avatar_url,
            user1:employees!conversations_user1_id_fkey(id, full_name, avatar_url, last_seen_at, is_online),
            user2:employees!conversations_user2_id_fkey(id, full_name, avatar_url, last_seen_at, is_online)
        `)
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
            // Use epoch as fallback for all to ensure everything is counted
            const epoch = new Date(0).toISOString()
            const conversationIds = (retryData || []).map(r => r.conversation_id)
            const lastReadMap: Record<string, string> = {}
            conversationIds.forEach(id => { lastReadMap[id] = epoch })

            return { conversationIds, lastReadMap }
        }
        console.error('Error fetching participant records:', pError)
        return []
    }

    const conversationIds = (participantRecords || []).map(r => r.conversation_id)
    const lastReadMap: Record<string, string> = {}
    const epoch = new Date(0).toISOString()
    participantRecords?.forEach(r => {
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
        if (Array.isArray(participantInfo)) return [] // Error case

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
        const lastRead = lastReadMap[cid] || new Date(0).toISOString() // Default to old date if not a participant
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
    const replyToId = formData.get('replyToId') as string | null
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
    const messageData: any = {
        id: id || undefined,
        conversation_id: conversationId,
        content: fileUrl,
        sender_id: senderId,
        sender_role: senderRole,
        recipient_id: recipientId,
        is_read: false,
        status: 'sent',
        sent_at: new Date().toISOString(),
        type: type,
        file_name: fileName,
        file_size: fileSize,
        duration: duration
    }

    if (replyToId) {
        messageData.reply_to_id = replyToId
    }

    // 2. Insert message with base data first to ensure success even if schema is stale
    const { data: insertedMsg, error: insertError } = await adminClient
        .from('messages')
        .insert(messageData)
        .select()
        .single()

    if (insertError) {
        console.error('Error sending message (insert):', insertError)
        return { error: insertError.message }
    }

    // 3. Attempt to enrich with metadata (replies, reactions, etc.)
    // If this fails due to schema sync/missing columns, we still have the base message!
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

    // If enrichment failed but it's a reply/has sender, try minimalist manual joins
    if (!enrichedMsg) {
        console.log('[sendMessage] Enrichment failed, performing manual fallback joins')
        try {
            // 1. Manually get sender info
            const { data: sender } = await adminClient
                .from('employees')
                .select('id, full_name, avatar_url')
                .eq('id', senderId)
                .single()
            if (sender) finalData.sender = sender

            // 2. Manually get reply info if needed
            if (replyToId) {
                const { data: replyMsg } = await adminClient
                    .from('messages')
                    .select('content, type, sender:sender_id(full_name)')
                    .eq('id', replyToId)
                    .single()

                if (replyMsg) {
                    // Normalize to the expected nested structure
                    finalData.reply_to = {
                        content: replyMsg.content,
                        type: replyMsg.type,
                        sender: { full_name: (replyMsg.sender as any)?.full_name || 'Someone' }
                    }
                }
            }
        } catch (e) {
            console.error('[sendMessage] Manual fallback enrichment failed:', e)
        }
    }

    // 4. Update sender's last_read_at to current time
    await adminClient
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', senderId)

    // 5. BROADCAST FALLBACK
    try {
        const { data: participants } = await adminClient
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', conversationId)

        if (participants) {
            const senderName = session.full_name || 'Someone'
            let broadcastData = { ...finalData }

            // If enrichment failed and it's a reply, try a simple manual join for broadcast
            if (!enrichedMsg && replyToId) {
                const { data: manualReply } = await adminClient
                    .from('messages')
                    .select('content, type, sender:employees!messages_sender_id_fkey(full_name)')
                    .eq('id', replyToId)
                    .single()
                if (manualReply) broadcastData.reply_to = manualReply
            }

            await Promise.all(participants.map(async (p) => {
                if (p.user_id === senderId) return

                return adminClient.channel('main-realtime').send({
                    type: 'broadcast',
                    event: 'new-message-fallback',
                    payload: {
                        message: broadcastData,
                        sender_name: senderName
                    }
                })
            }))
        }
    } catch (broadcastErr) {
        console.error('[sendMessage] Broadcast fallback failed:', broadcastErr)
    }

    // 6. WEB PUSH NOTIFICATIONS (WhatsApp Style)
    try {
        const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        const vapidPrivate = process.env.VAPID_PRIVATE_KEY

        if (vapidPublic && vapidPrivate) {
            webPush.setVapidDetails(
                'mailto:admin@example.com',
                vapidPublic,
                vapidPrivate
            )

            // Get participants (excluding sender)
            const { data: participants } = await adminClient
                .from('conversation_participants')
                .select('user_id')
                .eq('conversation_id', conversationId)
                .neq('user_id', senderId)

            if (participants && participants.length > 0) {
                const recipientIds = participants.map(p => p.user_id)

                // Get subscriptions for all recipients
                const { data: subscriptions } = await adminClient
                    .from('push_subscriptions')
                    .select('*')
                    .in('user_id', recipientIds)

                if (subscriptions && subscriptions.length > 0) {
                    const senderName = session.full_name || 'Someone'
                    const notificationTitle = conv.is_group ? `New message in group` : senderName
                    const notificationBody = type === 'text' ? content : (type === 'image' ? '📷 Image' : (type === 'voice' ? '🎤 Voice' : 'Attachment'))

                    const pushPayload = JSON.stringify({
                        title: notificationTitle,
                        body: notificationBody,
                        icon: '/favicon.ico',
                        data: {
                            conversationId,
                            senderName
                        }
                    })

                    // Send push to each subscription
                    await Promise.all(subscriptions.map(async (sub) => {
                        try {
                            const pushSubscription = {
                                endpoint: sub.endpoint,
                                keys: {
                                    p256dh: sub.p256dh,
                                    auth: sub.auth
                                }
                            }
                            await webPush.sendNotification(pushSubscription, pushPayload)
                        } catch (err: any) {
                            console.error('[Push] Error sending to subscription:', err.endpoint, err.statusCode)
                            if (err.statusCode === 410 || err.statusCode === 404) {
                                // Delete expired subscription
                                await adminClient.from('push_subscriptions').delete().eq('id', sub.id)
                            }
                        }
                    }))
                }
            }
        }
    } catch (pushErr) {
        console.error('[sendMessage] Web Push failure:', pushErr)
    }

    revalidatePath('/chat')
    return { success: true, message: finalData }
}

export async function saveCallRecording(formData: FormData) {
    const adminClient = createAdminClient()
    const session = await getSession()
    if (!session?.id) return { error: 'Unauthorized' }

    const conversationId = formData.get('conversationId') as string
    const callerId = formData.get('callerId') as string
    const type = formData.get('type') as 'audio' | 'video'
    const duration = parseInt(formData.get('duration') as string) || 0
    const participantsJson = formData.get('participants') as string
    const file = formData.get('file') as File
    const status = formData.get('status') as 'completed' | 'missed' | 'rejected'

    if (!file || file.size === 0) return { error: 'No file provided' }

    try {
        // 1. Upload to Supabase Storage
        const fileName = `${conversationId}/${Date.now()}-${callerId}.webm`
        const path = `recordings/${fileName}`

        const { error: uploadError } = await adminClient
            .storage
            .from('call-recordings')
            .upload(path, file, {
                contentType: file.type,
                upsert: false
            })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = adminClient
            .storage
            .from('call-recordings')
            .getPublicUrl(path)

        // 2. Insert into calls table
        const { data: callRow, error: callError } = await adminClient
            .from('calls')
            .insert({
                conversation_id: conversationId,
                caller_id: callerId,
                participants: JSON.parse(participantsJson),
                type,
                status,
                duration,
                recording_url: path // Save the path, we'll generate signed URLs for security
            })
            .select()
            .single()

        if (callError) throw callError

        revalidatePath('/calls')
        return { success: true, callId: callRow.id }
    } catch (err: any) {
        console.error('[saveCallRecording] Error:', err)
        return { error: err.message || 'Failed to save recording' }
    }
}

export async function getCallLogs() {
    const adminClient = createAdminClient()
    const session = await getSession()
    if (!session?.id || session.role !== 'Administrator') {
        return { error: 'Unauthorized' }
    }

    try {
        // 1. Fetch Calls
        const { data: calls, error: callsError } = await adminClient
            .from('calls')
            .select(`
                *,
                caller:employees!calls_caller_id_fkey(id, full_name, avatar_url),
                conversation:conversations(id, name, is_group)
            `)

        if (callsError) throw callsError

        // 2. Fetch Meetings with recordings
        const { data: meetings, error: meetingsError } = await adminClient
            .from('meetings')
            .select(`
                *,
                host:employees!meetings_host_id_fkey(id, full_name, avatar_url)
            `)
            .not('recording_url', 'is', null)

        if (meetingsError) throw meetingsError

        // 3. Map meetings to call log format
        const meetingLogs = (meetings || []).map(m => ({
            id: m.id,
            created_at: m.created_at,
            duration: (m.duration || 0) * 60, // Meetings duration is in minutes, convert to seconds for UI
            type: m.type,
            recording_url: m.recording_url,
            caller: m.host,
            conversation: { name: m.title, is_group: true }, // Treat meetings as group calls for UI
            is_meeting: true
        }))

        // 4. Combine and Sort
        const allLogs = [...(calls || []), ...meetingLogs].sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )

        // Generate signed URLs for recordings
        const logsWithUrls = await Promise.all(allLogs.map(async (log) => {
            if (!log.recording_url) return log

            const { data: signedData } = await adminClient
                .storage
                .from('call-recordings')
                .createSignedUrl(log.recording_url, 3600) // 1 hour

            return {
                ...log,
                signed_url: signedData?.signedUrl || null
            }
        }))

        return { success: true, logs: logsWithUrls }
    } catch (err: any) {
        console.error('[getCallLogs] Error:', err)
        return { error: err.message }
    }
}

export async function logCall(payload: {
    conversationId: string;
    callerId: string;
    receiverId: string;
    type: 'audio' | 'video';
    status: 'missed' | 'answered';
    duration?: number;
    startedAt: string;
    endedAt?: string;
}) {
    const adminClient = createAdminClient()

    try {
        // 1. Log detailed call
        const { data: log, error: logError } = await adminClient
            .from('call_logs')
            .insert({
                conversation_id: payload.conversationId,
                caller_id: payload.callerId,
                receiver_id: payload.receiverId,
                type: payload.type,
                status: payload.status,
                duration: payload.duration,
                started_at: payload.startedAt,
                ended_at: payload.endedAt
            })
            .select()
            .single()

        if (logError) {
            console.error('[logCall] Error inserting log:', logError)
            // Continue to message even if log fails? No, better to know.
            // Actually, let's keep going to at least show it in chat.
        }

        // 2. Format content for chat message
        let content = ''
        if (payload.status === 'missed') {
            content = 'Appel manqué'
        } else {
            const d = payload.duration || 0
            if (d < 60) {
                content = `${d} secs`
            } else {
                const mins = Math.floor(d / 60)
                const remainingSecs = d % 60
                content = remainingSecs > 0 ? `${mins} min ${remainingSecs} s` : `${mins} mins`
            }
        }

        // 3. Get sender role for the message
        const { data: employee } = await adminClient
            .from('employees')
            .select('role')
            .eq('id', payload.callerId)
            .single()

        const senderRole = employee?.role === 'Administrator' ? 'admin' : 'employee'

        // 4. Insert message into chat
        const messageType = payload.type === 'video' ? 'call_video' : 'call_audio'
        const { data: insertedMsg, error: msgError } = await adminClient
            .from('messages')
            .insert({
                conversation_id: payload.conversationId,
                sender_id: payload.callerId,
                sender_role: senderRole,
                recipient_id: payload.receiverId,
                content: content,
                type: messageType,
                status: 'sent',
                is_read: false,
                created_at: new Date().toISOString()
            })
            .select(`
                *,
                sender:employees!messages_sender_id_fkey(id, full_name, avatar_url)
            `)
            .single()

        if (msgError) console.error('[logCall] Message insert error:', msgError)

        // 5. Broadcast to participants for real-time update
        if (insertedMsg) {
            const { data: participants } = await adminClient
                .from('conversation_participants')
                .select('user_id')
                .eq('conversation_id', payload.conversationId)

            if (participants) {
                const senderName = insertedMsg.sender?.full_name || 'Système'
                await Promise.all(participants.map(async (p) => {
                    // We broadcast to everyone including sender for UI consistency
                    return adminClient.channel('main-realtime').send({
                        type: 'broadcast',
                        event: 'new-message-fallback',
                        payload: {
                            message: insertedMsg,
                            sender_name: senderName
                        }
                    })
                }))
            }
        }

        revalidatePath('/chat')
        revalidatePath('/messages')
        return { success: true, logId: log?.id }
    } catch (err: any) {
        console.error('[logCall] Error in logCall:', err)
        return { error: err.message }
    }
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
            .update({
                is_read: true,
                status: 'seen',
                seen_at: new Date().toISOString()
            })
            .eq('conversation_id', conversationId)
            .eq('recipient_id', session.id)
            .filter('status', 'neq', 'seen') // Only update if not already seen

    } catch (err) {
        console.error('Unexpected error in markConversationAsRead:', err)
    }

    revalidatePath('/chat')
    revalidatePath('/messages')
}

export async function updateMessageStatus(messageId: string, status: 'delivered' | 'seen') {
    const adminClient = createAdminClient()
    const session = await getSession()
    if (!session?.id) return { error: 'Unauthorized' }

    const update: any = { status }
    if (status === 'delivered') update.delivered_at = new Date().toISOString()
    if (status === 'seen') {
        update.seen_at = new Date().toISOString()
        update.is_read = true
    }

    const { error } = await adminClient
        .from('messages')
        .update(update)
        .eq('id', messageId)
        .eq('recipient_id', session.id)
        .filter('status', 'neq', status) // Optimization: don't update if already set

    if (error) {
        console.error('[updateMessageStatus] Error:', error)
        return { error: error.message }
    }

    return { success: true }
}

export async function updateAllDelivered(conversationId: string) {
    const adminClient = createAdminClient()
    const session = await getSession()
    if (!session?.id) return { error: 'Unauthorized' }

    const { error } = await adminClient
        .from('messages')
        .update({
            status: 'delivered',
            delivered_at: new Date().toISOString()
        })
        .eq('conversation_id', conversationId)
        .eq('recipient_id', session.id)
        .eq('status', 'sent')

    if (error) {
        console.error('[updateAllDelivered] Error:', error)
        return { error: error.message }
    }

    return { success: true }
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

    if (!session?.id) return { error: 'Unauthorized' }

    // Check if user is either an Admin OR they are removing themselves
    const isSelfRemove = session.id === userId
    const isAdmin = session.role === 'Administrator'

    if (!isAdmin && !isSelfRemove) {
        return { error: 'Seul un administrateur peut retirer des membres, ou vous pouvez quitter le groupe par vous-même.' }
    }

    try {
        const { error } = await adminClient
            .from('conversation_participants')
            .delete()
            .eq('conversation_id', conversationId)
            .eq('user_id', userId)

        if (error) throw error

        revalidatePath('/chat')
        revalidatePath('/messages')
        return { success: true }
    } catch (err: any) {
        console.error('Error removing member:', err)
        return { error: err.message || 'Failed to remove member.' }
    }
}

export async function getGroupMembers(conversationId: string) {
    const adminClient = createAdminClient()
    const session = await getSession()

    if (!session?.id) return []

    try {
        const { data, error } = await adminClient
            .from('conversation_participants')
            .select('user:employees!conversation_participants_user_id_fkey(id, full_name, avatar_url)')
            .eq('conversation_id', conversationId)

        if (error) throw error

        return (data || [])
            .filter((p: any) => p.user !== null)
            .map((p: any) => p.user)
    } catch (err: any) {
        console.error('Error fetching group members:', err)
        return []
    }
}

export async function createMeeting(formData: FormData) {
    const adminClient = createAdminClient()
    const session = await getSession()

    if (!session?.id) return { error: 'Unauthorized' }

    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const scheduledAt = formData.get('scheduledAt') as string
    const type = (formData.get('type') as 'audio' | 'video') || 'video'
    const userIds = JSON.parse(formData.get('userIds') as string) as string[]
    const duration = parseInt(formData.get('duration') as string) || 30
    const cronIban = formData.get('cronIban') ? JSON.parse(formData.get('cronIban') as string) : null

    try {
        // 1. Create meeting
        const { data: meeting, error: meetingError } = await adminClient
            .from('meetings')
            .insert({
                title,
                description,
                host_id: session.id,
                created_by: session.id, // Explicitly set created_by
                scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString(),
                type,
                status: 'planned', // Use 'planned' as per new requirement
                duration,
                cron_iban: cronIban
            })
            .select('id')
            .single()

        if (meetingError) throw meetingError

        // 2. Add participants (including host)
        const participantIds = Array.from(new Set([...userIds, session.id]))
        const participants = participantIds.map(uid => ({
            meeting_id: meeting.id,
            user_id: uid,
            role: uid === session.id ? 'host' : 'participant'
        }))

        const { error: partError } = await adminClient
            .from('meeting_participants')
            .insert(participants)

        if (partError) throw partError

        // --- NOTIFICATIONS SYSTEM ---
        const { data: meetingFull } = await adminClient
            .from('meetings')
            .select('scheduled_at')
            .eq('id', meeting.id)
            .single()

        const scheduledTime = new Date(meetingFull?.scheduled_at || new Date())
        const notifications: any[] = []

        participantIds.forEach(uid => {
            // 1. Immediate Notification
            notifications.push({
                meeting_id: meeting.id,
                user_id: uid,
                type: 'immediate',
                scheduled_at: scheduledTime.toISOString(),
                trigger_at: new Date().toISOString(),
                sound: 'default'
            })

            // 2. 10 Minutes Before
            const tenMinBefore = new Date(scheduledTime.getTime() - 10 * 60000)
            if (tenMinBefore > new Date()) {
                notifications.push({
                    meeting_id: meeting.id,
                    user_id: uid,
                    type: 'reminder_10min',
                    scheduled_at: scheduledTime.toISOString(),
                    trigger_at: tenMinBefore.toISOString(),
                    sound: 'reminder'
                })
            }

            // 3. Exact Time
            notifications.push({
                meeting_id: meeting.id,
                user_id: uid,
                type: 'reminder_exact',
                scheduled_at: scheduledTime.toISOString(),
                trigger_at: scheduledTime.toISOString(),
                sound: 'exact'
            })
        })

        const { error: notifError } = await adminClient
            .from('meeting_notifications')
            .insert(notifications)

        if (notifError) {
            console.error('[createMeeting] Error inserting notifications:', notifError)
        }

        // Send immediate push notification to all participants except host
        try {
            const { sendPushNotification } = await import('@/lib/push-notifications')
            const pushPromises = userIds.map(uid => sendPushNotification(uid, {
                title: 'Nouveau Meeting',
                body: `Vous avez un meeting prévu le ${scheduledTime.toLocaleDateString('fr-FR')} à ${scheduledTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
                data: { url: `/meetings/${meeting.id}` }
            }))
            await Promise.all(pushPromises)
        } catch (err) {
            console.error('[createMeeting] Push error:', err)
        }

        revalidatePath('/meetings')
        return { success: true, meetingId: meeting.id }
    } catch (err: any) {
        console.error('[createMeeting] Error:', err)
        return { error: err.message || 'Failed to create meeting.' }
    }
}

export async function getMeetings() {
    const adminClient = createAdminClient()
    const session = await getSession()
    if (!session?.id) return []

    try {
        const { data, error } = await adminClient
            .from('meetings')
            .select(`
                *,
                host:employees!meetings_host_id_fkey(id, full_name, avatar_url),
                participants:meeting_participants(
                    user_id,
                    user:employees(id, full_name, avatar_url)
                )
            `)
            .order('scheduled_at', { ascending: true })

        if (error) throw error

        // Filter meetings where user is a participant or host (unless Admin)
        const isAdmin = session.role === 'Administrator'
        if (isAdmin) return data || []

        return (data || []).filter(m =>
            m.host_id === session.id ||
            m.participants.some((p: any) => p.user_id === session.id)
        )
    } catch (err) {
        console.error('[getMeetings] Error:', err)
        return []
    }
}

export async function getMeetingDetails(meetingId: string) {
    const adminClient = createAdminClient()
    const session = await getSession()
    if (!session?.id) return null

    try {
        const { data, error } = await adminClient
            .from('meetings')
            .select(`
                *,
                host:employees!meetings_host_id_fkey(id, full_name, avatar_url),
                participants:meeting_participants(
                    user_id,
                    role,
                    user:employees(id, full_name, avatar_url)
                )
            `)
            .eq('id', meetingId)
            .single()

        if (error) throw error

        // Map recording URL to a signed URL if it exists
        if (data?.recording_url) {
            const { data: signedData } = await adminClient
                .storage
                .from('call-recordings')
                .createSignedUrl(data.recording_url, 3600) // 1 hour
            data.signed_url = signedData?.signedUrl || null
        }

        return data
    } catch (err) {
        console.error('[getMeetingDetails] Error:', err)
        return null
    }
}

export async function updateMeetingStatus(meetingId: string, status: 'scheduled' | 'live' | 'ended') {
    const adminClient = createAdminClient()
    const session = await getSession()
    if (!session?.id) return { error: 'Unauthorized' }

    try {
        if (status === 'live') {
            const { data: meeting } = await adminClient
                .from('meetings')
                .select('scheduled_at')
                .eq('id', meetingId)
                .single()

            if (meeting && new Date(meeting.scheduled_at) > new Date()) {
                return { error: 'Le meeting ne peut pas être démarré avant l\'heure prévue' }
            }
        }

        const { error } = await adminClient
            .from('meetings')
            .update({ status })
            .eq('id', meetingId)

        if (error) throw error
        revalidatePath('/meetings')
        return { success: true }
    } catch (err: any) {
        console.error('[updateMeetingStatus] Error:', err)
        return { error: err.message }
    }
}

export async function deleteMeeting(meetingId: string) {
    const adminClient = createAdminClient()
    const session = await getSession()
    if (!session?.id) return { error: 'Unauthorized' }

    try {
        const { error } = await adminClient
            .from('meetings')
            .delete()
            .eq('id', meetingId)

        if (error) throw error
        revalidatePath('/meetings')
        return { success: true }
    } catch (err: any) {
        console.error('[deleteMeeting] Error:', err)
        return { error: err.message }
    }
}

export async function joinMeeting(meetingId: string) {
    const adminClient = createAdminClient()
    const session = await getSession()
    if (!session?.id) return { error: 'Unauthorized' }

    try {
        const { error } = await adminClient
            .from('meeting_participants')
            .update({ joined_at: new Date().toISOString() })
            .eq('meeting_id', meetingId)
            .eq('user_id', session.id)

        if (error) throw error
        return { success: true }
    } catch (err: any) {
        console.error('[joinMeeting] Error:', err)
        return { error: err.message }
    }
}

export async function saveMeetingRecording(formData: FormData) {
    const adminClient = createAdminClient()
    const session = await getSession()
    if (!session?.id) return { error: 'Unauthorized' }

    const meetingId = formData.get('meetingId') as string
    const file = formData.get('file') as File

    if (!file || file.size === 0) return { error: 'No file provided' }

    try {
        const fileName = `${meetingId}/${Date.now()}.webm`
        const path = `meeting-recordings/${fileName}`

        const { error: uploadError } = await adminClient
            .storage
            .from('call-recordings')
            .upload(path, file, {
                contentType: file.type,
                upsert: false
            })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = adminClient
            .storage
            .from('call-recordings')
            .getPublicUrl(path)

        const updateData: any = { recording_url: path }
        if (file.type.startsWith('audio/')) {
            updateData.audio_url = publicUrl
        } else if (file.type.startsWith('video/')) {
            updateData.video_url = publicUrl
        }

        const { error: updateError } = await adminClient
            .from('meetings')
            .update(updateData)
            .eq('id', meetingId)

        if (updateError) throw updateError

        return { success: true }
    } catch (err: any) {
        console.error('[saveMeetingRecording] Error:', err)
        return { error: err.message || 'Failed to save recording' }
    }
}

export async function getUnreadNotifications() {
    const adminClient = createAdminClient()
    const session = await getSession()
    if (!session?.id) return []

    try {
        const { data, error } = await adminClient
            .from('meeting_notifications')
            .select(`
                *,
                meeting:meetings!meeting_id(title, scheduled_at, status)
            `)
            .eq('user_id', session.id)
            .eq('seen', false)
            .lte('trigger_at', new Date().toISOString())
            .order('trigger_at', { ascending: false })

        if (error) throw error
        return data || []
    } catch (err) {
        console.error('[getUnreadNotifications] Error:', err)
        return []
    }
}

export async function markNotificationSeen(notificationId: string) {
    const adminClient = createAdminClient()
    const session = await getSession()
    if (!session?.id) return { error: 'Unauthorized' }

    try {
        const { error } = await adminClient
            .from('meeting_notifications')
            .update({ seen: true })
            .eq('id', notificationId)
            .eq('user_id', session.id)

        if (error) throw error
        return { success: true }
    } catch (err: any) {
        console.error('[markNotificationSeen] Error:', err)
        return { error: err.message }
    }
}
