import webPush from 'web-push';
import { createAdminClient } from './supabase/admin';

// Configure VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
    webPush.setVapidDetails(
        'mailto:admin@empmanager.com',
        vapidPublicKey,
        vapidPrivateKey
    );
}

interface PushPayload {
    title: string;
    body: string;
    icon?: string;
    data?: any;
}

export async function sendPushNotification(userId: string, payload: PushPayload) {
    if (!vapidPublicKey || !vapidPrivateKey) {
        console.error('[Push] VAPID keys not configured');
        return;
    }

    const supabase = createAdminClient();

    // 1. Fetch all subscriptions for this user
    const { data: subscriptions, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId);

    if (error) {
        console.error('[Push] Error fetching subscriptions:', error);
        return;
    }

    if (!subscriptions || subscriptions.length === 0) {
        return;
    }

    console.log(`[Push] Sending notification to ${subscriptions.length} devices for user ${userId}`);

    // 2. Send notifications in parallel
    const pushPromises = subscriptions.map(async (sub) => {
        try {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            };

            await webPush.sendNotification(
                pushSubscription,
                JSON.stringify(payload)
            );
        } catch (err: any) {
            // 3. Clean up invalid subscriptions (404 Not Found or 410 Gone)
            if (err.statusCode === 404 || err.statusCode === 410) {
                console.log(`[Push] Removing expired subscription for user ${userId}`);
                await supabase
                    .from('push_subscriptions')
                    .delete()
                    .eq('id', sub.id);
            } else {
                console.error('[Push] Error sending notification:', err);
            }
        }
    });

    await Promise.all(pushPromises);
}
