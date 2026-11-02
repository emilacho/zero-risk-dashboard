"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Ayuda } from "@/components/nuevo/DineroAyuda"
import { BotonVolver } from "@/components/nuevo/BotonVolver"
import { ROTULO_TARJETA, SUBCATEGORIA, TITULO_SECCION } from "@/components/nuevo/estilos-titulos"
import { pasoRedondo } from "@/components/nuevo/PanelDinero"
import { vistaDelCliente, type VistaDelCliente } from "@/lib/cliente-financiero"
import { anteriorDe, diaLocal, fechaCorta, PERIODOS, rangoDe, usdCorto, type Dinero, type Periodo } from "@/lib/dinero-completo"

/**
 * VISTA FINANCIERA DEL CLIENTE · a un clic desde Dinero («Ver cliente ↗») y desde el selector «Seleccionar cliente» de arriba (6.42).
 * 6.46 · v2 «solo dinero» (boceto aprobado por Emilio 2-nov): estructura de Harvest (los 4 números y el mes a mes) + Productive (pronóstico, costos compartidos)
 * + CloudZero (costo por entrega en el tiempo). Solo el estilo es nuestro. Mismas reglas y mismo período que Dinero. Datos: `/api/direccion/dinero` (SOLO LECTURA).
 */
const AMBAR = "#e8731a"
type Respuesta = ({ ok: true } & Dinero) | { ok: false; error: string }

/** la mini tendencia de cada tarjeta (como Pulse): línea fina; la proyección termina punteada */
export function MiniTendencia({ xs, proyectada = false, color = AMBAR }: { xs: number[]; proyectada?: boolean; color?: string }) {
  if (xs.length < 2) return <div className="h-[34px]" aria-hidden />
  const max = Math.max(...xs, 0.0001), min = Math.min(...xs, 0), W = 200, H = 34
  const pt = (v: number, i: number) => `${((i / (xs.length - 1)) * W).toFixed(1)},${(H - 3 - ((v - min) / (max - min || 1)) * (H - 6)).toFixed(1)}`
  const real = proyectada ? xs.slice(0, -1) : xs
  return (
    <svg data-mini-tendencia viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="my-0.5 block h-[34px] w-full" aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" points={real.map(pt).join(" ")} />
      {proyectada && <polyline fill="none" stroke={color} strokeWidth={2} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" points={[pt(xs[xs.length - 2], xs.length - 2), pt(xs[xs.length - 1], xs.length - 1)].join(" ")} />}
    </svg>
  )
}

const CAJA = "rounded-xl border border-white/[0.09] bg-[#1b1815] p-4 sm:p-5"
const COLOR_DEL_TIPO: Record<string, string> = { "Piezas y video": "#e8731a", Planeación: "#4fa3ff", Cerebro: "#7fc99a", Alta: "#c58cff", Manual: "#ffd166", Otros: "#8a8580" }
const SinDato = ({ chico = false }: { chico?: boolean }) => <span data-sin-dato-todavia className={`italic font-light text-zinc-400 ${chico ? "text-[14px]" : "text-[22px]"}`}>sin dato todavía</span>
const Fila = ({ t, children, dato }: { t: React.ReactNode; children: React.ReactNode; dato?: string }) => (
  <div data-fila-cliente={dato} className="flex items-baseline justify-between gap-3 border-b border-white/[0.05] py-2 text-[14px] last:border-b-0"><span className="text-zinc-100">{t}</span><span className="text-right [font-variant-numeric:tabular-nums] text-zinc-200">{children}</span></div>
)

/* 2 · los 4 números juntos (Harvest) */
function CuatroNumeros({ v }: { v: VistaDelCliente }) {
  const n = v.numeros, sube = (n.variacion_pct ?? 0) > 0
  const Celda = ({ dato, t, children, pie }: { dato: string; t: string; children: React.ReactNode; pie: React.ReactNode }) => (
    <div data-numero={dato} className="flex min-w-0 flex-col gap-1 border-white/[0.09] px-4 py-4 sm:px-5 [&:not(:first-child)]:border-t sm:[&:not(:first-child)]:border-l sm:[&:not(:first-child)]:border-t-0">
      <h4 className={ROTULO_TARJETA}>{t}</h4><div className="leading-tight">{children}</div><div className="text-[12.5px] text-zinc-400">{pie}</div>
    </div>
  )
  return (
    <section data-cuatro-numeros className="grid rounded-xl border border-white/[0.09] bg-[#1b1815] sm:grid-cols-2 xl:grid-cols-4">
      <Celda dato="ingreso" t="Ingreso" pie="lo que se le cobra">{n.ingreso == null ? <SinDato /> : usdCorto(n.ingreso)}</Celda>
      <Celda dato="costo" t="Costo" pie={<><span data-variacion style={{ color: n.variacion_pct == null ? (n.costo > 0 ? "#f5a524" : undefined) : sube ? "#f5a524" : "#7fc99a" }}>{n.variacion_pct == null ? (n.costo > 0 ? `▲ nuevo · antes ${usdCorto(n.costo_anterior)}` : "sin costo en ninguno de los dos períodos") : n.variacion_pct > 500 ? `▲ desde ${usdCorto(n.costo_anterior)}` : `${sube ? "▲" : "▼"} ${Math.abs(n.variacion_pct)} % · antes ${usdCorto(n.costo_anterior)}`}</span><span className="block">{usdCorto(n.costo_con_compartido)} con lo compartido</span></>}>
        <span data-costo className="text-[32px] font-extralight text-white [font-variant-numeric:tabular-nums]">{usdCorto(n.costo)}</span>
      </Celda>
      <Celda dato="ganancia" t="Ganancia" pie="ingreso − costo">{n.ganancia == null ? <SinDato /> : usdCorto(n.ganancia)}</Celda>
      <Celda dato="margen" t="Margen" pie="ganancia ÷ ingreso">{n.margen_pct == null ? <SinDato /> : `${n.margen_pct} %`}</Celda>
    </section>
  )
}

/* 3 · mes a mes (Harvest): barras de costo (y de ingreso cuando exista) con el total al pasar el cursor */
function MesAMes({ meses }: { meses: VistaDelCliente["meses"] }) {
  const [sobre, setSobre] = useState<number | null>(null)
  const tope = Math.max(0.01, ...meses.map((m) => Math.max(m.costo, m.ingreso ?? 0))), pasoEje = pasoRedondo(tope / 4), max = Math.ceil((tope * 1.1) / pasoEje) * pasoEje
  const W = 1300, H = 210, IZQ = 78, ABAJO = 26, ARRIBA = 18, paso = (W - IZQ - 8) / Math.max(1, meses.length), ancho = Math.min(110, paso * 0.4)
  const y = (v: number) => H - ABAJO - (v / max) * (H - ABAJO - ARRIBA)
  const lineas = Array.from({ length: Math.round(max / pasoEje) + 1 }, (_, i) => i * pasoEje)
  return (
    <div className="relative" onMouseLeave={() => setSobre(null)}>
      <svg data-mes-a-mes viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Costo mes a mes">
        {lineas.map((v) => <g key={v}><line x1={IZQ} x2={W - 4} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,.06)" /><text data-eje x={IZQ - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="#8a8580">{usdCorto(v).replace(",00", "")}</text></g>)}
        {meses.map((m, i) => {
          const x = IZQ + i * paso + (paso - ancho) / 2
          return (
            <g key={m.mes} data-mes={m.mes} onMouseEnter={() => setSobre(i)}>
              <rect x={IZQ + i * paso} y={ARRIBA} width={paso} height={H - ABAJO - ARRIBA} fill={sobre === i ? "rgba(255,255,255,.04)" : "transparent"} />
              <rect x={x} y={y(m.costo)} width={ancho} height={Math.max(m.costo > 0 ? 1 : 0, y(0) - y(m.costo))} fill={AMBAR} opacity={m.en_curso ? 0.6 : 1} strokeDasharray={m.en_curso ? "4 3" : undefined} stroke={m.en_curso ? AMBAR : undefined} />
              <text x={x + ancho / 2} y={y(m.costo) - 6} textAnchor="middle" fontSize={12} fill="#f4f4f5">{usdCorto(m.costo)}</text>
              <text x={x + ancho / 2} y={H - 7} textAnchor="middle" fontSize={12} fill="#d4d4d8">{m.rotulo}{m.en_curso ? " (en curso)" : ""}</text>
            </g>
          )
        })}
      </svg>
      {sobre != null && (
        <div data-total-del-mes className="pointer-events-none absolute top-1 z-10 min-w-[220px] rounded-lg border border-white/10 bg-[#0f0d0c]/95 px-3 py-2 text-[13px] shadow-xl" style={{ left: `${Math.min(72, Math.max(4, ((IZQ + sobre * paso) / W) * 100))}%` }}>
          <p className="text-zinc-400">{meses[sobre].rotulo}{meses[sobre].en_curso ? " · en curso" : ""}</p>
          <p className="text-[15px] text-white [font-variant-numeric:tabular-nums]">Costo {usdCorto(meses[sobre].costo)}</p>
          <p className="text-zinc-400">Ingreso {meses[sobre].ingreso == null ? "sin dato todavía" : usdCorto(meses[sobre].ingreso!)}</p>
        </div>
      )}
      <p className="mt-2 flex items-center gap-2 text-[12.5px] text-zinc-400"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: AMBAR }} />Costo · el ingreso y la línea de ganancia aparecen cuando exista lo que se le cobra.</p>
    </div>
  )
}

/* 4 · costo por tipo */
function CostoPorTipo({ v }: { v: VistaDelCliente }) {
  const total = v.numeros.costo
  return (
    <section data-costo-por-tipo className={CAJA}>
      <div className="mb-3 flex flex-wrap items-baseline gap-2"><h3 className={TITULO_SECCION}>Costo por tipo</h3><span className="text-[12.5px] text-zinc-400 [font-variant-numeric:tabular-nums]">{usdCorto(total)}</span></div>
      <div className="mb-3 flex h-2.5 overflow-hidden rounded-full bg-white/[0.06]">{v.por_tipo.filter((t) => t.usd > 0).map((t) => <span key={t.tipo} style={{ width: `${t.pct}%`, background: COLOR_DEL_TIPO[t.tipo] }} />)}</div>
      {v.por_tipo.map((t) => <Fila key={t.tipo} dato={t.tipo} t={<><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-[-1px]" style={{ background: COLOR_DEL_TIPO[t.tipo] }} />{t.tipo}</>}>{usdCorto(t.usd)}<span className="ml-3 inline-block w-14 text-zinc-400">{t.pct.toLocaleString("es-EC")} %</span></Fila>)}
      <div data-rehacer className="-mx-3 mt-2 flex items-baseline justify-between gap-3 rounded-lg bg-black/20 px-3 py-2 text-[14px]">
        <span className="flex items-center gap-1.5 text-zinc-100">De eso, rehacer <Ayuda texto={`Misma regla que Dinero: ${v.rehacer.partes.filter((p) => (p.usd ?? 0) > 0 || p.cuantos > 0).map((p) => `${p.nombre.toLocaleLowerCase("es")} ${p.usd == null ? "sin dato" : usdCorto(p.usd)} (${p.cuantos})`).join(" · ") || "nada en el período"}. Ya está dentro de los tipos de arriba: no se suma otra vez.`} /></span>
        <span className="text-right [font-variant-numeric:tabular-nums] text-zinc-200">{usdCorto(v.rehacer.usd)}<span className="ml-3 inline-block w-14 text-zinc-400">{v.rehacer.pct.toLocaleString("es-EC")} %</span></span>
      </div>
    </section>
  )
}

/* 6 · costo por entrega en el tiempo (CloudZero) */
function Entregas({ v }: { v: VistaDelCliente }) {
  return (
    <section data-entregas className={CAJA}>
      <div className="mb-3 flex flex-wrap items-baseline gap-2"><h3 className={TITULO_SECCION}>Costo por entrega</h3><span className="text-[12.5px] text-zinc-400">¿sube o baja frente a {v.comparado_con}?</span></div>
      <div className="grid gap-3 sm:grid-cols-3">
        {v.entregas.map((e) => (
          <div key={e.clave} data-entrega={e.clave} className="flex min-w-0 flex-col gap-1 rounded-lg border border-white/[0.07] bg-black/20 px-3.5 py-3">
            <h4 className={ROTULO_TARJETA}>{e.nombre}</h4>
            <p className="leading-tight">{e.ahora == null ? <SinDato chico /> : <span className="text-[26px] font-extralight text-white [font-variant-numeric:tabular-nums]">{usdCorto(e.ahora)}</span>}</p>
            <MiniTendencia xs={e.tendencia} />
            <p data-nota-entrega className="text-[12.5px]" style={{ color: e.nota.startsWith("▲") ? "#f5a524" : e.nota.startsWith("▼") ? "#7fc99a" : "#a1a1aa" }}>{e.nota}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* 5 · pronóstico (Productive) */
function Pronostico({ v }: { v: VistaDelCliente }) {
  const p = v.pronostico
  return (
    <section data-pronostico className={CAJA}>
      <h3 className={`mb-2 ${TITULO_SECCION}`}>Pronóstico</h3>
      <Fila dato="cierre" t="Cierre del mes a este ritmo">{usdCorto(p.cierre)}{p.poco_dato && <span className="block text-[12px] text-amber-300/80">poco dato del mes todavía</span>}</Fila>
      <Fila dato="margen-esperado" t="Margen esperado">{p.margen_esperado == null ? <SinDato chico /> : `${p.margen_esperado} %`}</Fila>
      <Fila dato="presupuesto" t="Presupuesto del mes">{p.presupuesto == null ? <SinDato chico /> : usdCorto(p.presupuesto)}</Fila>
      <Fila dato="freno" t="Freno 24 h">{p.freno?.techo_usd == null ? <SinDato chico /> : <>{usdCorto(p.freno.gastado_24h_usd ?? 0)} de {usdCorto(p.freno.techo_usd)} · {(p.freno.pct ?? 0) >= 80 ? "casi lleno" : "holgado"}</>}</Fila>
      {p.avisos.length ? p.avisos.map((a) => <p key={a} data-aviso role="alert" className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-100">{a}</p>)
        : <p className="mt-2 text-[12.5px] text-zinc-400">Sin avisos: el freno está holgado. El aviso de presupuesto llega cuando exista el presupuesto del cliente.</p>}
    </section>
  )
}

/* 7 · costos compartidos repartidos (regla A, aprobada por Emilio) */
function Compartidos({ v }: { v: VistaDelCliente }) {
  const c = v.compartido
  return (
    <section data-compartidos className={CAJA}>
      <h3 className={`mb-2 ${TITULO_SECCION}`}>Costos compartidos</h3>
      <p className="text-[15px] text-zinc-50 [font-variant-numeric:tabular-nums]">Le tocan <b>{usdCorto(c.toca)}</b> de los {usdCorto(c.interno)} de trabajo interno (mantenimiento del cerebro y tareas de la agencia) → costo real <b>{usdCorto(c.real)}</b>.</p>
      <p data-regla className="mt-1 text-[12.5px] text-zinc-400">Regla: {c.regla} A {v.nombre} le toca el {c.cuota_pct.toLocaleString("es-EC")} %.</p>
    </section>
  )
}

/** escribe la pregunta en el chat de abajo (es de CC2: no se toca su código, solo se llena su caja como si la persona la escribiera) */
export function escribirEnElChat(pregunta: string): boolean {
  const caja = document.querySelector<HTMLTextAreaElement>("[data-chat-de-oficinas] textarea"); if (!caja) return false
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(caja, pregunta)
  caja.dispatchEvent(new Event("input", { bubbles: true }))
  caja.focus(); caja.setSelectionRange(pregunta.length, pregunta.length)
  return true
}

function Desplegable({ id, titulo, nota, children }: { id: string; titulo: string; nota: string; children: React.ReactNode }) {
  return (
    <details data-detalle={id} className="group border-t border-white/[0.06] first:border-t-0">
      <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-[14px] text-zinc-200 hover:text-white [&::-webkit-details-marker]:hidden">
        <span><span className="mr-2 inline-block text-zinc-500 transition-transform group-open:rotate-90">▸</span>{titulo}</span><span className="text-[12px] text-zinc-400">{nota}</span>
      </summary>
      <div className="pb-4">{children}</div>
    </details>
  )
}
const TablaCorta = ({ filas, conDia = false }: { filas: VistaDelCliente["detalle"]["por_empleado"]; conDia?: boolean }) => filas.length ? (
  <table className="w-full border-collapse text-[13px]"><tbody>
    {filas.map((f) => <tr key={f.clave} className="border-b border-white/[0.05]"><td className="py-1.5 pr-3 text-zinc-200">{f.nombre}{conDia && f.dia && <span className="block text-[11.5px] text-zinc-500">{fechaCorta(f.dia)} · {f.detalle}</span>}</td><td className="py-1.5 text-right [font-variant-numeric:tabular-nums] text-zinc-100">{usdCorto(f.usd)}</td><td className="w-16 py-1.5 text-right [font-variant-numeric:tabular-nums] text-zinc-500">{f.pct.toLocaleString("es-EC")} %</td></tr>)}
  </tbody></table>
) : <p className="text-[13px] text-zinc-500">Nada en el período.</p>

function GastoPorDia({ xs }: { xs: Array<{ d: string; usd: number }> }) {
  const max = Math.max(...xs.map((x) => x.usd), 0.01), W = 900, H = 140, paso = W / Math.max(1, xs.length), cada = Math.max(1, Math.ceil(xs.length / 10))
  return (
    <svg data-gasto-por-dia viewBox={`0 0 ${W} ${H + 18}`} className="block h-auto w-full" role="img" aria-label="Gasto por día">
      {xs.map((x, i) => { const h = (x.usd / max) * (H - 16); return <g key={x.d}><rect x={i * paso + paso * 0.15} y={H - h} width={paso * 0.7} height={Math.max(x.usd > 0 ? 1 : 0, h)} fill={AMBAR}><title>{`${fechaCorta(x.d)} · ${usdCorto(x.usd)}`}</title></rect>{(i % cada === 0 || i === xs.length - 1) && <text x={i * paso + paso / 2} y={H + 14} textAnchor="middle" fontSize={11} fill="#8a8580">{fechaCorta(x.d)}</text>}</g> })}
    </svg>
  )
}

export function PanelCliente({ slug, datosIniciales = null, fetchImpl = fetch, alCerrar, alVolver }: { slug: string; datosIniciales?: Dinero | null; fetchImpl?: typeof fetch; alCerrar?: () => void; /** 6.44 · abierta encima de Dinero: la flecha y Esc regresan a Dinero */ alVolver?: () => void }) {
  const router = useRouter()
  const [datos, setDatos] = useState<Dinero | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!datosIniciales)
  const [periodo, setPeriodo] = useState<Periodo>("30")
  const [aviso, setAviso] = useState<string | null>(null)
  const cerrarBtn = useRef<HTMLButtonElement>(null)
  const cerrar = useCallback(() => { if (alCerrar) alCerrar(); else router.push("/nuevo/oficina") }, [alCerrar, router])
  // 6.44 · la flecha: encima de Dinero vuelve a Dinero; como página propia vuelve a la pantalla anterior (o a tu oficina si se abrió sola en otra pestaña)
  const volver = useCallback(() => {
    if (alVolver) return alVolver()
    const vengoDeAqui = typeof document !== "undefined" && document.referrer.startsWith(window.location.origin) && window.history.length > 1
    if (vengoDeAqui) router.back(); else router.push("/nuevo/oficina")
  }, [alVolver, router])
  const leer = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      const r = await fetchImpl("/api/direccion/dinero", { cache: "no-store" })
      const j = (await r.json().catch(() => null)) as Respuesta | null
      if (!r.ok || !j || !j.ok) throw new Error(r.status === 401 || r.status === 403 ? "Necesitas una sesión de administrador para ver al cliente." : (j && !j.ok && j.error) || `No pude leer los datos (${r.status}).`)
      setDatos(j)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setCargando(false) }
  }, [fetchImpl])
  useEffect(() => { if (!datosIniciales) void leer() }, [leer, datosIniciales])
  useEffect(() => { cerrarBtn.current?.focus() }, [])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key !== "Escape") return; e.stopPropagation(); e.preventDefault(); if (alVolver) alVolver(); else cerrar() }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [cerrar, alVolver])

  const hoy = useMemo(() => diaLocal(datos?.leido_en ?? new Date().toISOString()), [datos])
  const v = useMemo(() => (datos ? vistaDelCliente(datos, slug, periodo, hoy) : null), [datos, slug, periodo, hoy])
  const comparado = anteriorDe(periodo, rangoDe(periodo, hoy)).nombre
  const preguntar = (q: string) => { const ok = escribirEnElChat(q); setAviso(ok ? "La pregunta quedó escrita en el chat de abajo." : "No encontré el chat de abajo.") }

  return (
    <div className="nv-panel fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-1.5 sm:p-2" onMouseDown={(e) => { if (e.target === e.currentTarget) { if (alVolver) alVolver(); else cerrar() } }}>
      <section role="dialog" aria-modal="true" aria-labelledby="cliente-titulo" data-seccion="cliente" data-cliente={slug} className="relative flex h-full max-h-full w-full flex-col overflow-hidden rounded-xl border border-white/10 bg-[#161412] text-zinc-200 shadow-2xl">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/10 px-4 py-2.5 sm:px-6">
          <BotonVolver alVolver={volver} a={alVolver ? "Dinero" : "la pantalla anterior"} />
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-zinc-400">Cliente</p>
          <h2 id="cliente-titulo" className="text-[22px] font-normal tracking-wide text-white">{v?.nombre ?? (cargando ? "…" : slug)}</h2>
          <div role="group" aria-label="Período" data-selector-unico className="flex gap-1.5">
            {PERIODOS.map((p) => <button key={p.k} type="button" data-periodo={p.k} aria-pressed={periodo === p.k} onClick={() => setPeriodo(p.k)} className={`rounded-full border px-2.5 py-1 text-[12px] ${periodo === p.k ? "border-amber-500/60 bg-amber-500/10 text-zinc-100" : "border-white/10 text-zinc-400 hover:text-zinc-200"}`}>{p.t}</button>)}
          </div>
          <p data-comparado-con className="text-[12px] text-zinc-500">comparado con {comparado}</p>
          <a href={`/nuevo/cliente/${slug}`} target="_blank" rel="noopener" data-otra-pestana className="ml-auto rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06]">Abrir en otra pestaña ↗</a>
          <button type="button" onClick={() => void leer()} disabled={cargando} className="rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50">{cargando ? "Leyendo…" : "Actualizar"}</button>
          <button ref={cerrarBtn} type="button" onClick={cerrar} aria-label="Cerrar la vista del cliente" className="rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">Cerrar · Esc</button>
        </header>
        {error && <p role="alert" className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-[13px] text-rose-200 sm:px-6">{error}</p>}
        {cargando && !datos && <p className="px-6 py-6 text-[13px] text-zinc-500">Leyendo…</p>}
        {datos && !v && <p data-cliente-sin-datos className="px-6 py-6 text-[14px] text-zinc-400">No encontré gasto ni freno para este cliente en los últimos 62 días.</p>}
        {v && (
          <div className="grid flex-1 content-start gap-4 overflow-y-auto px-4 py-5 [scrollbar-width:thin] sm:px-6">
            {/* 1 · lo que tienes que saber */}
            <section data-saber className="rounded-xl border border-white/[0.09] bg-[#1b1815] p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-2"><h3 className={TITULO_SECCION}>Lo que tienes que saber</h3><Ayuda texto="Lo escribe el sistema con los datos, sin costo. Más adelante lo escribe la oficina financiera." /></div>
              <div className="grid gap-4 md:grid-cols-3">
                {([["que_paso", "Qué pasó"], ["por_que", "Por qué"], ["que_conviene", "Qué conviene"]] as const).map(([k, t]) => (
                  <p key={k} data-saber-linea={k} className="text-[15px] leading-relaxed text-zinc-50"><span className={`mb-1 block ${SUBCATEGORIA}`}>{t}</span>{v.saber[k]}</p>
                ))}
              </div>
            </section>
            {/* 2 · los 4 números (Harvest) */}
            <CuatroNumeros v={v} />
            {/* 3 · mes a mes (Harvest) */}
            <section data-seccion-mes-a-mes className={CAJA}>
              <div className="mb-2 flex flex-wrap items-baseline gap-2"><h3 className={TITULO_SECCION}>Mes a mes</h3><span className="text-[12.5px] text-zinc-400">el total aparece al pasar el cursor</span></div>
              <MesAMes meses={v.meses} />
            </section>
            {/* 4 · dos desgloses */}
            <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
              <section data-ingreso className={CAJA}>
                <h3 className={`mb-2 ${TITULO_SECCION}`}>Ingreso</h3>
                <Fila dato="cobrado" t="Cobrado"><SinDato chico /></Fila>
                <Fila dato="por-cobrar" t="Por cobrar"><SinDato chico /></Fila>
              </section>
              <CostoPorTipo v={v} />
            </div>
            {/* 5 · pronóstico · 6 · costo por entrega */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Pronostico v={v} />
              <Entregas v={v} />
            </div>
            {/* 7 · costos compartidos */}
            <Compartidos v={v} />
            <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr] lg:items-start">
              {/* 4 · preguntas sugeridas */}
              <section data-preguntas className="rounded-xl border border-white/[0.09] bg-[#1b1815] p-4 sm:p-5">
                <h3 className={`mb-3 ${TITULO_SECCION}`}>Preguntas sugeridas</h3>
                <div className="flex flex-wrap gap-2">
                  {v.preguntas.map((q) => <button key={q} type="button" data-pregunta={q} onClick={() => preguntar(q)} className="rounded-full border border-white/[0.14] px-3.5 py-1.5 text-left text-[13px] text-zinc-200 hover:border-amber-500/50 hover:bg-amber-500/[0.06]">💬 {q}</button>)}
                </div>
                <p data-aviso-chat aria-live="polite" className="mt-3 text-[12px] text-zinc-500">{aviso ?? "Al tocar una, se escribe en el chat de abajo; la envías tú."}</p>
              </section>
              {/* 5 · detalle solo al desplegar */}
              <section data-detalles className="rounded-xl border border-white/[0.09] bg-[#1b1815] px-4 pt-3 sm:px-5">
                <h3 className={`mb-1 ${TITULO_SECCION}`}>Detalle</h3>
                <Desplegable id="corridas" titulo="Corridas" nota="las más caras"><TablaCorta filas={v.detalle.corridas} conDia /></Desplegable>
                <Desplegable id="empleado" titulo="Por empleado" nota="quién gastó qué"><TablaCorta filas={v.detalle.por_empleado} /></Desplegable>
                <Desplegable id="tiempo" titulo="Por día" nota="costo diario"><GastoPorDia xs={v.detalle.por_dia} /></Desplegable>
              </section>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
