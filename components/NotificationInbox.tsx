"use client"
/**
 * NotificationInbox · Sprint #8 D2 P0 component.
 *
 * Header-mounted bell with unread counter badge + click-to-expand floating
 * panel listing latest items from /api/notifications/feed (cowork_messages
 * live · HITL/Slack/Sentry stubbed for Sprint #10 wire-up).
 *
 * Visual · Lumen v3 surface-card rim-instr · violet/cyan/danger severity hues.
 * Accessibility · role="button" on bell · aria-expanded · aria-controls ·
 * aria-live="polite" on unread count · Esc/click-outside closes panel.
 */
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { Bell, BellRing } from "lucide-react"

type NotificationKind = "cowork" | "hitl" | "slack" | "sentry"
type NotificationSeverity = "info" | "warn" | "danger"

interface NotificationItem {
  id: string
  kind: NotificationKind
  severity: NotificationSeverity
  title: string
  subtitle: string | null
  href: string | null
  created_at: string
  unread: boolean
}

interface FeedResponse {
  ok: boolean
  items: NotificationItem[]
  unread_count: number
  sources: Record<string, "ok" | "stub" | "error">
}

const KIND_DOT: Record<NotificationKind, string> = {
  cowork: "hsl(var(--hue-violet))",
  hitl: "hsl(var(--hue-amber))",
  slack: "hsl(var(--hue-cyan))",
  sentry: "hsl(var(--danger))",
}

const KIND_LABEL: Record<NotificationKind, string> = {
  cowork: "cowork",
  hitl: "hitl",
  slack: "slack",
  sentry: "sentry",
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function NotificationInbox() {
  const [feed, setFeed] = useState<FeedResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const fetchFeed = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/notifications/feed?limit=15", {
        cache: "no-store",
      })
      if (res.ok) {
        const json = (await res.json()) as FeedResponse
        setFeed(json)
      }
    } catch {
      // silent · keep previous feed
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFeed()
    const interval = setInterval(fetchFeed, 60_000)
    return () => clearInterval(interval)
  }, [fetchFeed])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleKey)
    }
  }, [open])

  const unread = feed?.unread_count ?? 0
  const items = feed?.items ?? []
  const HasUnread = unread > 0

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="notification-panel"
        aria-label={
          unread > 0
            ? `Notifications · ${unread} unread`
            : "Notifications · none unread"
        }
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background)/0.6)] text-[hsl(var(--muted-foreground))] transition hover:border-[hsl(var(--primary-glow)/0.4)] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
      >
        {HasUnread ? (
          <BellRing className="h-4 w-4" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
        <span
          aria-live="polite"
          className={
            HasUnread
              ? "absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[hsl(var(--danger))] px-1 text-[9px] font-mono text-white"
              : "sr-only"
          }
        >
          {unread > 9 ? "9+" : unread}
        </span>
      </button>

      {open && (
        <div
          id="notification-panel"
          role="region"
          aria-label="Notification feed"
          className="surface-card rim-instr absolute right-0 top-11 z-50 flex w-[360px] flex-col overflow-hidden p-0 shadow-[0_24px_60px_-12px_hsl(var(--background)/0.8)]"
          data-rim="violet"
        >
          <header className="relative z-[2] flex items-center justify-between gap-3 border-b-[0.5px] border-[hsl(var(--primary-glow)/0.18)] px-4 py-3">
            <span className="eyebrow-chip">
              <span className="h-1 w-1 rounded-full bg-current animate-pulse-dot" />
              inbox · {items.length} item{items.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={fetchFeed}
              disabled={loading}
              className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))] hover:text-foreground disabled:opacity-40"
            >
              {loading ? "..." : "refresh"}
            </button>
          </header>

          <div className="relative z-[2] max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                No notifications.
              </p>
            ) : (
              <ul className="divide-y divide-[hsl(var(--border)/0.4)]">
                {items.map((item) => {
                  const content = (
                    <div className="flex items-start gap-3 px-4 py-3">
                      <span
                        aria-hidden
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: KIND_DOT[item.kind] }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[12px] font-medium">
                            {item.title}
                          </span>
                          <span className="num shrink-0 text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                            {KIND_LABEL[item.kind]}
                          </span>
                        </div>
                        {item.subtitle && (
                          <p className="mt-1 truncate text-[11px] text-[hsl(var(--muted-foreground))]">
                            {item.subtitle}
                          </p>
                        )}
                        <span className="num mt-1 inline-block text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                          {formatRelative(item.created_at)}
                        </span>
                      </div>
                    </div>
                  )
                  return (
                    <li key={item.id}>
                      {item.href ? (
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className="block transition hover:bg-[hsl(var(--primary-glow)/0.04)]"
                        >
                          {content}
                        </Link>
                      ) : (
                        <div>{content}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {feed?.sources && (
            <footer className="relative z-[2] border-t-[0.5px] border-[hsl(var(--border)/0.4)] px-4 py-2">
              <span className="num text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                sources ·{" "}
                {Object.entries(feed.sources)
                  .map(([k, v]) => `${k}:${v}`)
                  .join(" · ")}
              </span>
            </footer>
          )}
        </div>
      )}
    </div>
  )
}
