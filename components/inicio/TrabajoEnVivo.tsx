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
  const ultima = useRef<string | null>(inicial.filas[0]?.cuando ?? null)

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
          ultima.current = j.filas[0].cuando
          setFilas((prev) => { const ya = new Set(j.filas.map((x) => x.id)); return [...j.filas, ...prev.filter((x) => !ya.has(x.id))].slice(0, 8) })
        }
      } catch { if (vivo) setError(true) }
    }
    const t = setInterval(leer, CADA_MS)
    const alVolver = () => { if (!document.hidden) void leer() }
    document.addEventListener("visibilitychange", alVolver)
    return () => { vivo = false; clearInterval(t); document.removeEventListener("visibilitychange", alVolver) }
  }, [])

  return (
    <div data-hue="violet" className="surface-card">
      <p className="px-4 pt-3 text-[11px] text-[hsl(var(--muted-foreground))]">{hoy} tareas de los empleados en las últimas 24 horas{error ? " · sin conexión, reintentando" : ""}</p>
      {filas.length === 0 ? <p className="px-4 py-4 text-[13px] text-[hsl(var(--muted-foreground))]">Todavía no hay trabajo para mostrar.</p> : (
        <ul className="divide-y divide-white/5">
          {filas.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${LUZ[f.estado]}`} />
              <span className="min-w-0 flex-1"><span className="font-medium">{f.agente}</span>{f.oficina ? <span className="text-[hsl(var(--muted-foreground))]"> · {f.oficina}</span> : null} <span>{f.que_hace}</span></span>
              <span className="w-20 shrink-0 text-right text-[11px] text-[hsl(var(--muted-foreground))]">{f.hace}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
