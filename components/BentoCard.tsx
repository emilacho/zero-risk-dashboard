import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface BentoCardProps {
  title: string
  subtitle?: string
  href?: string
  span?: "1" | "2" | "3"
  rowSpan?: "1" | "2"
  accent?: "primary" | "accent" | "muted"
  children: ReactNode
}

const colSpan = {
  "1": "md:col-span-1",
  "2": "md:col-span-2",
  "3": "md:col-span-3",
}
const rowSpanCls = {
  "1": "md:row-span-1",
  "2": "md:row-span-2",
}
const accentBorder = {
  primary: "border-primary/30 hover:border-primary/60",
  accent: "border-accent/30 hover:border-accent/60",
  muted: "border-border hover:border-border/80",
}

export function BentoCard({
  title,
  subtitle,
  href,
  span = "1",
  rowSpan = "1",
  accent = "muted",
  children,
}: BentoCardProps) {
  const inner = (
    <div
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-colors",
        accentBorder[accent],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-1 text-sm text-foreground/80">{subtitle}</p>
          ) : null}
        </div>
        {href ? (
          <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
        ) : null}
      </div>
      <div className="mt-4 flex-1">{children}</div>
    </div>
  )
  if (href) {
    return (
      <Link href={href} className={cn(colSpan[span], rowSpanCls[rowSpan])}>
        {inner}
      </Link>
    )
  }
  return <div className={cn(colSpan[span], rowSpanCls[rowSpan])}>{inner}</div>
}
