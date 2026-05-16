import Link from "next/link"
import { Sparkles } from "lucide-react"

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-primary to-accent text-primary-foreground">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span className="font-mono text-sm uppercase tracking-[0.18em]">
            Zero Risk · Dashboard
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm text-muted-foreground">
          <Link
            href="/agents"
            className="hover:text-foreground hover:underline underline-offset-4"
          >
            Agents
          </Link>
          <Link
            href="/clients"
            className="hover:text-foreground hover:underline underline-offset-4"
          >
            Clients
          </Link>
          <Link
            href="/cascades"
            className="hover:text-foreground hover:underline underline-offset-4"
          >
            Cascades
          </Link>
        </nav>
      </div>
    </header>
  )
}
