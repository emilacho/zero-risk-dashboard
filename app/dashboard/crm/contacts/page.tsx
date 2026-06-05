import type { Metadata } from "next"
import Link from "next/link"
import { CrmQueryProvider } from "./hooks/CrmQueryProvider"
import { ContactsTable } from "./components/ContactsTable"

export const metadata: Metadata = {
  title: "Contactos · CRM",
  description: "CRM nativo Stack V4 · client_champions table · Sprint 4",
}

export const dynamic = "force-dynamic"

export default function ContactsPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 pb-16 pt-10">
      <nav
        aria-label="Breadcrumb"
        className="num mb-6 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]"
      >
        <Link href="/" className="hover:text-foreground">Dashboard</Link>
        <span aria-hidden>·</span>
        <span>CRM</span>
        <span aria-hidden>·</span>
        <span className="text-foreground">Contactos</span>
      </nav>
      <header className="mb-8 flex flex-col gap-2">
        <span className="eyebrow-chip self-start">
          <span className="h-1 w-1 rounded-full bg-current animate-pulse-dot" />
          Sprint 4 · CRM nativo · GHL-Out
        </span>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Contactos
        </h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Reemplaza GHL Contacts. Tagging + relaciones + influencia.
        </p>
      </header>

      <CrmQueryProvider>
        <ContactsTable />
      </CrmQueryProvider>
    </main>
  )
}
