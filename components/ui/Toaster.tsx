"use client"
/**
 * Toaster · Sprint #8 P1 component.
 *
 * Sonner wrapper · dashboard is dark-only (no next-themes installed) so
 * theme is locked to "dark" · Lumen v3 surface tokens injected via
 * toastOptions.classNames so the toast surface matches surface-card rim
 * aesthetic from elsewhere in the app.
 *
 * Usage:
 *   1. <Toaster /> rendered ONCE in app/layout.tsx
 *   2. anywhere: import { toast } from "sonner"
 *      toast.success("Campaign created")
 *      toast.error("Upload failed", { description: "Check file size" })
 *      toast("Default") · toast.warning · toast.info · toast.loading · toast.promise
 */
import { Toaster as SonnerToaster } from "sonner"

export function Toaster() {
  return (
    <SonnerToaster
      theme="dark"
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast surface-card rim-instr !bg-[hsl(var(--background))] !text-foreground !border-[hsl(var(--border))] shadow-[0_24px_60px_-12px_hsl(var(--background)/0.8)]",
          title: "font-display text-sm font-semibold tracking-tight",
          description:
            "!text-[hsl(var(--muted-foreground))] text-[11px] mt-0.5",
          actionButton:
            "!bg-[hsl(var(--primary))] !text-[hsl(var(--primary-foreground))] num text-[10px] uppercase tracking-[0.18em]",
          cancelButton:
            "!bg-[hsl(var(--muted))] !text-[hsl(var(--muted-foreground))] num text-[10px] uppercase tracking-[0.18em]",
          success:
            "!border-[hsl(var(--success)/0.4)] [&_[data-icon]]:!text-[hsl(var(--success))]",
          error:
            "!border-[hsl(var(--danger)/0.4)] [&_[data-icon]]:!text-[hsl(var(--danger))]",
          warning:
            "!border-[hsl(var(--hue-amber)/0.4)] [&_[data-icon]]:!text-[hsl(var(--hue-amber))]",
          info:
            "!border-[hsl(var(--accent)/0.4)] [&_[data-icon]]:!text-[hsl(var(--accent))]",
        },
      }}
    />
  )
}

// Re-export the `toast` function so callers can `import { toast } from "@/components/ui/Toaster"`
// if they prefer the local alias to the bare sonner import.
export { toast } from "sonner"
