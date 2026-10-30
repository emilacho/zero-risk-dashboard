"use client"

import { useEffect, useRef, useState } from "react"
import type { FilaDelTrabajo, TrabajoEnVivo as Datos } from "@/lib/trabajo-en-vivo"

const CADA_MS = 5_000
const LUZ = { trabajando: "bg-amber-400 animate-pulse", listo: "bg-emerald-400", fallo: "bg-rose-500" } as const

/** El panel «lo que están haciendo ahora»: arranca con lo que trae el servidor y, mientras la pestaña se ve, pide solo lo nuevo cada pocos segundos (sin recargar la pantalla). */
export function TrabajoEnVivo({ inicial }: { inicial: Datos }) {
  const [filas, setFilas] = useState<FilaDelTrabajo[]>(inicial.filas)
  const [hoy, setHoy] = useState(inicial.hoy)
  const [error, setError] = useState(false)
  const ultima = useRef<string | null>(inicial.cursor)

  useEffect(() => {
    let vivo = true
    const leer = async () => {
      if (document.hidden || !navigator.onLine) return
      try {
        const r = await fetch(`/api/agents/recent-feed?limite=8${ultima.current ? `&desde=${encodeURIComponent(ultima.current)}` : ""}`, { cache: "no-store" })
        if (!r.ok) throw new Error(String(r.status))
        const j = (await r.json()) as { ok: boolean } & Datos
        if (!vivo || !j.ok) return
        setError(false)
        setHoy(j.hoy)
        if (j.filas.length) {
          if (j.cursor) ultima.current = j.cursor
          setFilas((prev) => { const ya = new Set(j.filas.map((x) => x.id)); return [...j.filas, ...prev.filter((x) => !ya.has(x.id))].sort((a, b) => (a.cuando < b.cuando ? 1 : -1)).slice(0, 8) })
        }
      } catch { if (vivo) setError(true) }
    }
    const t = setInterval(leer, CADA_MS)
    const alVolver = () => { if (!document.hidden) void leer() }
    document.addEventListener("visibilitychange", alVolver)
    return () => { vivo = false; clearInterval(t); document.removeEventListener("visibilitychange", alVolver) }
  }, [])

  const visibles = filas.slice(0, 4)
  return (
    <div>
      {visibles.length === 0 ? <p className="surface-card p-4 text-[13px] text-[hsl(var(--muted-foreground))]">Todavía no hay trabajo para mostrar.</p> : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {visibles.map((f) => (
            <div key={f.id} data-hue={f.estado === "fallo" ? "rose" : f.estado === "trabajando" ? "amber" : "violet"} className="surface-card flex flex-col gap-3 p-3.5">
              <p className="flex items-center gap-2 text-[13px] font-medium"><span className={`h-2 w-2 shrink-0 rounded-full ${LUZ[f.estado]}`} /><span className="truncate">{f.agente}</span>{f.oficina ? <span className="truncate font-normal text-[hsl(var(--muted-foreground))]">· {f.oficina}</span> : null}</p>
              <p className="rounded-md border border-white/10 px-2.5 py-2 text-[13px] leading-snug">{f.que_hace}</p>
              <p className="mt-auto text-right text-[11px] text-[hsl(var(--muted-foreground))]">{f.hace}</p>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-right text-[11px] text-[hsl(var(--muted-foreground))]">{hoy} tareas en las últimas 24 horas{error ? " · sin conexión, reintentando" : ""}</p>
    </div>
  )
}
