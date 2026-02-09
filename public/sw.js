/* eslint-disable no-undef */
self.addEventListener('push', (event) => {
    if (!event.data) return

    try {
        const payload = event.data.json()
        const { title, body, icon, data } = payload

        const options = {
            body: body || 'You have a new message',
            icon: icon || '/favicon.ico',
            data: data || {},
            vibrate: [200, 100, 200, 100, 200], // Stronger vibration
            badge: '/favicon.ico',
            tag: data?.type === 'call' ? 'incoming-call' : 'new-message',
            renotify: true, // Notify even if a previous notification is still open
            silent: false,
            requireInteraction: data?.type === 'call', // Stay until user interacts for calls
            actions: data?.type === 'call' ? [
                { action: 'accept', title: 'Répondre', icon: '/icons/check.png' },
                { action: 'reject', title: 'Refuser', icon: '/icons/x.png' }
            ] : []
        }

        event.waitUntil(
            self.registration.showNotification(title || 'New Message', options)
        )
    } catch (err) {
        console.error('[SW] Error parsing push data:', err)
    }
})

self.addEventListener('notificationclick', (event) => {
    event.notification.close()

    const data = event.notification.data
    const url = data?.url || '/messages'

    // Open the app or focus the existing tab
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList.length > 0) {
                let client = clientList[0]
                for (let i = 0; i < clientList.length; i++) {
                    if (new URL(clientList[i].url).pathname === url) {
                        client = clientList[i]
                        break
                    }
                }
                return client.focus()
            }
            if (clients.openWindow) {
                return clients.openWindow(url)
            }
        })
    )
})
