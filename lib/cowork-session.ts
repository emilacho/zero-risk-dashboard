/**
 * Cowork session helpers · STEP 11.
 *
 * Each surface (channel) that hosts a CoworkPromptBar gets its own
 * persistent session id stored in localStorage · this is what binds
 * scrollback continuity to the surface (home · mkt modal · client
 * vault · workflow drill · etc) without forcing the user to manually
 * pick a thread.
 *
 * The session id is also propagated to `cowork_messages.metadata.
 * session_id` so server-side queries can re-hydrate any chat by id.
 */

const STORAGE_PREFIX = "zr.cowork.session."

/** Browser-safe · returns the persistent session id for a channel ·
 * creates and stores one if none exists. */
export function getOrCreateSessionId(channel: string): string {
  if (typeof window === "undefined") return ""
  const key = STORAGE_PREFIX + channel
  let id = window.localStorage.getItem(key)
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36)
    window.localStorage.setItem(key, id)
  }
  return id
}

/** Force-rotates the session for a channel · use when the user wants
 * a fresh thread (e.g. "+ New" tab). */
export function rotateSessionId(channel: string): string {
  if (typeof window === "undefined") return ""
  const key = STORAGE_PREFIX + channel
  const next =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
  window.localStorage.setItem(key, next)
  return next
}

export function listChannelSessions(): Array<{ channel: string; id: string }> {
  if (typeof window === "undefined") return []
  const out: Array<{ channel: string; id: string }> = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i)
    if (!k || !k.startsWith(STORAGE_PREFIX)) continue
    out.push({
      channel: k.slice(STORAGE_PREFIX.length),
      id: window.localStorage.getItem(k) ?? "",
    })
  }
  return out
}
