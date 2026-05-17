"use client"
/**
 * SystemTabsNav · sticky horizontal tab nav across the 8 /system/* tabs.
 *
 *   - reads `usePathname` to mark the active tab
 *   - violet rail under active tab + hue dot per tab category
 *   - mono-caps style consistent with sidebar + dept pages
 */
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SYSTEM_TABS } from "@/lib/system-tabs"

export function SystemTabsNav() {
  const pathname = usePathname()
  return (
    <nav className="sticky top-0 z-20 -mx-6 border-y-[0.5px] border-[hsl(var(--primary-glow)/0.18)] bg-[hsl(var(--background)/0.86)] px-6 py-2 backdrop-blur-xl">
      <ul className="flex items-center gap-1 overflow-x-auto">
        {SYSTEM_TABS.map((t) => {
          const href = `/system/${t.slug}`
          const active = pathname?.startsWith(href)
          return (
            <li key={t.slug} className="shrink-0">
              <Link
                href={href}
                data-active={active ? "true" : undefined}
                className="group relative inline-flex h-9 items-center gap-2 rounded-full border-[0.5px] border-transparent px-3 text-[12px] font-medium text-[hsl(var(--muted-foreground))] transition hover:border-[hsl(var(--primary-glow)/0.2)] hover:text-foreground data-[active=true]:border-[hsl(var(--primary-glow)/0.4)] data-[active=true]:bg-[hsl(var(--primary-glow)/0.08)] data-[active=true]:text-foreground"
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: `hsl(var(--hue-${t.hue}))` }}
                />
                {t.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
