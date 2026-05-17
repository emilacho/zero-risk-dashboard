"use client"
/**
 * VaultTabsShell · Radix Tabs wrapper that renders server-passed
 * children (one per tab). Tabs nav is client-side · contents are
 * pre-rendered server components passed in via `tabs[].content`.
 *
 * NO function-prop callbacks crossing boundary · only primitives
 * (id / label / count / hue) + React nodes (server-rendered already).
 */
import { useState, type ReactNode } from "react"
import * as Tabs from "@radix-ui/react-tabs"

export type TabHue =
  | "violet"
  | "cyan"
  | "amber"
  | "emerald"
  | "rose"
  | "orange"
  | "purple"
  | "teal"
  | "sky"
  | "lime"

export interface VaultTabConfig {
  id: string
  label: string
  count: number
  hue: TabHue
  content: ReactNode
}

export function VaultTabsShell({ tabs }: { tabs: VaultTabConfig[] }) {
  const [active, setActive] = useState<string>(tabs[0]?.id ?? "brand")

  return (
    <Tabs.Root value={active} onValueChange={setActive}>
      <Tabs.List
        className="-mx-1 mb-4 flex items-center gap-1 overflow-x-auto pb-1"
        aria-label="Vault tabs"
      >
        {tabs.map((t) => (
          <Tabs.Trigger
            key={t.id}
            value={t.id}
            className="num shrink-0 rounded-full border-[0.5px] border-transparent px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))] transition hover:border-[hsl(var(--primary-glow)/0.25)] data-[state=active]:bg-[hsl(var(--primary-glow)/0.1)] data-[state=active]:text-foreground"
          >
            <span
              className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: `hsl(var(--hue-${t.hue}))` }}
            />
            {t.label}
            <span className="ml-1.5 tabular-nums text-[hsl(var(--muted-foreground))]">
              {t.count}
            </span>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {tabs.map((t) => (
        <Tabs.Content key={t.id} value={t.id} className="focus:outline-none">
          {t.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  )
}
