"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Desglose, Proveedores } from "@/components/nuevo/DineroDesglose"
import { Ahorro, Anomalias, CostoPorResultado } from "@/components/nuevo/DineroResultados"
import { Ayuda } from "@/components/nuevo/DineroAyuda"
import { PanelCliente } from "@/components/nuevo/PanelCliente"
import { ROTULO_TARJETA, TITULO_SECCION } from "@/components/nuevo/estilos-titulos"
import { anteriorDe, cacheDelRango, costoDeRehacer, diaLocal, fechaCorta, frenteA, loQueCambio, NOMBRE_DE_DIMENSION, PERIODOS, picos, rangoDe, resumenDelPeriodo, serie, tarjetas, usdCorto, veces, type Dimension, type Dinero, type Periodo, type Pico, type Serie } from "@/lib/dinero-completo"

/**
 * TU OFICINA · DINERO (6.36 · boceto aprobado por Emilio 2-nov): todo el gasto de la agencia en un solo lugar, con la estructura de Ramp · AI Token Spend
 * (resumen «lo que cambió», tarjetas con variación y proyección, gasto en el tiempo conmutable) · solo la fachada es nuestra. Ajustes de Emilio: cada clave
 * del gráfico con un color claramente distinto, fechas bajo las barras y el valor al pasar el cursor; sin numeritos; el freno con su cifra.
 * 6.40 (Tarea A): pantalla completa, UN selector de período que manda en todo frente a su anterior igual, número principal grande arriba e índice fijo.
 * Parte 1 = secciones 1–3 · parte 2 (6.37) = desglose (4) y proveedores (5), en `DineroDesglose.tsx` · parte 3 (6.38) = resultado, anomalías y ahorro (6–8), en `DineroResultados.tsx`. Datos: `/api/direccion/dinero` (SOLO LECTURA).
 */
const AMBAR = "#e8731a"
type Respuesta = ({ ok: true } & Dinero) | { ok: false; error: string }
type Anterior = { desde: string; hasta: string; nombre: string }
/** 6.40 · el índice fijo de Ramp: saltar a cada sección sin desplazarse */
export const INDICE: Array<{ id: string; t: string }> = [
  { id: "resumen", t: "Resumen" }, { id: "tiempo", t: "En el tiempo" }, { id: "desglose", t: "Desglose" }, { id: "proveedores", t: "Proveedores" },
  { id: "resultados", t: "Resultados" }, { id: "anomalias", t: "Anomalías" }, { id: "ahorro", t: "Ahorro" },
]
const Ancla = ({ id, children }: { id: string; children: React.ReactNode }) => <div id={`dinero-${id}`} data-indice-seccion={id} className="scroll-mt-14">{children}</div>

const Seccion = ({ titulo, children, extra, dato, ayuda }: { titulo: string; children: React.ReactNode; extra?: React.ReactNode; dato: string; ayuda?: string }) => (
  <section data-dinero={dato} className="rounded-xl border border-white/[0.09] bg-[#1b1815] p-4 sm:p-5">
    <div className="mb-3 flex flex-wrap items-center gap-2"><h3 className={TITULO_SECCION}>{titulo}</h3>{ayuda && <Ayuda texto={ayuda} />}{extra}</div>
    {children}
  </section>
)
const SIN_DATO = <span data-sin-dato-todavia className="italic text-zinc-500">sin dato todavía</span>

/* 1 · lo que cambió (6.41): 3 tarjetas con un número grande y una línea corta; el detalle en «ver más» */
function LoQueCambio({ datos, hoy, rango, anterior, alAbrirCorrida }: { datos: Dinero; hoy: string; rango: { desde: string; hasta: string }; anterior: Anterior; alAbrirCorrida?: (id: string) => void }) {
  const cambios = useMemo(() => loQueCambio(datos.movimientos, hoy, cacheDelRango(datos, rango) ?? datos.cache, { r: rango, ant: anterior }), [datos, hoy, rango, anterior])
  const [abierta, setAbierta] = useState<string | null>(null)
  const ETIQUETA = { mayor: "Mayor cambio", pico: "Pico inusual", ahorro: "Para ahorrar" } as const
  const color = (c: (typeof cambios)[number]) => (c.tipo === "mayor" && c.numero?.startsWith("▲") ? "#f5a524" : c.tipo === "mayor" && c.numero?.startsWith("▼") ? "#7fc99a" : c.tipo === "ahorro" ? "#7fc99a" : "#ffffff")
  return (
    <section data-dinero="cambios" className="grid gap-3 md:grid-cols-3">
      {cambios.map((c) => (
        <div key={c.tipo} data-cambio={c.tipo} className="rounded-xl border border-white/[0.09] bg-[#1b1815] px-4 py-3.5">
          <h4 className={ROTULO_TARJETA}>{ETIQUETA[c.tipo]}</h4>
          <p data-cambio-numero className="mt-1 text-[30px] font-extralight leading-tight [font-variant-numeric:tabular-nums]" style={{ color: color(c) }}>{c.numero ?? "—"}</p>
          <p data-cambio-linea className="text-[13px] text-zinc-300">{c.linea ?? c.texto}</p>
          <div className="mt-2 flex items-center gap-3 text-[12px]">
            <button type="button" data-ver-mas aria-expanded={abierta === c.tipo} onClick={() => setAbierta((a) => (a === c.tipo ? null : c.tipo))} className="text-zinc-400 underline decoration-white/20 underline-offset-2 hover:text-zinc-200">{abierta === c.tipo ? "ver menos" : "ver más"}</button>
            {c.corrida && alAbrirCorrida && <button type="button" onClick={() => alAbrirCorrida(c.corrida!)} className="text-zinc-200 underline decoration-amber-600/60 underline-offset-2 hover:decoration-amber-400">Ver la corrida →</button>}
          </div>
          {abierta === c.tipo && <p data-cambio-detalle className="mt-2 border-t border-white/[0.07] pt-2 text-[12.5px] leading-relaxed text-zinc-400">{c.texto}</p>}
        </div>
      ))}
    </section>
  )
}

/* 2 · el número principal (Ramp): gasto del período + variación frente al anterior igual + proyección; lo demás más chico */
const Chica = ({ t, v, children, dato, ayuda }: { t: string; v: React.ReactNode; children?: React.ReactNode; dato: string; ayuda?: string }) => (
  <div data-tarjeta={dato} className="min-w-0">
    <p className={`flex items-center gap-1.5 ${ROTULO_TARJETA}`}>{t}{ayuda && <Ayuda texto={ayuda} lado="izquierda" />}</p>
    <p className="mt-0.5 text-[20px] font-extralight text-white [font-variant-numeric:tabular-nums]">{v}</p>
    {children && <div className="text-[12px] text-zinc-400">{children}</div>}
  </div>
)
function Resumen({ datos, hoy, rango, anterior }: { datos: Dinero; hoy: string; rango: { desde: string; hasta: string }; anterior: Anterior }) {
  const k = useMemo(() => resumenDelPeriodo(datos.movimientos, rango, anterior, hoy), [datos, rango, anterior, hoy])
  const rehacer = useMemo(() => costoDeRehacer(datos, rango).reduce((s, x) => s + (x.usd ?? 0), 0), [datos, rango])
  const sube = (k.variacion_pct ?? 0) > 0
  return (
    <section data-dinero="resumen" className="grid gap-5 rounded-xl border border-white/[0.09] bg-[#1b1815] p-5 sm:p-6 lg:grid-cols-[1.3fr_1fr] lg:items-end">
      <div data-tarjeta="periodo">
        <h3 className={TITULO_SECCION}>Gasto del período</h3>
        <p data-numero-principal className="mt-1 text-[clamp(44px,6vw,72px)] font-extralight leading-none text-white [font-variant-numeric:tabular-nums]">{usdCorto(k.total)}</p>
        <p className="mt-3 text-[14px] text-zinc-300">
          {k.variacion_pct == null ? <span className="text-zinc-500">sin gasto en {anterior.nombre} para comparar</span>
            : <><span data-variacion style={{ color: sube ? "#f5a524" : "#7fc99a" }}>{sube ? "▲" : "▼"} {Math.abs(k.variacion_pct)} %</span> {frenteA(anterior.nombre)} <span className="text-zinc-500">({usdCorto(k.anterior)})</span></>}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/[0.07] pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        <Chica dato="proyeccion" t="Proyección a fin de mes" v={usdCorto(k.proyeccion)} ayuda={`A este ritmo cierras en ${usdCorto(k.proyeccion)}: lo gastado en el mes más el ritmo de los últimos 30 días (${usdCorto(k.ritmo_diario)} al día) por los días que faltan.`}>ritmo {usdCorto(k.ritmo_diario)}/día{k.poco_dato_del_mes && <span data-poco-dato className="text-amber-300/80"> · poco dato del mes todavía</span>}</Chica>
        <Chica dato="presupuesto" t="Presupuesto del mes" v={SIN_DATO}>mes anterior {usdCorto(k.mes_anterior)}</Chica>
        <Chica dato="por-dia" t="Promedio por día" v={usdCorto(k.por_dia)}>{k.dias} {k.dias === 1 ? "día" : "días"}</Chica>
        <Chica dato="rehacer" t="Costo de rehacer" v={usdCorto(rehacer)} ayuda="Lo gastado en piezas devueltas o rechazadas, llamadas fallidas, corridas cortadas por tope y pruebas. El detalle está en Resultados.">fallas, devoluciones y pruebas</Chica>
      </div>
    </section>
  )
}

/* 3 · gasto en el tiempo */
export function pasoRedondo(x: number): number { const e = Math.pow(10, Math.floor(Math.log10(x))), f = x / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e }
const W = 1300, H = 230, IZQ = 78, ABAJO = 26, ARRIBA = 26
function Grafico({ s, picosDelRango, porHora, alAbrirCorrida }: { s: Serie; picosDelRango: Pico[]; porHora: boolean; alAbrirCorrida?: (id: string) => void }) {
  const [sobre, setSobre] = useState<number | null>(null)
  // 6.41 · la leyenda oculta y muestra cada serie (como Ramp); los totales y la escala se rehacen con lo visible
  const [ocultas, setOcultas] = useState<Set<string>>(new Set())
  const claves = s.claves.filter((k) => !ocultas.has(k))
  const totales = s.valores.map((v) => claves.reduce((t, k) => t + (v[k] ?? 0), 0))
  const alternar = (k: string) => setOcultas((o) => { const n = new Set(o); if (n.has(k)) n.delete(k); else if (n.size < s.claves.length - 1) n.add(k); return n })
  // 6.41 · eje con cifras redondas (1 · 2 · 2,5 · 5 × 10ⁿ)
  const tope = Math.max(0.01, ...totales, s.normal), pasoEje = pasoRedondo(tope / 4)
  const max = Math.max(tope * 1.12, Math.ceil(tope / pasoEje) * pasoEje)
  const n = s.rotulos.length, paso = (W - IZQ - 8) / n, ancho = Math.max(3, Math.min(38, paso * 0.68))
  const y = (v: number) => H - ABAJO - (v / max) * (H - ABAJO - ARRIBA)
  const cada = Math.max(1, Math.ceil(n / 16))
  const lineas = Array.from({ length: Math.floor(max / pasoEje + 1e-9) }, (_, i) => (i + 1) * pasoEje)
  const decimales = pasoEje < 1 ? 2 : Number.isInteger(pasoEje) ? 0 : 1
  const picoDe = new Map(picosDelRango.map((p) => [p.d, p]))
  const vacio = totales.every((v) => v === 0)
  return (
    <div className="relative" onMouseLeave={() => setSobre(null)}>
      <svg data-grafico viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Gasto en el tiempo">
        {lineas.map((v) => <g key={v}><line x1={IZQ} x2={W - 4} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,.06)" /><text data-eje x={IZQ - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="#8a8580">{`US$ ${v.toLocaleString("es-EC", { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}`}</text></g>)}
        {s.normal > 0 && !porHora && <g><line x1={IZQ} x2={W - 4} y1={y(s.normal)} y2={y(s.normal)} stroke="rgba(255,226,190,.35)" strokeDasharray="5 5" /><text x={W - 6} y={y(s.normal) - 5} textAnchor="end" fontSize={11} fill="#9c948b">día normal</text></g>}
        {s.rotulos.map((r, i) => {
          const x = IZQ + i * paso + (paso - ancho) / 2
          let acum = 0
          const pico = picoDe.get(r)
          return (
            <g key={r} data-barra={r} onMouseEnter={() => setSobre(i)} onClick={() => pico?.corrida && alAbrirCorrida?.(pico.corrida)} style={{ cursor: pico?.corrida ? "pointer" : "default" }}>
              <rect x={IZQ + i * paso} y={ARRIBA} width={paso} height={H - ABAJO - ARRIBA} fill={sobre === i ? "rgba(255,255,255,.04)" : "transparent"} />
              {claves.map((k) => { const v = s.valores[i][k] ?? 0; if (!v) return null; const y1 = y(acum + v), y0 = y(acum); acum += v; return <rect key={k} data-clave={k} x={x} y={y1} width={ancho} height={Math.max(0.8, y0 - y1)} fill={s.colores[k]} opacity={sobre == null || sobre === i ? 1 : 0.55} /> })}
              {pico && totales[i] > 0 && <g data-pico={r}><circle cx={x + ancho / 2} cy={y(totales[i]) - 9} r={3.5} fill="#ffb86b" /><text x={x + ancho / 2} y={y(totales[i]) - 17} textAnchor="middle" fontSize={11} fill="#ffb86b">{veces(pico.veces)}</text></g>}
              {(i % cada === 0 || i === n - 1) && <text x={x + ancho / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="#8a8580">{porHora ? `${r} h` : fechaCorta(r)}</text>}
            </g>
          )
        })}
        {vacio && <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={14} fill="#6f6a64">Sin gasto en este período</text>}
      </svg>
      {sobre != null && totales[sobre] > 0 && (
        <div data-detalle-barra className="pointer-events-none absolute top-1 z-10 min-w-[200px] rounded-lg border border-white/10 bg-[#0f0d0c]/95 px-3 py-2 text-[12px] shadow-xl"
          style={{ left: `${Math.min(78, Math.max(2, ((IZQ + sobre * paso + paso) / W) * 100))}%` }}>
          <p className="text-zinc-400">{porHora ? `Hoy, ${s.rotulos[sobre]}:00` : fechaCorta(s.rotulos[sobre])}</p>
          <p data-total-del-dia className="mb-1.5 text-[20px] font-light tabular-nums text-white">{usdCorto(totales[sobre])}</p>
          {claves.filter((k) => s.valores[sobre][k]).sort((a, b) => (s.valores[sobre][b] ?? 0) - (s.valores[sobre][a] ?? 0)).map((k) => (
            <p key={k} className="flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: s.colores[k] }} /><span className="truncate text-zinc-200">{k}</span><span className="ml-auto pl-3 tabular-nums text-zinc-100">{usdCorto(s.valores[sobre][k] ?? 0)}</span></p>
          ))}
          {picoDe.get(s.rotulos[sobre]) && <p className="mt-1 text-[#ffb86b]">{veces(picoDe.get(s.rotulos[sobre])!.veces)} lo normal{picoDe.get(s.rotulos[sobre])!.corrida ? " · clic para ver la corrida" : ""}</p>}
        </div>
      )}
      <div data-leyenda className="mt-3 flex flex-wrap gap-2">
        {s.claves.map((k) => {
          const oculta = ocultas.has(k)
          return (
            <button key={k} type="button" data-serie={k} aria-pressed={!oculta} onClick={() => alternar(k)} title={oculta ? "Mostrar" : "Ocultar"}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] transition-colors ${oculta ? "border-white/[0.06] text-zinc-600 line-through" : "border-white/[0.12] text-zinc-200 hover:border-white/25"}`}>
              <span className="h-3 w-3 rounded-sm" style={{ background: oculta ? "transparent" : s.colores[k], boxShadow: oculta ? `inset 0 0 0 1.5px ${s.colores[k]}` : undefined }} />{k}
            </button>
          )
        })}
        {ocultas.size > 0 && <button type="button" data-mostrar-todas onClick={() => setOcultas(new Set())} className="px-2 text-[12px] text-zinc-400 underline underline-offset-2 hover:text-zinc-200">mostrar todas</button>}
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
  // 6.44 · la vista del cliente se abre ENCIMA de Dinero: su flecha (o Esc) regresa aquí, con el período y el lugar donde estabas
  const [cliente, setCliente] = useState<string | null>(null)
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
    const tecla = (e: KeyboardEvent) => { if (e.key !== "Escape" || cliente) return; e.stopPropagation(); e.preventDefault(); onCerrar() }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar, cliente])

  const hoy = useMemo(() => diaLocal(datos?.leido_en ?? new Date().toISOString()), [datos])
  const rango = useMemo(() => rangoDe(periodo, hoy), [periodo, hoy])
  const anterior = useMemo(() => anteriorDe(periodo, rango), [periodo, rango])
  const cuerpo = useRef<HTMLDivElement>(null)
  const [activa, setActiva] = useState("resumen")
  // el índice marca la sección que está a la vista (como Ramp)
  useEffect(() => {
    const c = cuerpo.current; if (!c || typeof IntersectionObserver === "undefined") return
    const obs = new IntersectionObserver((es) => { const v = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (v) setActiva((v.target as HTMLElement).dataset.indiceSeccion ?? "resumen") }, { root: c, rootMargin: "-56px 0px -60% 0px" })
    c.querySelectorAll("[data-indice-seccion]").forEach((n) => obs.observe(n))
    return () => obs.disconnect()
  }, [datos])
  const irA = (id: string) => {
    setActiva(id)
    const c = cuerpo.current, el = c?.querySelector<HTMLElement>(`#dinero-${id}`); if (!c || !el) return
    const nav = c.querySelector<HTMLElement>("[data-indice]")?.offsetHeight ?? 0
    c.scrollTo({ top: el.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop - nav - 8, behavior: "smooth" })
  }
  const s = useMemo(() => (datos ? serie(datos.movimientos, dim, { ...rango, normal: tarjetas(datos.movimientos, hoy).normal }) : null), [datos, dim, rango, hoy])
  const picosDelRango = useMemo(() => (datos ? picos(datos.movimientos, hoy).filter((p) => p.d >= rango.desde && p.d <= rango.hasta) : []), [datos, hoy, rango.desde, rango.hasta])

  return (
    <div className="nv-panel fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-1.5 sm:p-2" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="dinero-titulo" data-seccion="dinero" data-pantalla-completa className="relative flex h-full max-h-full w-full flex-col overflow-hidden rounded-xl border border-white/10 bg-[#161412] text-zinc-200 shadow-2xl">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/10 px-4 py-2.5 sm:px-6">
          <h2 id="dinero-titulo" className="font-display text-[18px] font-normal uppercase tracking-[0.24em]" style={{ color: AMBAR }}>Dinero</h2>
          <div role="group" aria-label="Período" data-selector-unico className="flex gap-1.5">
            {PERIODOS.map((p) => <button key={p.k} type="button" data-periodo={p.k} aria-pressed={periodo === p.k} onClick={() => setPeriodo(p.k)} className={`rounded-full border px-2.5 py-1 text-[12px] ${periodo === p.k ? "border-amber-500/60 bg-amber-500/10 text-zinc-100" : "border-white/10 text-zinc-400 hover:text-zinc-200"}`}>{p.t}</button>)}
          </div>
          <p data-comparado-con className="text-[12px] text-zinc-500">comparado con {anterior.nombre}</p>
          <button type="button" onClick={() => void leer()} disabled={cargando} className="ml-auto rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50">{cargando ? "Leyendo…" : "Actualizar"}</button>
          <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar el dinero" className="rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">Cerrar · Esc</button>
        </header>
        {error && <p role="alert" className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-[13px] text-rose-200 sm:px-6">{error}</p>}
        {cargando && !datos && <p className="px-6 py-6 text-[13px] text-zinc-500">Leyendo…</p>}
        {datos && s && (
          <div ref={cuerpo} className="min-h-0 flex-1 overflow-y-auto">
            <nav aria-label="Secciones" data-indice className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-white/[0.08] bg-[#161412]/95 px-4 py-2 backdrop-blur [scrollbar-width:none] sm:px-6">
              {INDICE.map((x) => <button key={x.id} type="button" data-ir-a={x.id} aria-current={activa === x.id ? "true" : undefined} onClick={() => irA(x.id)} className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[12.5px] ${activa === x.id ? "bg-white/[0.07] text-zinc-100 shadow-[inset_0_-2px_0_#e8731a]" : "text-zinc-400 hover:text-zinc-200"}`}>{x.t}</button>)}
            </nav>
            <div className="space-y-4 p-4 sm:p-6">
              <Ancla id="resumen">
                <div className="space-y-4">
                  <Resumen datos={datos} hoy={hoy} rango={rango} anterior={anterior} />
                  <LoQueCambio datos={datos} hoy={hoy} rango={rango} anterior={anterior} alAbrirCorrida={alAbrirCorrida} />
                </div>
              </Ancla>
              <Ancla id="tiempo">
                <Seccion titulo="Gasto en el tiempo" dato="tiempo" ayuda="Barras apiladas por día (por hora si eliges Hoy). La línea punteada es tu día normal. Toca un nombre de la leyenda para ocultarlo o mostrarlo. Clic en un pico abre su corrida en Observabilidad." extra={
                  <div role="group" aria-label="Ver por" className="ml-auto flex gap-1.5">
                    {(Object.keys(NOMBRE_DE_DIMENSION) as Dimension[]).map((d) => <button key={d} type="button" data-dimension={d} aria-pressed={dim === d} onClick={() => setDim(d)} className={`rounded-full border px-2.5 py-1 text-[12px] ${dim === d ? "border-amber-500/60 bg-amber-500/10 text-zinc-100" : "border-white/10 text-zinc-400 hover:text-zinc-200"}`}>{NOMBRE_DE_DIMENSION[d]}</button>)}
                  </div>}>
                  <Grafico key={dim} s={s} picosDelRango={picosDelRango} porHora={rango.porHora} alAbrirCorrida={alAbrirCorrida} />
                  {(dim === "empleado" || dim === "modelo") && <p data-sin-apify className="mt-2 text-[12px] text-zinc-400">Sin Apify: es un proveedor y su gasto se ve en Proveedor.</p>}
                </Seccion>
              </Ancla>
              <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
                <Ancla id="desglose"><Desglose datos={datos} rango={rango} anterior={anterior} hoy={hoy} alAbrirCorrida={alAbrirCorrida} alVerCliente={setCliente} /></Ancla>
                <Ancla id="proveedores"><Proveedores datos={datos} rango={rango} /></Ancla>
              </div>
              <Ancla id="resultados"><CostoPorResultado datos={datos} rango={rango} /></Ancla>
              <div className="grid gap-4 xl:grid-cols-2">
                <Ancla id="anomalias"><Anomalias datos={datos} rango={rango} hoy={hoy} alAbrirCorrida={alAbrirCorrida} /></Ancla>
                <Ancla id="ahorro"><Ahorro datos={datos} rango={rango} /></Ancla>
              </div>
              {datos.faltan.length > 0 && <p data-faltan className="text-[12px] text-zinc-500"><span className="text-zinc-400">Sin dato todavía:</span> {datos.faltan.join(" · ")}</p>}
            </div>
          </div>
        )}
      </section>
      {cliente && datos && <PanelCliente slug={cliente} datosIniciales={datos} alVolver={() => setCliente(null)} alCerrar={onCerrar} />}
    </div>
  )
}
