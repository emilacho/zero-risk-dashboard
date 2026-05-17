"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Sparkle,
  TreeStructure,
  Users,
  Cpu,
} from "@phosphor-icons/react"
import { NotificationInbox } from "@/components/NotificationInbox"

const NAV_ITEMS = [
  { href: "/agents", label: "Agents", icon: Cpu },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/graph", label: "Graph", icon: TreeStructure },
]

export function Header() {
  const pathname = usePathname()
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-[0_0_24px_-4px_hsl(var(--primary)/0.7)] transition-shadow group-hover:shadow-[0_0_28px_-2px_hsl(var(--primary)/0.9)]">
            <Sparkle className="h-3.5 w-3.5" />
            <span
              aria-hidden
              className="absolute inset-0 rounded-lg ring-1 ring-inset ring-white/15"
            />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground group-hover:text-foreground transition-colors">
            Zero Risk
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground/50">
            ·
          </span>
          <span className="font-display text-sm font-semibold tracking-tight">
            Dashboard
          </span>
          <span className="ml-2 inline-flex h-1.5 w-1.5 rounded-full bg-accent animate-pulse-glow" />
        </Link>
        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href ||
                (href !== "/" && pathname?.startsWith(href + "/"))
              return (
                <Link
                  key={href}
                  href={href}
                  data-active={active ? "true" : undefined}
                  className="nav-pill flex items-center gap-1.5 rounded-full border border-transparent px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              )
            })}
          </nav>
          <NotificationInbox />
        </div>
      </div>
    </header>
  )
}
