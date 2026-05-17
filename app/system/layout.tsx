import Link from "next/link"
import { SystemTabsNav } from "@/components/SystemTabsNav"

export default function SystemLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="mx-auto max-w-[1400px] px-6 pb-16 pt-10">
      <header className="mb-6 flex flex-col gap-3">
        <Link
          href="/"
          className="num text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))] hover:text-foreground"
        >
          ← Overview
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p
              className="num text-[11px] uppercase tracking-[0.2em]"
              style={{ color: "hsl(var(--accent))" }}
            >
              Capa B · sistema desplegado
            </p>
            <h1 className="mt-1 font-display text-[40px] font-semibold leading-[1.02] tracking-tight md:text-[52px]">
              <span className="text-gradient">System</span>
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[hsl(var(--muted-foreground))]">
              Todo lo desplegado · agents · workflows · brazos ·
              plataformas · storage · memoria · inbox · roadmap · cada
              fila navegable hasta el átomo.
            </p>
          </div>
        </div>
      </header>
      <SystemTabsNav />
      <div className="mt-8">{children}</div>
    </main>
  )
}
