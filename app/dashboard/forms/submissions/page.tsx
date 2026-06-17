import type { Metadata } from "next"
import Link from "next/link"
import { FormsQueryProvider } from "../hooks/FormsQueryProvider"
import { SubmissionsTable } from "../components/SubmissionsTable"

export const metadata: Metadata = {
  title: "Form submissions · admin",
  description: "Tally webhook submissions viewer · Stack V4 · Sprint 4",
}

export const dynamic = "force-dynamic"

export default function SubmissionsPage({
  searchParams,
}: {
  searchParams: { form_id?: string }
}) {
  const formId = searchParams.form_id ?? null

  return (
    <main className="mx-auto max-w-7xl px-6 pb-16 pt-10">
      <nav
        aria-label="Breadcrumb"
        className="num mb-6 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]"
      >
        <Link href="/" className="hover:text-foreground">
          Dashboard
        </Link>
        <span aria-hidden>·</span>
        <Link href="/dashboard/forms" className="hover:text-foreground">
          Forms
        </Link>
        <span aria-hidden>·</span>
        <span className="text-foreground">Submissions</span>
      </nav>
      <header className="mb-8 flex flex-col gap-2">
        <span className="eyebrow-chip self-start">
          <span className="h-1 w-1 rounded-full bg-current animate-pulse-dot" />
          Sprint 4 · submissions · webhook
        </span>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Submissions</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Tally webhook deposits raw payload aquí. Verify signature gate · click payload para ver el JSON entero.
        </p>
      </header>

      <FormsQueryProvider>
        <SubmissionsTable formId={formId} />
      </FormsQueryProvider>
    </main>
  )
}
