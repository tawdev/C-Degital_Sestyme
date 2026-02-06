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
            vibrate: [200, 100, 200], // Stronger vibration
            badge: '/favicon.ico',
            tag: 'new-message',
            renotify: true, // Notify even if a previous notification is still open
            silent: false
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

    // Open the app or focus the existing tab
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList.length > 0) {
                let client = clientList[0]
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) {
                        client = clientList[i]
                        break
                    }
                }
                return client.focus()
            }
            if (clients.openWindow) {
                return clients.openWindow('/chat')
            }
        })
    )
})
