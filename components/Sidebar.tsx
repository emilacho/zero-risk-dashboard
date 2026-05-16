"use client"
/**
 * Sidebar · Lumen v3 collapsible nav rail.
 *
 *   - 64px wide collapsed (always visible · icon-only)
 *   - 240px wide expanded on hover · labels slide in
 *   - glass-morphism backdrop · 0.5px violet hairline border
 *   - Lucide outline icons · stroke 1.5 · 20px
 *   - active route gets a violet dot + violet glow rail accent
 *
 * Replaces the previous top horizontal Header. The page content is
 * offset by `pl-[64px]` in `app/layout.tsx` so collapsed state is the
 * resting layout; expansion overlays without reflowing.
 */
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import {
  Sparkles,
  LayoutDashboard,
  Cpu,
  Users,
  Network,
  type LucideIcon,
} from "lucide-react"

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

const NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Cpu },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/graph", label: "Graph", icon: Network },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <motion.aside
      initial={false}
      whileHover={{ width: 240 }}
      animate={{ width: 64 }}
      transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
      className="group/sidebar fixed left-0 top-0 z-40 flex h-screen flex-col overflow-hidden border-r-[0.5px] border-[hsl(var(--primary-glow)/0.18)] bg-[hsl(var(--background)/0.6)] backdrop-blur-xl"
    >
      {/* Brand mark · 64px square */}
      <Link
        href="/"
        className="flex h-16 items-center gap-3 px-[18px] transition-colors hover:bg-[hsl(var(--primary-glow)/0.06)]"
      >
        <span className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-foreground shadow-[0_0_18px_-2px_hsl(var(--primary-glow)/0.6)]">
          <Sparkles className="h-4 w-4" strokeWidth={1.5} />
        </span>
        <span className="overflow-hidden whitespace-nowrap font-marker text-[15px] leading-none tracking-tight opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">
          Zero Risk
        </span>
      </Link>

      {/* Hairline divider */}
      <div className="mx-3 h-px bg-[hsl(var(--primary-glow)/0.12)]" />

      {/* Nav stack */}
      <nav className="mt-3 flex flex-1 flex-col gap-1 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname?.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              data-active={active ? "true" : undefined}
              className="group/item relative flex h-10 items-center gap-3 rounded-lg px-[10px] text-sm transition-colors hover:bg-[hsl(var(--primary-glow)/0.08)] data-[active=true]:bg-[hsl(var(--primary-glow)/0.12)]"
            >
              {/* Active rail · violet accent */}
              <span
                aria-hidden
                className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full bg-[hsl(var(--primary-glow))] opacity-0 shadow-[0_0_8px_hsl(var(--primary-glow)/0.7)] transition-opacity group-data-[active=true]/item:opacity-100"
              />
              <Icon
                strokeWidth={1.5}
                className="h-5 w-5 shrink-0 text-[hsl(var(--muted-foreground))] transition-colors group-hover/item:text-foreground group-data-[active=true]/item:text-[hsl(var(--accent))]"
              />
              <span className="overflow-hidden whitespace-nowrap text-[13px] font-medium text-[hsl(var(--muted-foreground))] opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100 group-hover/item:text-foreground group-data-[active=true]/item:text-foreground">
                {label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Footer · live status dot */}
      <div className="flex h-12 items-center gap-3 border-t-[0.5px] border-[hsl(var(--primary-glow)/0.12)] px-[18px]">
        <span className="relative inline-flex h-2 w-2 shrink-0">
          <span className="absolute inset-0 rounded-full bg-[hsl(var(--success))] opacity-60 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--success))]" />
        </span>
        <span className="overflow-hidden whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))] opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">
          Live
        </span>
      </div>
    </motion.aside>
  )
}
