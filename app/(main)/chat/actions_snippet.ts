
/**
 * Deletes a message securely using RLS.
 * 
 * Logic:
 * - We use the standard `createClient()` (RLS-enabled) instead of `adminClient`.
 * - This ensures the RLS policy we created is actually enforced by the database.
 * - The policy checks: uid == sender_id AND role != Administrator.
 */
export async function deleteMessage(messageId: string) {
    const supabase = createClient()
    const session = await getSession()

    if (!session?.id) {
        return { error: 'Unauthorized' }
    }

    try {
        const { error } = await supabase
            .from('messages')
            .delete()
            .eq('id', messageId)

        if (error) {
            console.error('Error deleting message:', error)
            return { error: 'Failed to delete message. You may not have permission.' }
        }

        revalidatePath('/chat')
        return { success: true }
    } catch (err) {
        console.error('Unexpected error deleting message:', err)
        return { error: 'Unexpected error' }
    }
}
