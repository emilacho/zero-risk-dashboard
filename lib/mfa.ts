/**
 * MFA helpers · STEP 9 · Supabase Auth TOTP + custom backup codes.
 *
 * Supabase Auth ships TOTP enrollment + verification natively (browser
 * client · `supabase.auth.mfa.*`). It does NOT ship backup codes ·
 * we implement those ourselves and store hashed values in the user's
 * `user_metadata.mfa_backup_codes` array (writable by the user, opaque
 * to anyone reading the row). Each code is one-time use · removed
 * from the array on first successful verification.
 *
 * Backup code format · 5 groups of 4 chars (uppercase alphanumeric ·
 * Crockford-style without ambiguous chars I/O/L/0/1). Length 20 · 24
 * with dashes for display. 10 codes generated at enrollment time ·
 * shown once. User must save them offline before closing the modal.
 */

const BACKUP_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789" // no 0/1/I/O/L
const BACKUP_GROUPS = 5
const BACKUP_GROUP_SIZE = 4
export const BACKUP_CODE_COUNT = 10

function randomChar(): string {
  const buf = new Uint8Array(1)
  crypto.getRandomValues(buf)
  return BACKUP_CHARSET[buf[0] % BACKUP_CHARSET.length]
}

/** Generate one backup code · format AAAA-BBBB-CCCC-DDDD-EEEE */
export function generateBackupCode(): string {
  const groups: string[] = []
  for (let g = 0; g < BACKUP_GROUPS; g++) {
    let s = ""
    for (let i = 0; i < BACKUP_GROUP_SIZE; i++) s += randomChar()
    groups.push(s)
  }
  return groups.join("-")
}

export function generateBackupCodes(count: number = BACKUP_CODE_COUNT): string[] {
  const codes: string[] = []
  const seen = new Set<string>()
  while (codes.length < count) {
    const c = generateBackupCode()
    if (seen.has(c)) continue
    seen.add(c)
    codes.push(c)
  }
  return codes
}

export function normalizeBackupCode(raw: string): string {
  return raw.replace(/[^A-Z0-9]/gi, "").toUpperCase()
}

/** SHA-256 → lowercase hex · uses Web Crypto · runs in browsers + edge. */
export async function hashBackupCode(raw: string): Promise<string> {
  const normalized = normalizeBackupCode(raw)
  const buf = new TextEncoder().encode(normalized)
  const digest = await crypto.subtle.digest("SHA-256", buf)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function hashAllBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map(hashBackupCode))
}

/**
 * Heuristic · TOTP codes are 6 digits, backup codes contain letters.
 * Used by the login flow to decide which verification path to take.
 */
export function looksLikeBackupCode(input: string): boolean {
  const trimmed = input.trim()
  return /[A-Z]/i.test(trimmed) || trimmed.length > 7
}
