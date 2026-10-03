import { useEffect, useState } from 'react'
import type { FavoriteTeam } from '../hooks/useFavorites'
import { currentSubscription, disableNotifications, enableNotifications, pushSupported, syncSubscription } from '../push'

interface Props {
  favorites: FavoriteTeam[]
}

/** Bell button that turns score alerts (start, scores, final) on or off for My Teams */
export function NotificationsToggle({ favorites }: Props) {
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!pushSupported()) return
    currentSubscription().then(setSubscription).catch(() => {})
  }, [])

  // Keep the server's team list in sync when favorites change
  useEffect(() => {
    if (subscription) syncSubscription(subscription, favorites).catch(() => {})
  }, [subscription, favorites])

  if (!pushSupported()) return null

  const toggle = async () => {
    setBusy(true)
    setMessage(null)
    try {
      if (subscription) {
        await disableNotifications(subscription)
        setSubscription(null)
        setMessage('Score alerts off')
      } else {
        const created = await enableNotifications(favorites)
        setSubscription(created)
        setMessage(created
          ? 'Score alerts on: kickoff, every score, and the final'
          : 'Notifications are blocked. Turn them on in Settings › Notifications › Scores.')
      }
    } catch {
      setMessage("Couldn't change score alerts. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        className={`edit-btn alerts-btn ${subscription ? 'on' : ''}`}
        onClick={toggle}
        disabled={busy}
        aria-pressed={Boolean(subscription)}
        title={subscription ? 'Turn off score alerts' : 'Get score alerts for your teams'}
      >
        {subscription ? '🔔 On' : '🔕 Alerts'}
      </button>
      {message && (
        <div className="alerts-message" role="status" onClick={() => setMessage(null)}>{message}</div>
      )}
    </>
  )
}
