// Score notifications via Web Push. On iPhone this needs iOS 16.4+ and the
// app added to the Home Screen; in Safari itself PushManager doesn't exist.
import type { FavoriteTeam } from './hooks/useFavorites'

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binary, c => c.charCodeAt(0))
}

export async function currentSubscription() {
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

/** Tells the server which teams this device wants alerts for */
export async function syncSubscription(subscription: PushSubscription, favorites: FavoriteTeam[]) {
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      teams: favorites.map(f => ({ id: f.id, sport: f.sport })),
    }),
  })
  if (!res.ok) throw new Error(`Subscribe failed (HTTP ${res.status})`)
}

/** Must be called from a tap: iOS only shows the permission prompt for user gestures */
export async function enableNotifications(favorites: FavoriteTeam[]) {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  const res = await fetch('/api/push/public-key')
  if (!res.ok) throw new Error(`Couldn't get push key (HTTP ${res.status})`)
  const { publicKey } = (await res.json()) as { publicKey: string }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToBytes(publicKey),
  })
  await syncSubscription(subscription, favorites)
  return subscription
}

export async function disableNotifications(subscription: PushSubscription) {
  await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => {})
  await subscription.unsubscribe()
}
