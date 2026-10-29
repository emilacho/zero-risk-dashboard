"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export function BotonYaLoVi({ clave }: { clave: string }) {
  const router = useRouter()
  const [estado, setEstado] = useState<"quieto" | "guardando" | "error">("quieto")
  async function marcar() {
    setEstado("guardando")
    try {
      const r = await fetch("/api/alertas/visto", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clave }) })
      if (!r.ok) throw new Error(String(r.status))
      router.refresh()
    } catch {
      setEstado("error")
    }
  }
  return (
    <button type="button" onClick={marcar} disabled={estado === "guardando"} className="shrink-0 rounded border border-zinc-700 px-3 py-1 text-[12px] text-zinc-300 hover:bg-zinc-800 disabled:opacity-50">
      {estado === "guardando" ? "Guardando…" : estado === "error" ? "No se guardó · reintentar" : "Ya lo vi"}
    </button>
  )
}
