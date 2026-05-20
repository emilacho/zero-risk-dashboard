"use client"

import { useEffect } from "react"

export default function AtlasError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[atlas] route error:", error)
  }, [error])

  return (
    <div className="surface-card rim-instr p-8" data-rim="rose">
      <div className="relative z-[2] flex flex-col gap-4">
        <span className="eyebrow-chip self-start">
          <span className="h-1 w-1 rounded-full bg-[hsl(var(--danger))]" />
          Atlas · error
        </span>
        <h2 className="font-display text-xl font-semibold">
          Failed to load Atlas dashboard
        </h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {error.message ?? "Unknown error"}
        </p>
        {error.digest && (
          <p className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
            digest · {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={() => reset()}
          className="num self-start rounded-md border border-[hsl(var(--border))] px-4 py-2 text-[11px] uppercase tracking-[0.18em] hover:border-[hsl(var(--primary-glow)/0.6)]"
        >
          retry
        </button>
      </div>
    </div>
  )
}
