"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Riesgos, Saldo, Tope } from "@/lib/direccion-riesgos"
import { colorDelMedidor, diaDelCiclo, usd } from "@/lib/direccion-dinero"

/**
 * TU OFICINA · DINERO (6.23): aquí se ve el gasto. A la izquierda, el saldo de cada proveedor como un anillo (cuánto del crédito del ciclo se usó y cuándo
 * cierra); a la derecha, el freno de gasto de cada cliente: lo gastado en 24 h contra su techo (el mismo con que el freno detiene a sus agentes).
 * Datos: `/api/direccion/riesgos` (servidor del tablero → ruta certificada de la plataforma): `saldos[]` y `topes[]`. SOLO LECTURA.
 */
const AMBAR = "#e8731a"
type Respuesta = ({ ok: true } & Riesgos) | { ok: false; error: string }

/** un anillo de saldo: el arco lleno es lo usado del crédito del ciclo */
function Anillo({ s }: { s: Saldo }) {
  const R = 54, L = 2 * Math.PI * R, p = s.pct == null ? null : Math.max(0, Math.min(100, s.pct)), color = colorDelMedidor(p), cierra = diaDelCiclo(s.ciclo_hasta)
  return (
    <div data-saldo={s.proveedor} className="flex items-center gap-5 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <svg viewBox="0 0 140 140" className="h-[132px] w-[132px] shrink-0" role="img" aria-label={`${s.proveedor}: ${p == null ? "sin dato" : `${p.toFixed(0)} % usado`}`}>
        <circle cx={70} cy={70} r={R + 9} fill="none" stroke="rgba(255,226,190,.08)" strokeWidth={1} />
        <circle cx={70} cy={70} r={R} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={9} />
        {p != null && <circle cx={70} cy={70} r={R} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" strokeDasharray={`${(L * p) / 100} ${L}`} transform="rotate(-90 70 70)" style={{ filter: `drop-shadow(0 0 6px ${color}66)` }} />}
        <text x={70} y={68} textAnchor="middle" fontSize={26} fontWeight={200} fill="#fff">{p == null ? "—" : `${p.toFixed(0)}%`}</text>
        <text x={70} y={88} textAnchor="middle" fontSize={9} letterSpacing=".14em" fill="rgba(255,226,190,.55)">USADO</text>
      </svg>
      <div className="min-w-0">
        <p className="text-[15px] text-white">{s.proveedor}{s.plan ? <span className="ml-2 text-[11px] uppercase tracking-[0.14em] text-zinc-500">{s.plan}</span> : null}</p>
        <p className="mt-1 text-[13px] text-zinc-300">{usd(s.usado_usd)} de {usd(s.credito_usd)}</p>
        {s.credito_usd != null && s.usado_usd != null && <p className="text-[12.5px] text-zinc-400">Quedan {usd(Math.max(0, s.credito_usd - s.usado_usd))}</p>}
        {cierra && <p className="mt-1 text-[12px] text-zinc-500">El ciclo cierra el {cierra}</p>}
      </div>
    </div>
  )
}

/** el freno de un cliente: barra de lo gastado en 24 h hasta su techo */
function Freno({ t }: { t: Tope }) {
  const p = t.pct == null ? null : Math.max(0, Math.min(100, t.pct)), color = colorDelMedidor(p)
  return (
    <div data-freno={t.cliente ?? "sin-cliente"} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-baseline gap-3">
        <p className="min-w-0 truncate text-[14px] text-white">{t.cliente ?? "Sin cliente"}</p>
        <p className="ml-auto shrink-0 text-[22px] font-extralight text-white [font-variant-numeric:tabular-nums]">{p == null ? "—" : `${p.toFixed(0)} %`}</p>
      </div>
      <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${p ?? 0}%`, background: color, boxShadow: `0 0 10px ${color}88` }} />
      </div>
      <p className="mt-2 text-[12.5px] text-zinc-400">{usd(t.gastado_24h_usd)} gastado en 24 h · techo {usd(t.techo_usd)}</p>
    </div>
  )
}

export function PanelDinero({ onCerrar, datosIniciales = null, fetchImpl = fetch }: { onCerrar: () => void; datosIniciales?: Riesgos | null; fetchImpl?: typeof fetch }) {
  const [datos, setDatos] = useState<Riesgos | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!datosIniciales)
  const cerrar = useRef<HTMLButtonElement>(null)
  const leer = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      const r = await fetchImpl("/api/direccion/riesgos", { cache: "no-store" })
      const j = (await r.json().catch(() => null)) as Respuesta | null
      if (!r.ok || !j || !j.ok) throw new Error(r.status === 401 || r.status === 403 ? "Necesitas una sesión de administrador para ver el dinero." : (j && !j.ok && j.error) || `No pude leer el dinero (${r.status}).`)
      setDatos(j)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setCargando(false) }
  }, [fetchImpl])
  useEffect(() => { if (!datosIniciales) void leer() }, [leer, datosIniciales])
  useEffect(() => { cerrar.current?.focus() }, [])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key !== "Escape") return; e.stopPropagation(); e.preventDefault(); onCerrar() }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar])

  const sinSaldo = (datos?.sin_fuente ?? []).filter((s) => /saldo/i.test(s.que)).map((s) => s.que)
  return (
    <div className="nv-panel fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="dinero-titulo" data-seccion="dinero" className="relative flex max-h-full w-full max-w-[1100px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#161412] text-zinc-200 shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <h2 id="dinero-titulo" className="font-display text-[15px] font-light uppercase tracking-[0.28em]" style={{ color: AMBAR }}>Dinero</h2>
          <p className="text-[12px] text-zinc-400">Saldos de proveedores y freno de gasto de cada cliente</p>
          <button type="button" onClick={() => void leer()} disabled={cargando} className="ml-auto rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50">{cargando ? "Leyendo…" : "Actualizar"}</button>
          <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar el dinero" className="rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">Cerrar · Esc</button>
        </header>
        {error && <p role="alert" className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-[13px] text-rose-200 sm:px-6">{error}</p>}
        {cargando && !datos && <p className="px-6 py-6 text-[13px] text-zinc-500">Leyendo…</p>}
        {datos && (
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-y-auto p-4 sm:p-6 lg:grid-cols-2">
            <div className="min-w-0">
              <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-zinc-500">Saldos de proveedores · el ciclo</p>
              <div className="space-y-3">
                {datos.saldos.map((s) => <Anillo key={s.proveedor} s={s} />)}
                {!datos.saldos.length && <p className="text-[13px] text-zinc-500">Sin dato</p>}
              </div>
            </div>
            <div className="min-w-0">
              <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-zinc-500">Freno de gasto · últimas 24 h</p>
              <div className="space-y-3">
                {datos.topes.map((t, k) => <Freno key={t.client_id ?? k} t={t} />)}
                {!datos.topes.length && <p className="text-[13px] text-zinc-500">Sin dato</p>}
              </div>
              <p data-fuente-del-techo className="mt-3 text-[12px] leading-relaxed text-zinc-500">El techo es el mismo con que el freno detiene a los agentes de ese cliente: el de su ficha o, si no tiene, el general de arranque.</p>
            </div>
            <div data-sin-dato className="border-t border-white/10 pt-3 text-[12px] leading-relaxed text-zinc-500 lg:col-span-2">
              <span className="text-zinc-400">Sin dato todavía:</span> {[...sinSaldo, "presupuesto del mes", "gasto por oficina (llega con el panel de gastos de cada oficina)"].join(" · ")}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
