"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Ayuda } from "@/components/nuevo/DineroAyuda"
import { ROTULO_TARJETA, SUBCATEGORIA, TITULO_SECCION } from "@/components/nuevo/estilos-titulos"
import { vistaDelCliente, type Tarjeta, type VistaDelCliente } from "@/lib/cliente-financiero"
import { anteriorDe, diaLocal, fechaCorta, PERIODOS, rangoDe, usdCorto, type Dinero, type Periodo } from "@/lib/dinero-completo"

/**
 * VISTA FINANCIERA DEL CLIENTE (6.42 · boceto aprobado por Emilio 2-nov con 3 cambios): a un clic desde Dinero («Ver cliente ↗») y desde el selector
 * «Seleccionar cliente» de arriba. Estructura de Tableau Pulse (resumen en palabras, tarjetas con número + mini tendencia + variación + una línea,
 * preguntas sugeridas) + Ramp (qué pasó · por qué · qué conviene). Solo el estilo es nuestro. Detalle solo al desplegar. Datos: `/api/direccion/dinero` (SOLO LECTURA).
 */
const AMBAR = "#e8731a"
type Respuesta = ({ ok: true } & Dinero) | { ok: false; error: string }
const SIN_DATO = <span data-sin-dato-todavia className="italic font-light text-zinc-500">sin dato todavía</span>

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

function TarjetaPulse({ t }: { t: Tarjeta }) {
  const tono = t.variacion?.tono === "sube" ? "#f5a524" : t.variacion?.tono === "baja" ? "#7fc99a" : undefined
  return (
    <div data-tarjeta-cliente={t.clave} className="flex min-h-[168px] min-w-0 flex-col gap-1 rounded-xl border border-white/[0.09] bg-[#1b1815] px-4 py-3.5">
      <h4 className={ROTULO_TARJETA}>{t.rotulo}</h4>
      <p data-valor className={`leading-tight [font-variant-numeric:tabular-nums] ${t.valor == null ? "text-[22px]" : "text-[30px] font-extralight text-white"}`}>
        {t.valor ?? SIN_DATO}{t.valor != null && t.extra && <span className="ml-1.5 text-[15px] text-zinc-400">{t.extra}</span>}
      </p>
      {t.barra != null ? (
        <div className="my-3 h-2 overflow-hidden rounded-full bg-white/[0.08]" aria-hidden><div className="h-full rounded-full" style={{ width: `${t.barra}%`, background: t.barra >= 80 ? "#f5a524" : "#7fc99a" }} /></div>
      ) : t.valor != null ? <MiniTendencia xs={t.tendencia} proyectada={t.proyectada} color={t.clave === "rehacer" ? "#a1a1aa" : AMBAR} /> : null}
      {t.valor != null && t.variacion && <p data-variacion-cliente className="text-[13px] [font-variant-numeric:tabular-nums]" style={{ color: tono ?? "#a1a1aa" }}>{t.variacion.texto}</p>}
      <p data-lectura className="mt-auto text-[13px] text-zinc-200">{t.lectura}</p>
    </div>
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
    {filas.map((f) => <tr key={f.clave} className="border-b border-white/[0.05]"><td className="py-1.5 pr-3 text-zinc-200">{f.nombre}{conDia && f.dia && <span className="block text-[11.5px] text-zinc-500">{fechaCorta(f.dia)} · {f.detalle}</span>}</td><td className="py-1.5 text-right tabular-nums text-zinc-100">{usdCorto(f.usd)}</td><td className="w-16 py-1.5 text-right tabular-nums text-zinc-500">{f.pct.toLocaleString("es-EC")} %</td></tr>)}
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

export function PanelCliente({ slug, datosIniciales = null, fetchImpl = fetch, alCerrar }: { slug: string; datosIniciales?: Dinero | null; fetchImpl?: typeof fetch; alCerrar?: () => void }) {
  const router = useRouter()
  const [datos, setDatos] = useState<Dinero | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!datosIniciales)
  const [periodo, setPeriodo] = useState<Periodo>("30")
  const [aviso, setAviso] = useState<string | null>(null)
  const cerrarBtn = useRef<HTMLButtonElement>(null)
  const cerrar = useCallback(() => { if (alCerrar) alCerrar(); else router.push("/nuevo/oficina") }, [alCerrar, router])
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
    const tecla = (e: KeyboardEvent) => { if (e.key !== "Escape") return; e.stopPropagation(); e.preventDefault(); cerrar() }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [cerrar])

  const hoy = useMemo(() => diaLocal(datos?.leido_en ?? new Date().toISOString()), [datos])
  const v = useMemo(() => (datos ? vistaDelCliente(datos, slug, periodo, hoy) : null), [datos, slug, periodo, hoy])
  const comparado = anteriorDe(periodo, rangoDe(periodo, hoy)).nombre
  const preguntar = (q: string) => { const ok = escribirEnElChat(q); setAviso(ok ? "La pregunta quedó escrita en el chat de abajo." : "No encontré el chat de abajo.") }

  return (
    <div className="nv-panel fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-1.5 sm:p-2" onMouseDown={(e) => { if (e.target === e.currentTarget) cerrar() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="cliente-titulo" data-seccion="cliente" data-cliente={slug} className="relative flex h-full max-h-full w-full flex-col overflow-hidden rounded-xl border border-white/10 bg-[#161412] text-zinc-200 shadow-2xl">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/10 px-4 py-2.5 sm:px-6">
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
            {/* 2 · tarjetas tipo Pulse */}
            <h3 data-titulo-grupo className={`-mb-1 px-0.5 pt-1 ${TITULO_SECCION}`}>Lo que gasta la agencia en este cliente</h3>
            <section data-tarjetas-cliente className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {v.tarjetas.map((t) => <TarjetaPulse key={t.clave} t={t} />)}
            </section>
            {/* 3 · el negocio del cliente: una sola línea mientras no haya dato (cambio 2 de Emilio) */}
            <p data-negocio className="rounded-xl border border-white/[0.09] bg-[#1b1815] px-4 py-3 text-[14px] text-zinc-300">Cómo le va al negocio: {SIN_DATO}<span className="ml-2 text-[12px] text-zinc-500">(ventas del punto de venta, pedidos de la web y anuncios)</span></p>
            <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
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
                <Desplegable id="tiempo" titulo="Gasto en el tiempo" nota="por día"><GastoPorDia xs={v.detalle.por_dia} /></Desplegable>
                <Desplegable id="empleado" titulo="Por empleado" nota="quién gastó qué"><TablaCorta filas={v.detalle.por_empleado} /></Desplegable>
                <Desplegable id="corridas" titulo="Corridas" nota="las más caras"><TablaCorta filas={v.detalle.corridas} conDia /></Desplegable>
                <Desplegable id="anomalias" titulo="Anomalías" nota="3× lo normal">
                  {v.detalle.anomalias.length ? <ul className="grid gap-1.5 text-[13px]">{v.detalle.anomalias.map((a) => <li key={a.d + a.texto} className="text-zinc-300"><span className="text-zinc-500">{fechaCorta(a.d)} · {usdCorto(a.usd)} · </span>{a.texto}</li>)}</ul> : <p className="text-[13px] text-zinc-500">Nada fuera de lo normal en el período.</p>}
                </Desplegable>
              </section>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
