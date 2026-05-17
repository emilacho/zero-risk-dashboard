/**
 * Cowork session helpers · STEP 11 → STEP 12 (multi-session).
 *
 * Each surface (channel) gets its own scrollback bound to a session id
 * stored in localStorage. STEP 12 extends the original single-id model
 * to support MULTIPLE sessions per channel · the CoworkPromptBar
 * renders them as tabs so the user can keep parallel threads (e.g. "/
 * agents discovery" vs "/agents cost cleanup" both inside the home
 * surface).
 *
 * Storage shape ·
 *   zr.cowork.session.<channel>   · active session id (legacy key,
 *                                    kept for backwards compat with
 *                                    M1-M3 entries that only stored
 *                                    this)
 *   zr.cowork.sessions.<channel>  · JSON array of { id, label, ts }
 *                                    listing all sessions for the
 *                                    channel (most recent first)
 *
 * The legacy single-id rows from M1-M3 get auto-migrated into the
 * new array on first read.
 */

const ACTIVE_PREFIX = "zr.cowork.session."
const LIST_PREFIX = "zr.cowork.sessions."

export interface ChannelSession {
  id: string
  /** Human-friendly label (auto-generated as "Sesión N" or first
   * user-message excerpt). Editable later. */
  label: string
  /** ISO timestamp of last activity in this session · used for sort
   * + relative time display. */
  ts: string
}

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function readArray(channel: string): ChannelSession[] {
  if (typeof window === "undefined") return []
  const raw = window.localStorage.getItem(LIST_PREFIX + channel)
  if (!raw) return []
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return (arr as ChannelSession[]).filter(
      (s) =>
        s &&
        typeof s.id === "string" &&
        typeof s.label === "string" &&
        typeof s.ts === "string",
    )
  } catch {
    return []
  }
}

function writeArray(channel: string, list: ChannelSession[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(LIST_PREFIX + channel, JSON.stringify(list))
}

function migrateLegacy(channel: string): ChannelSession[] {
  if (typeof window === "undefined") return []
  const list = readArray(channel)
  const legacy = window.localStorage.getItem(ACTIVE_PREFIX + channel)
  if (legacy && !list.some((s) => s.id === legacy)) {
    list.unshift({ id: legacy, label: "Sesión 1", ts: new Date().toISOString() })
    writeArray(channel, list)
  }
  return list
}

/** Returns the currently-active session id for a channel · creates
 * the channel's first session if none exist (M1-M4 entry point). */
export function getOrCreateSessionId(channel: string): string {
  if (typeof window === "undefined") return ""
  migrateLegacy(channel)
  const list = readArray(channel)
  const activeKey = ACTIVE_PREFIX + channel
  let active = window.localStorage.getItem(activeKey)
  if (active && list.some((s) => s.id === active)) return active
  if (list.length > 0) {
    active = list[0].id
    window.localStorage.setItem(activeKey, active)
    return active
  }
  // Bootstrap · no sessions yet
  const id = genId()
  const fresh: ChannelSession = { id, label: "Sesión 1", ts: new Date().toISOString() }
  writeArray(channel, [fresh])
  window.localStorage.setItem(activeKey, id)
  return id
}

/** Lists all sessions for a channel (most-recently-active first).
 * Used by the tabs UI. */
export function listSessionsForChannel(channel: string): ChannelSession[] {
  if (typeof window === "undefined") return []
  migrateLegacy(channel)
  return readArray(channel)
}

/** Switches active session within a channel · returns the new active
 * id (or empty if not found). */
export function setActiveSession(channel: string, id: string): string {
  if (typeof window === "undefined") return ""
  const list = readArray(channel)
  if (!list.some((s) => s.id === id)) return ""
  window.localStorage.setItem(ACTIVE_PREFIX + channel, id)
  // Bump ts of the active session so the tabs naturally reorder.
  const bumped = list.map((s) =>
    s.id === id ? { ...s, ts: new Date().toISOString() } : s,
  )
  writeArray(channel, bumped)
  return id
}

/** Creates a new session for a channel · sets it active · returns id. */
export function rotateSessionId(channel: string): string {
  if (typeof window === "undefined") return ""
  const list = readArray(channel)
  const id = genId()
  const label = `Sesión ${list.length + 1}`
  const fresh: ChannelSession = { id, label, ts: new Date().toISOString() }
  writeArray(channel, [fresh, ...list])
  window.localStorage.setItem(ACTIVE_PREFIX + channel, id)
  return id
}

/** Removes a session from a channel · falls active back to the most
 * recent remaining session (or bootstraps a fresh one if empty).
 * Returns the new active id. */
export function deleteSession(channel: string, id: string): string {
  if (typeof window === "undefined") return ""
  const list = readArray(channel).filter((s) => s.id !== id)
  writeArray(channel, list)
  if (list.length === 0) {
    // Bootstrap a new one so the UI never lands in a no-session state.
    return rotateSessionId(channel)
  }
  // If we deleted the active one, switch to the most recent remaining.
  const current = window.localStorage.getItem(ACTIVE_PREFIX + channel)
  if (current === id) {
    const next = list[0].id
    window.localStorage.setItem(ACTIVE_PREFIX + channel, next)
    return next
  }
  return current ?? list[0].id
}

/** Renames a session label · used by an inline edit affordance. */
export function renameSession(
  channel: string,
  id: string,
  newLabel: string,
): void {
  if (typeof window === "undefined") return
  const list = readArray(channel)
  const updated = list.map((s) =>
    s.id === id ? { ...s, label: newLabel.slice(0, 60) || s.label } : s,
  )
  writeArray(channel, updated)
}

/** Bumps a session's ts (e.g. after a new turn lands) so it floats
 * to the top of the tabs list. */
export function touchSession(channel: string, id: string): void {
  if (typeof window === "undefined") return
  const list = readArray(channel)
  const updated = list
    .map((s) => (s.id === id ? { ...s, ts: new Date().toISOString() } : s))
    .sort((a, b) => (a.ts < b.ts ? 1 : -1))
  writeArray(channel, updated)
}

/** Listing across ALL channels · used by a future Cowork "all
 * conversations" search surface (out of STEP 12 scope, retained
 * for API compat). */
export function listChannelSessions(): Array<{ channel: string; id: string }> {
  if (typeof window === "undefined") return []
  const out: Array<{ channel: string; id: string }> = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i)
    if (!k || !k.startsWith(ACTIVE_PREFIX)) continue
    out.push({
      channel: k.slice(ACTIVE_PREFIX.length),
      id: window.localStorage.getItem(k) ?? "",
    })
  }
  return out
}
