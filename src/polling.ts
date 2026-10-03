// Runs fn now and every `ms` while the app is visible, and immediately when it
// comes back to the foreground (e.g. reopening the PWA on iPhone) so scores
// are never stale on resume. Returns a cleanup function.
export function startPolling(fn: () => void, ms: number) {
  fn()
  const interval = setInterval(() => {
    if (!document.hidden) fn()
  }, ms)
  const onVisibilityChange = () => {
    if (!document.hidden) fn()
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
  return () => {
    clearInterval(interval)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}
