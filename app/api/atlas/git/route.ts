/**
 * GET /api/atlas/git · Sprint 2 dashboard scaffold.
 *
 * Returns git state via child_process exec at request time (NOT
 * build-time · Vercel build env doesn't always include .git in serverless
 * bundles · runtime exec falls back to env vars when not in a git
 * checkout). Captures HEAD + last 10 commits + branch.
 *
 * Env override · `GIT_HEAD_HASH` + `GIT_HEAD_MESSAGE` + `GIT_LOG_RECENT`
 * (JSON-encoded array) populated by build pipeline para deploy en Vercel
 * donde .git no está disponible.
 */
import { NextResponse } from "next/server"
import { execSync } from "child_process"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 60

interface CommitRow {
  hash: string
  message: string
  date: string
  author: string | null
}

function safeExec(cmd: string): string | null {
  try {
    return execSync(cmd, { encoding: "utf8", timeout: 3000 }).trim()
  } catch {
    return null
  }
}

export async function GET() {
  const envHead = process.env.GIT_HEAD_HASH
  const envMsg = process.env.GIT_HEAD_MESSAGE
  const envLog = process.env.GIT_LOG_RECENT

  if (envHead && envMsg) {
    let last10: CommitRow[] = []
    if (envLog) {
      try {
        last10 = JSON.parse(envLog) as CommitRow[]
      } catch {
        // ignore parse error
      }
    }
    return NextResponse.json({
      ok: true,
      source: "env",
      head_commit: envHead,
      head_message: envMsg,
      head_date: process.env.GIT_HEAD_DATE ?? null,
      branch: process.env.GIT_BRANCH ?? null,
      last_10_commits: last10,
      generated_at: new Date().toISOString(),
    })
  }

  const headHash = safeExec("git rev-parse HEAD")
  if (!headHash) {
    return NextResponse.json({
      ok: false,
      source: "none",
      warning:
        "Git not available · provide GIT_HEAD_HASH + GIT_HEAD_MESSAGE env vars en Vercel",
      head_commit: null,
      head_message: null,
      head_date: null,
      branch: null,
      last_10_commits: [],
      generated_at: new Date().toISOString(),
    })
  }

  const headMsg = safeExec("git log -1 --format=%s") ?? ""
  const headDate = safeExec("git log -1 --format=%cI") ?? null
  const branch = safeExec("git rev-parse --abbrev-ref HEAD") ?? null

  const logOut = safeExec("git log -10 --format=%H|%s|%cI|%an") ?? ""
  const last_10_commits: CommitRow[] = logOut
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, message, date, author] = line.split("|")
      return { hash, message, date, author: author ?? null }
    })

  return NextResponse.json({
    ok: true,
    source: "exec",
    head_commit: headHash,
    head_message: headMsg,
    head_date: headDate,
    branch,
    last_10_commits,
    generated_at: new Date().toISOString(),
  })
}
