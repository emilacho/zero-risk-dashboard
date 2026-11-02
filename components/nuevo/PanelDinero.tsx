"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Desglose, Proveedores } from "@/components/nuevo/DineroDesglose"
import { diaLocal, fechaCorta, loQueCambio, NOMBRE_DE_DIMENSION, picos, serie, sumarDias, tarjetas, usdCorto, veces, type Dimension, type Dinero, type Pico, type Serie } from "@/lib/dinero-completo"

/**
 * TU OFICINA · DINERO (6.36 · boceto aprobado por Emilio 2-nov): todo el gasto de la agencia en un solo lugar, con la estructura de Ramp · AI Token Spend
 * (resumen «lo que cambió», tarjetas con variación y proyección, gasto en el tiempo conmutable) · solo la fachada es nuestra. Ajustes de Emilio: cada clave
 * del gráfico con un color claramente distinto, fechas bajo las barras y el valor al pasar el cursor; sin numeritos; el freno con su cifra.
 * Parte 1 = secciones 1–3 · parte 2 (6.37) = desglose (4) y proveedores (5), en `DineroDesglose.tsx`. Datos: `/api/direccion/dinero` (SOLO LECTURA).
 */
const AMBAR = "#e8731a"
type Periodo = "hoy" | "7" | "mes" | "30"
const PERIODOS: Array<{ k: Periodo; t: string }> = [{ k: "hoy", t: "Hoy" }, { k: "7", t: "7 días" }, { k: "mes", t: "Este mes" }, { k: "30", t: "30 días" }]
type Respuesta = ({ ok: true } & Dinero) | { ok: false; error: string }

function rangoDe(p: Periodo, hoy: string): { desde: string; hasta: string; porHora: boolean } {
  if (p === "hoy") return { desde: hoy, hasta: hoy, porHora: true }
  if (p === "7") return { desde: sumarDias(hoy, -6), hasta: hoy, porHora: false }
  if (p === "mes") return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy, porHora: false }
  return { desde: sumarDias(hoy, -29), hasta: hoy, porHora: false }
}

const Seccion = ({ titulo, children, extra, dato }: { titulo: string; children: React.ReactNode; extra?: React.ReactNode; dato: string }) => (
  <section data-dinero={dato} className="rounded-xl border border-white/[0.09] bg-[#1b1815] p-4 sm:p-5">
    <div className="mb-3 flex flex-wrap items-center gap-2"><h3 className="text-[12px] uppercase tracking-[0.2em] text-[#ffb86b]">{titulo}</h3>{extra}</div>
    {children}
  </section>
)
const SIN_DATO = <span data-sin-dato-todavia className="italic text-zinc-500">sin dato todavía</span>

/* 1 · lo que cambió esta semana */
function LoQueCambio({ datos, hoy, alAbrirCorrida }: { datos: Dinero; hoy: string; alAbrirCorrida?: (id: string) => void }) {
  const cambios = useMemo(() => loQueCambio(datos.movimientos, hoy, datos.cache), [datos, hoy])
  const ETIQUETA = { mayor: "Mayor cambio", pico: "Pico inusual", ahorro: "Para ahorrar" } as const
  return (
    <Seccion titulo="Lo que cambió esta semana" dato="cambios">
      <div className="grid gap-4 md:grid-cols-3">
        {cambios.map((c) => (
          <p key={c.tipo} data-cambio={c.tipo} className="text-[13px] leading-relaxed text-zinc-200">
            <span className="mr-2 inline-block rounded border border-amber-600/40 px-1.5 py-px align-[1px] text-[10.5px] uppercase tracking-[0.1em]" style={{ color: AMBAR }}>{ETIQUETA[c.tipo]}</span>
            {c.texto}
            {c.corrida && alAbrirCorrida && <button type="button" onClick={() => alAbrirCorrida(c.corrida!)} className="ml-1 text-zinc-100 underline decoration-amber-600/60 underline-offset-2 hover:decoration-amber-400">Ver la corrida →</button>}
          </p>
        ))}
      </div>
    </Seccion>
  )
}

/* 2 · tarjetas */
function Tarjetas({ datos, hoy }: { datos: Dinero; hoy: string }) {
  const k = useMemo(() => tarjetas(datos.movimientos, hoy), [datos, hoy])
  const Tarjeta = ({ t, v, children, dato }: { t: string; v: string; children: React.ReactNode; dato: string }) => (
    <div data-tarjeta={dato} className="rounded-xl border border-white/[0.09] bg-[#1b1815] px-4 py-3.5">
      <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">{t}</p>
      <p className="mt-1 text-[28px] font-extralight text-white [font-variant-numeric:tabular-nums]">{v}</p>
      <div className="text-[12px] text-zinc-400">{children}</div>
    </div>
  )
  const sube = (k.variacion_pct ?? 0) > 0
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Tarjeta dato="hoy" t="Gasto hoy" v={usdCorto(k.hoy)}>día normal {usdCorto(k.normal)}</Tarjeta>
      <Tarjeta dato="semana" t="Últimos 7 días" v={usdCorto(k.semana)}>{k.variacion_pct == null ? "sin semana anterior para comparar" : <><span style={{ color: sube ? "#f5a524" : "#7fc99a" }}>{sube ? "▲" : "▼"} {Math.abs(k.variacion_pct)} %</span> vs semana anterior</>}</Tarjeta>
      <Tarjeta dato="mes" t="Este mes · vs presupuesto" v={usdCorto(k.mes)}>
        <div className="my-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]" />
        presupuesto del mes: {SIN_DATO}
      </Tarjeta>
      <Tarjeta dato="proyeccion" t="Proyección a fin de mes" v={usdCorto(k.proyeccion)}>a este ritmo cierras en {usdCorto(k.proyeccion)} · mes anterior {usdCorto(k.mes_anterior)}</Tarjeta>
    </div>
  )
}

/* 3 · gasto en el tiempo */
const W = 1300, H = 230, IZQ = 52, ABAJO = 26, ARRIBA = 26
function Grafico({ s, picosDelRango, porHora, alAbrirCorrida }: { s: Serie; picosDelRango: Pico[]; porHora: boolean; alAbrirCorrida?: (id: string) => void }) {
  const [sobre, setSobre] = useState<number | null>(null)
  const max = Math.max(0.01, ...s.totales, s.normal) * 1.12
  const n = s.rotulos.length, paso = (W - IZQ - 8) / n, ancho = Math.max(3, Math.min(38, paso * 0.68))
  const y = (v: number) => H - ABAJO - (v / max) * (H - ABAJO - ARRIBA)
  const cada = Math.max(1, Math.ceil(n / 16))
  const lineas = [0.25, 0.5, 0.75, 1].map((f) => max * f / 1.12)
  const picoDe = new Map(picosDelRango.map((p) => [p.d, p]))
  const vacio = s.totales.every((v) => v === 0)
  return (
    <div className="relative" onMouseLeave={() => setSobre(null)}>
      <svg data-grafico viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Gasto en el tiempo">
        {lineas.map((v) => <g key={v}><line x1={IZQ} x2={W - 4} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,.06)" /><text x={IZQ - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="#6f6a64">{v.toLocaleString("es-EC", { maximumFractionDigits: v < 1 ? 2 : 1 })}</text></g>)}
        {s.normal > 0 && !porHora && <g><line x1={IZQ} x2={W - 4} y1={y(s.normal)} y2={y(s.normal)} stroke="rgba(255,226,190,.35)" strokeDasharray="5 5" /><text x={W - 6} y={y(s.normal) - 5} textAnchor="end" fontSize={11} fill="#9c948b">día normal</text></g>}
        {s.rotulos.map((r, i) => {
          const x = IZQ + i * paso + (paso - ancho) / 2
          let acum = 0
          const pico = picoDe.get(r)
          return (
            <g key={r} data-barra={r} onMouseEnter={() => setSobre(i)} onClick={() => pico?.corrida && alAbrirCorrida?.(pico.corrida)} style={{ cursor: pico?.corrida ? "pointer" : "default" }}>
              <rect x={IZQ + i * paso} y={ARRIBA} width={paso} height={H - ABAJO - ARRIBA} fill={sobre === i ? "rgba(255,255,255,.04)" : "transparent"} />
              {s.claves.map((k) => { const v = s.valores[i][k] ?? 0; if (!v) return null; const y1 = y(acum + v), y0 = y(acum); acum += v; return <rect key={k} data-clave={k} x={x} y={y1} width={ancho} height={Math.max(0.8, y0 - y1)} fill={s.colores[k]} opacity={sobre == null || sobre === i ? 1 : 0.55} /> })}
              {pico && <g data-pico={r}><circle cx={x + ancho / 2} cy={y(s.totales[i]) - 9} r={3.5} fill="#ffb86b" /><text x={x + ancho / 2} y={y(s.totales[i]) - 17} textAnchor="middle" fontSize={11} fill="#ffb86b">{veces(pico.veces)}</text></g>}
              {(i % cada === 0 || i === n - 1) && <text x={x + ancho / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="#8a8580">{porHora ? `${r} h` : fechaCorta(r)}</text>}
            </g>
          )
        })}
        {vacio && <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={14} fill="#6f6a64">Sin gasto en este período</text>}
      </svg>
      {sobre != null && s.totales[sobre] > 0 && (
        <div data-detalle-barra className="pointer-events-none absolute top-1 z-10 min-w-[190px] rounded-lg border border-white/10 bg-[#0f0d0c]/95 px-3 py-2 text-[12px] shadow-xl"
          style={{ left: `${Math.min(78, Math.max(2, ((IZQ + sobre * paso + paso) / W) * 100))}%` }}>
          <p className="mb-1 text-zinc-400">{porHora ? `Hoy, ${s.rotulos[sobre]}:00` : fechaCorta(s.rotulos[sobre])}</p>
          {s.claves.filter((k) => s.valores[sobre][k]).sort((a, b) => (s.valores[sobre][b] ?? 0) - (s.valores[sobre][a] ?? 0)).map((k) => (
            <p key={k} className="flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: s.colores[k] }} /><span className="truncate text-zinc-200">{k}</span><span className="ml-auto pl-3 tabular-nums text-zinc-100">{usdCorto(s.valores[sobre][k] ?? 0)}</span></p>
          ))}
          <p className="mt-1 flex border-t border-white/10 pt-1 text-zinc-300"><span>Total</span><span className="ml-auto tabular-nums text-white">{usdCorto(s.totales[sobre])}</span></p>
          {picoDe.get(s.rotulos[sobre]) && <p className="mt-1 text-[#ffb86b]">{veces(picoDe.get(s.rotulos[sobre])!.veces)} lo normal · {picoDe.get(s.rotulos[sobre])!.explicacion}{picoDe.get(s.rotulos[sobre])!.corrida ? " · clic para ver la corrida" : ""}</p>}
        </div>
      )}
      <div data-leyenda className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-zinc-400">
        {s.claves.map((k) => <span key={k} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.colores[k] }} />{k}</span>)}
        {picosDelRango.some((p) => p.corrida) && <span className="text-zinc-500">· clic en un pico abre su corrida en Observabilidad</span>}
      </div>
    </div>
  )
}

export function PanelDinero({ onCerrar, datosIniciales = null, fetchImpl = fetch, alAbrirCorrida }: { onCerrar: () => void; datosIniciales?: Dinero | null; fetchImpl?: typeof fetch; alAbrirCorrida?: (id: string) => void }) {
  const [datos, setDatos] = useState<Dinero | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!datosIniciales)
  const [periodo, setPeriodo] = useState<Periodo>("30")
  const [dim, setDim] = useState<Dimension>("proveedor")
  const cerrar = useRef<HTMLButtonElement>(null)
  const leer = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      const r = await fetchImpl("/api/direccion/dinero", { cache: "no-store" })
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

  const hoy = useMemo(() => diaLocal(datos?.leido_en ?? new Date().toISOString()), [datos])
  const rango = rangoDe(periodo, hoy)
  const s = useMemo(() => (datos ? serie(datos.movimientos, dim, { ...rango, normal: tarjetas(datos.movimientos, hoy).normal }) : null), [datos, dim, rango.desde, rango.hasta, rango.porHora, hoy]) // eslint-disable-line react-hooks/exhaustive-deps
  const picosDelRango = useMemo(() => (datos ? picos(datos.movimientos, hoy).filter((p) => p.d >= rango.desde && p.d <= rango.hasta) : []), [datos, hoy, rango.desde, rango.hasta])

  return (
    <div className="nv-panel fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="dinero-titulo" data-seccion="dinero" className="relative flex h-full max-h-full w-full max-w-[1440px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#161412] text-zinc-200 shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <h2 id="dinero-titulo" className="font-display text-[15px] font-light uppercase tracking-[0.28em]" style={{ color: AMBAR }}>Dinero</h2>
          <p className="text-[12px] text-zinc-400">Todo el gasto de la agencia en un solo lugar</p>
          <div role="group" aria-label="Período" className="flex gap-1.5">
            {PERIODOS.map((p) => <button key={p.k} type="button" data-periodo={p.k} aria-pressed={periodo === p.k} onClick={() => setPeriodo(p.k)} className={`rounded-full border px-2.5 py-1 text-[12px] ${periodo === p.k ? "border-amber-500/60 bg-amber-500/10 text-zinc-100" : "border-white/10 text-zinc-400 hover:text-zinc-200"}`}>{p.t}</button>)}
          </div>
          <button type="button" onClick={() => void leer()} disabled={cargando} className="ml-auto rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50">{cargando ? "Leyendo…" : "Actualizar"}</button>
          <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar el dinero" className="rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">Cerrar · Esc</button>
        </header>
        {error && <p role="alert" className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-[13px] text-rose-200 sm:px-6">{error}</p>}
        {cargando && !datos && <p className="px-6 py-6 text-[13px] text-zinc-500">Leyendo…</p>}
        {datos && s && (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
            <LoQueCambio datos={datos} hoy={hoy} alAbrirCorrida={alAbrirCorrida} />
            <Tarjetas datos={datos} hoy={hoy} />
            <Seccion titulo="Gasto en el tiempo" dato="tiempo" extra={
              <div role="group" aria-label="Ver por" className="ml-auto flex gap-1.5">
                {(Object.keys(NOMBRE_DE_DIMENSION) as Dimension[]).map((d) => <button key={d} type="button" data-dimension={d} aria-pressed={dim === d} onClick={() => setDim(d)} className={`rounded-full border px-2.5 py-1 text-[12px] ${dim === d ? "border-amber-500/60 bg-amber-500/10 text-zinc-100" : "border-white/10 text-zinc-400 hover:text-zinc-200"}`}>{NOMBRE_DE_DIMENSION[d]}</button>)}
              </div>}>
              <Grafico s={s} picosDelRango={picosDelRango} porHora={rango.porHora} alAbrirCorrida={alAbrirCorrida} />
            </Seccion>
            <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
              <Desglose datos={datos} rango={rango} hoy={hoy} alAbrirCorrida={alAbrirCorrida} />
              <Proveedores datos={datos} rango={rango} />
            </div>
            {datos.faltan.length > 0 && <p data-faltan className="text-[12px] text-zinc-500"><span className="text-zinc-400">Sin dato todavía:</span> {datos.faltan.join(" · ")}</p>}
          </div>
        )}
      </section>
    </div>
  )
}
