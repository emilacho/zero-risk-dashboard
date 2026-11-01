"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { haceCuanto } from "@/lib/direccion-decisiones"
import {
  ANILLOS, GRADOS_POR_SECTOR, NOMBRE_DE_LA_GRAVEDAD, NOMBRE_DEL_SECTOR, ORIGEN_DEL_RIESGO, SECTORES, SECTORES_SIN_FUENTE, alPlano, lugarEnElRadar,
  type Gravedad, type Riesgo, type Riesgos, type Sector,
} from "@/lib/direccion-riesgos"

/**
 * TU OFICINA · RIESGOS Y ALARMAS (6.21 · capa 2 del encargo «oficina del humano» · 6.22 correcciones de Emilio): un RADAR de 8 sectores fijos (dinero ·
 * accesos · servicios · flujos · datos · calidad · plazos · seguridad). Cada riesgo es un punto en su sector; cuanto más grave, más cerca del centro. El haz
 * barre con su estela y cada punto se enciende cuando pasa. Debajo del radar, los 8 sectores como tarjetas (tocar una filtra). A la derecha, la ficha del
 * riesgo elegido y la lista; abajo, las pausas que decidiste (fuera del radar) y lo que el sistema aún no puede saber («sin dato»).
 * Datos: `/api/direccion/riesgos` (servidor del tablero → ruta certificada de la plataforma). SOLO LECTURA. Si la lista está incompleta, nunca dice «sin
 * riesgos». Los saldos y el freno de gasto ya no van aquí: son de la pantalla Dinero.
 */
const AMBAR = "#e8731a"
export const COLOR_DE_LA_GRAVEDAD: Record<Gravedad, string> = { 3: "#ff5a36", 2: "#f5a524", 1: "#e9d6b6" }
const VUELTA = 8 // segundos por vuelta del haz
const ESTELA = 14 // gajos de la estela del haz
type Respuesta = ({ ok: true } & Riesgos) | { ok: false; error: string }

const ESTILO = `
.ri-punto{cursor:pointer}
.ri-punto[data-anima="detecta"]{animation:riDetecta ${VUELTA}s ease-out infinite}
@keyframes riDetecta{0%{opacity:1}35%,100%{opacity:.5}}
.ri-eco{animation:riEco ${VUELTA}s ease-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes riEco{0%{transform:scale(1);opacity:.75}30%,100%{transform:scale(3.4);opacity:0}}
.ri-fila{transition:background .15s ease,border-color .15s ease}
.ri-fila[aria-current="true"]{background:rgba(232,115,26,.1);border-color:rgba(232,115,26,.5)}
.ri-sector{transition:background .15s ease,border-color .15s ease}
.ri-sector[aria-pressed="true"]{background:rgba(232,115,26,.12);border-color:rgba(232,115,26,.6)}
.ri-ficha{animation:riFicha .4s cubic-bezier(.2,.8,.2,1) both}
@keyframes riFicha{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.ri-punto[data-anima="detecta"],.ri-eco,.ri-ficha{animation:none}}
`

const fecha = (iso: string | null) => { if (!iso) return null; const t = new Date(iso); return Number.isNaN(t.getTime()) ? null : t.toLocaleString("es-EC", { timeZone: "America/Guayaquil", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) }
const peor = (lista: Riesgo[]): Gravedad | null => (lista.length ? (Math.max(...lista.map((r) => r.gravedad)) as Gravedad) : null)
const punto = (C: number, r: number, a: number) => alPlano(C, C, r, a, 1).map((v) => v.toFixed(2)).join(" ")
const arco = (C: number, r: number, a0: number, a1: number) => `M${punto(C, r, a0)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${punto(C, r, a1)}`
const gajo = (C: number, r: number, a0: number, a1: number) => `M${C} ${C} L${punto(C, r, a0)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${punto(C, r, a1)} Z`

/** el radar: bisel con graduación, anillos de gravedad, 8 sectores con su arco de estado, el haz con estela y un punto por riesgo */
function Radar({ riesgos, todos, elegido, alElegir, sector, quieto }: { riesgos: Riesgo[]; todos: Riesgo[]; elegido: string | null; alElegir: (id: string) => void; sector: Sector | null; quieto: boolean }) {
  const C = 200, R = 150, lugar = useMemo(() => lugarEnElRadar(riesgos), [riesgos])
  return (
    <svg viewBox="-16 -8 432 416" className="h-full w-full" role="img" aria-label={`Radar de riesgos: ${riesgos.length} puntos en 8 sectores`}>
      <defs>
        <radialGradient id="ri-fondo" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="rgba(232,115,26,.2)" /><stop offset="55%" stopColor="rgba(232,115,26,.06)" /><stop offset="100%" stopColor="rgba(232,115,26,0)" /></radialGradient>
        <radialGradient id="ri-vidrio" cx="50%" cy="38%" r="62%"><stop offset="0%" stopColor="rgba(255,236,210,.07)" /><stop offset="100%" stopColor="rgba(255,236,210,0)" /></radialGradient>
        <filter id="ri-brillo" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      {/* el bisel: dos aros finos y la graduación (cada 3°, más larga cada 15°) */}
      <circle cx={C} cy={C} r={R + 18} fill="none" stroke="rgba(255,226,190,.07)" strokeWidth={1} />
      <circle cx={C} cy={C} r={R + 9} fill="none" stroke="rgba(255,226,190,.14)" strokeWidth={0.8} />
      {Array.from({ length: 120 }, (_, i) => { const a = i * 3, largo = a % 15 === 0 ? 6 : 2.6, [x0, y0] = alPlano(C, C, R + 9, a, 1), [x1, y1] = alPlano(C, C, R + 9 + largo, a, 1); return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke="rgba(255,226,190,.26)" strokeWidth={a % 15 === 0 ? 0.9 : 0.5} /> })}
      <circle cx={C} cy={C} r={R} fill="url(#ri-fondo)" />
      <circle cx={C} cy={C} r={R} fill="url(#ri-vidrio)" stroke="rgba(255,226,190,.28)" strokeWidth={0.9} />
      {/* el sector elegido, apenas iluminado */}
      {sector && <path d={gajo(C, R, SECTORES.indexOf(sector) * GRADOS_POR_SECTOR, (SECTORES.indexOf(sector) + 1) * GRADOS_POR_SECTOR)} fill="rgba(232,115,26,.09)" />}
      {/* los anillos: el límite de cada gravedad */}
      {([3, 2] as Gravedad[]).map((g) => <circle key={g} cx={C} cy={C} r={R * (ANILLOS[g][1] + 0.03)} fill="none" stroke="rgba(255,226,190,.16)" strokeWidth={0.7} strokeDasharray="1.5 3.5" />)}
      {([3, 2, 1] as Gravedad[]).map((g) => <text key={`t${g}`} x={C + 3} y={C - R * (ANILLOS[g][1] + 0.03) + 9} fontSize={7.5} fontWeight={600} letterSpacing=".12em" fill="rgba(255,236,215,.7)" stroke="#161412" strokeWidth={3} paintOrder="stroke">{NOMBRE_DE_LA_GRAVEDAD[g].nombre.toUpperCase()}</text>)}
      {/* los 8 sectores: frontera fina, arco de estado en el borde (color de su riesgo más grave) y su nombre con la cuenta */}
      {SECTORES.map((s, i) => {
        const a0 = i * GRADOS_POR_SECTOR, a1 = a0 + GRADOS_POR_SECTOR, [x, y] = alPlano(C, C, R, a0, 1), del = todos.filter((r) => r.sector === s), g = peor(del)
        const [tx, ty] = alPlano(C, C, R + 36, a0 + GRADOS_POR_SECTOR / 2, 1), sinFuente = SECTORES_SIN_FUENTE.includes(s) && !del.length, ancho = Math.max(NOMBRE_DEL_SECTOR[s].corto.length * 7.2 + 16, 52)
        return (
          <g key={s} data-sector={s}>
            <line x1={C} y1={C} x2={x} y2={y} stroke="rgba(255,226,190,.1)" strokeWidth={0.7} />
            <path d={arco(C, R + 3.5, a0 + 2.5, a1 - 2.5)} fill="none" stroke={g ? COLOR_DE_LA_GRAVEDAD[g] : "rgba(255,226,190,.16)"} strokeWidth={g ? 2.6 : 1.4} strokeLinecap="round" strokeDasharray={sinFuente ? "1 3" : undefined} />
            {/* el nombre va en su propia placa (fondo oscuro y borde), para que no se confunda con las líneas del radar */}
            <g data-placa={s}>
              <rect x={tx - ancho / 2} y={ty - 14} width={ancho} height={29} rx={7} fill="#1d1813" stroke={g ? `${COLOR_DE_LA_GRAVEDAD[g]}88` : "rgba(255,226,190,.22)"} strokeWidth={0.8} />
              <text x={tx} y={ty - 2} fontSize={9} fontWeight={600} letterSpacing=".12em" textAnchor="middle" fill={del.length ? "#fff3e4" : "rgba(255,236,215,.72)"}>{NOMBRE_DEL_SECTOR[s].corto.toUpperCase()}</text>
              <text x={tx} y={ty + 10} fontSize={10} fontWeight={700} textAnchor="middle" fill={g ? COLOR_DE_LA_GRAVEDAD[g] : "rgba(255,236,215,.5)"} style={{ fontVariantNumeric: "tabular-nums" }}>{sinFuente ? "sin dato" : del.length}</text>
            </g>
          </g>
        )
      })}
      {/* el haz con su estela (arranca arriba, sentido del reloj) */}
      <g>
        {Array.from({ length: ESTELA }, (_, k) => <path key={k} d={gajo(C, R, 360 - (k + 1) * 3, 360 - k * 3)} fill={`rgba(255,170,90,${(0.2 * (1 - k / ESTELA) ** 1.6).toFixed(3)})`} />)}
        <line x1={C} y1={C} x2={C} y2={C - R} stroke="rgba(255,200,140,.85)" strokeWidth={1} />
        {!quieto && <animateTransform attributeName="transform" type="rotate" from={`0 ${C} ${C}`} to={`360 ${C} ${C}`} dur={`${VUELTA}s`} repeatCount="indefinite" />}
      </g>
      {/* la mira del centro */}
      <circle cx={C} cy={C} r={5} fill="none" stroke="rgba(255,226,190,.35)" strokeWidth={0.7} />
      <circle cx={C} cy={C} r={1.8} fill="rgba(255,226,190,.9)" filter="url(#ri-brillo)" />
      {/* los puntos: cada uno se enciende cuando el haz pasa por su ángulo */}
      {riesgos.map((x) => {
        const l = lugar.get(x.id)!, [px, py] = alPlano(C, C, R, l.angulo, l.radio), r = x.gravedad === 3 ? 4.6 : x.gravedad === 2 ? 3.6 : 3
        const tarde: CSSProperties = { animationDelay: `${((l.angulo / 360) * VUELTA).toFixed(2)}s` }
        return (
          <g key={x.id}>
            {x.gravedad === 3 && <circle className="ri-eco" cx={px} cy={py} r={r} fill="none" stroke={COLOR_DE_LA_GRAVEDAD[3]} strokeWidth={1} style={tarde} />}
            {elegido === x.id && <circle cx={px} cy={py} r={r + 5} fill="none" stroke="rgba(255,255,255,.9)" strokeWidth={0.9} />}
            <circle className="ri-punto" data-riesgo={x.id} data-gravedad={x.gravedad} data-anima="detecta" style={tarde} cx={px} cy={py} r={r} fill={COLOR_DE_LA_GRAVEDAD[x.gravedad]} filter="url(#ri-brillo)"
              onClick={() => alElegir(x.id)}><title>{x.titulo}</title></circle>
          </g>
        )
      })}
    </svg>
  )
}

export function PanelRiesgos({ onCerrar, datosIniciales = null, fetchImpl = fetch }: { onCerrar: () => void; datosIniciales?: Riesgos | null; fetchImpl?: typeof fetch }) {
  const [datos, setDatos] = useState<Riesgos | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!datosIniciales)
  const [elegido, setElegido] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Gravedad | null>(null)
  const [sector, setSector] = useState<Sector | null>(null)
  const [quieto, setQuieto] = useState(false)
  const cerrar = useRef<HTMLButtonElement>(null)

  const leer = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      const r = await fetchImpl("/api/direccion/riesgos", { cache: "no-store" })
      const j = (await r.json().catch(() => null)) as Respuesta | null
      if (!r.ok || !j || !j.ok) throw new Error(r.status === 401 || r.status === 403 ? "Necesitas una sesión de administrador para ver los riesgos." : (j && !j.ok && j.error) || `No pude leer los riesgos (${r.status}).`)
      setDatos(j)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setCargando(false) }
  }, [fetchImpl])
  useEffect(() => { if (!datosIniciales) void leer() }, [leer, datosIniciales])
  useEffect(() => { cerrar.current?.focus(); setQuieto(window.matchMedia("(prefers-reduced-motion: reduce)").matches) }, [])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key !== "Escape") return; e.stopPropagation(); e.preventDefault(); onCerrar() }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar])

  const todos = datos?.riesgos ?? []
  const visibles = todos.filter((r) => (!filtro || r.gravedad === filtro) && (!sector || r.sector === sector))
  const ficha = visibles.find((r) => r.id === elegido) ?? visibles[0] ?? null
  const total = datos?.total ?? 0
  const graves = datos?.por_gravedad[3] ?? 0
  const resumen = !datos ? "" : total ? `${total} ${total === 1 ? "riesgo" : "riesgos"} · ${graves} ${graves === 1 ? "grave" : "graves"}${datos.completo ? "" : " · la lista puede estar incompleta"}` : datos.completo ? "Sin riesgos abiertos ahora" : "No se pudo leer todo: la lista puede estar incompleta"
  const faltan = (datos?.fuentes ?? []).filter((f) => f.estado === "error" || f.estado === "sin_credencial")
  const avisos = (datos?.fuentes ?? []).filter((f) => f.detalle && f.estado === "ok")
  const vacios = datos ? SECTORES_SIN_FUENTE.filter((s) => !datos.por_sector[s]) : []

  return (
    <div className="nv-panel fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <style>{ESTILO}</style>
      <section role="dialog" aria-modal="true" aria-labelledby="riesgos-titulo" data-seccion="riesgos" className="relative flex h-full max-h-full w-full max-w-[1300px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#161412] text-zinc-200 shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <h2 id="riesgos-titulo" className="font-display text-[15px] font-light uppercase tracking-[0.28em]" style={{ color: AMBAR }}>Riesgos y alarmas</h2>
          <p data-resumen className="text-[12px] text-zinc-400">{cargando && !datos ? "Leyendo…" : resumen}</p>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {([3, 2, 1] as Gravedad[]).map((g) => (
              <button key={g} type="button" data-filtro-gravedad={g} aria-pressed={filtro === g} onClick={() => setFiltro((f) => (f === g ? null : g))}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] transition ${filtro === g ? "border-white/60 bg-white/10 text-white" : "border-white/15 text-zinc-300 hover:bg-white/[0.05]"}`}>
                <span className="h-2 w-2 rounded-full" style={{ background: COLOR_DE_LA_GRAVEDAD[g] }} />{NOMBRE_DE_LA_GRAVEDAD[g].nombre}<span className="[font-variant-numeric:tabular-nums] text-zinc-400">{datos?.por_gravedad[g] ?? 0}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void leer()} disabled={cargando} className="rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50">{cargando ? "Leyendo…" : "Actualizar"}</button>
          <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar los riesgos" className="rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">Cerrar · Esc</button>
        </header>
        {error && <p role="alert" className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-[13px] text-rose-200 sm:px-6">{error}</p>}

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:overflow-hidden">
          {/* izquierda: el radar (más chico, centrado) y los 8 sectores como tarjetas que filtran */}
          <div className="flex min-h-0 min-w-0 flex-col gap-3 border-white/10 p-4 lg:border-r sm:p-5">
            <div data-radar className="relative aspect-square w-full lg:aspect-auto lg:min-h-0 lg:flex-1">
              {datos && <Radar riesgos={visibles} todos={todos} elegido={ficha?.id ?? null} alElegir={setElegido} sector={sector} quieto={quieto} />}
              {datos && !total && <p data-vacio className="absolute inset-x-0 bottom-1 text-center text-[12.5px] text-zinc-400">{datos.completo && !error ? "Sin riesgos abiertos ahora." : "No pude leer todas las fuentes: no puedo asegurarte que no haya riesgos."}</p>}
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
              {SECTORES.map((s) => {
                const del = todos.filter((r) => r.sector === s), g = peor(del), sinFuente = SECTORES_SIN_FUENTE.includes(s) && !del.length
                return (
                  <button key={s} type="button" data-tarjeta-sector={s} aria-pressed={sector === s} onClick={() => { setSector((x) => (x === s ? null : s)); setElegido(null) }} title={NOMBRE_DEL_SECTOR[s].que}
                    className="ri-sector relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-left hover:bg-white/[0.05]">
                    <span className="absolute inset-x-0 top-0 h-[2px]" style={{ background: g ? COLOR_DE_LA_GRAVEDAD[g] : "rgba(255,255,255,.08)" }} />
                    <span className="block min-h-[26px] text-[10px] uppercase leading-[13px] tracking-[0.12em] text-zinc-400">{NOMBRE_DEL_SECTOR[s].nombre}</span>
                    <span className="mt-0.5 block text-[20px] font-extralight [font-variant-numeric:tabular-nums]" style={{ color: g ? COLOR_DE_LA_GRAVEDAD[g] : "rgba(255,255,255,.35)" }}>{sinFuente ? <span className="text-[12px] font-normal text-zinc-500">sin dato</span> : del.length}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* derecha: la ficha del punto elegido, la lista (lo más grave arriba), tus pausas y lo que aún no se sabe */}
          <div className="flex min-h-0 min-w-0 flex-col p-4 sm:p-5">
            {ficha ? (
              <article key={ficha.id} data-ficha={ficha.id} className="ri-ficha shrink-0 rounded-2xl border p-4" style={{ borderColor: `${COLOR_DE_LA_GRAVEDAD[ficha.gravedad]}66`, background: "linear-gradient(160deg,#221912,#151110)" }}>
                <div className="flex items-center gap-2 text-[11.5px]">
                  <span className="rounded-full px-2.5 py-0.5 font-medium text-black" style={{ background: COLOR_DE_LA_GRAVEDAD[ficha.gravedad] }}>{NOMBRE_DE_LA_GRAVEDAD[ficha.gravedad].nombre}</span>
                  <span className="truncate uppercase tracking-[0.16em] text-zinc-400">{NOMBRE_DEL_SECTOR[ficha.sector].nombre}</span>
                  <span className="ml-auto shrink-0 text-zinc-400">{ficha.cliente ?? "Toda la empresa"}</span>
                </div>
                <h3 data-titulo className="mt-2.5 text-[16px] font-light leading-snug text-white">{ficha.titulo}</h3>
                {ficha.detalle && <p data-detalle className="mt-1.5 line-clamp-3 text-[12.5px] text-zinc-400">{ficha.detalle}</p>}
                <dl className="mt-3 grid grid-cols-2 gap-3 text-[12.5px]">
                  <div><dt className="text-zinc-500">Desde</dt><dd className="text-zinc-200">{haceCuanto(ficha.desde)}{fecha(ficha.desde) ? <span className="text-zinc-500"> · {fecha(ficha.desde)}</span> : null}</dd></div>
                  <div><dt className="text-zinc-500">Viene de</dt><dd data-origen className="text-zinc-200">{ORIGEN_DEL_RIESGO[ficha.fuente ?? ""] ?? "Sin dato"}</dd></div>
                </dl>
              </article>
            ) : datos && total > 0 ? <p className="text-[12.5px] text-zinc-500">Nada en este filtro.</p> : null}
            <ul aria-label="Todos los riesgos" className="mt-3 min-h-[200px] flex-1 space-y-1 overflow-y-auto pr-1">
              {visibles.map((r) => (
                <li key={r.id}>
                  <button type="button" data-fila={r.id} aria-current={ficha?.id === r.id} onClick={() => setElegido(r.id)} className="ri-fila flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left hover:bg-white/[0.04]">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLOR_DE_LA_GRAVEDAD[r.gravedad] }} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] text-zinc-200">{r.titulo}</span><span className="block truncate text-[11px] text-zinc-500">{NOMBRE_DEL_SECTOR[r.sector].nombre} · {r.cliente ?? "Toda la empresa"} · {haceCuanto(r.desde)}</span></span>
                  </button>
                </li>
              ))}
            </ul>
            {datos && datos.decisiones_tuyas.length > 0 && (
              <div data-decisiones-tuyas className="mt-3 shrink-0 border-t border-white/10 pt-3 text-[11.5px] text-zinc-400">
                <p className="mb-1 text-zinc-300">Pausas que decidiste <span className="text-zinc-500">· no son riesgo, van fuera del radar</span></p>
                {datos.decisiones_tuyas.map((d) => <p key={d.id} className="truncate">· {d.titulo}{d.detalle ? <span className="text-zinc-500"> · {d.detalle}</span> : null}</p>)}
              </div>
            )}
            {datos ? (
              <div data-sin-dato className="mt-3 shrink-0 border-t border-white/10 pt-3 text-[11.5px] leading-relaxed text-zinc-500">
                <p><span className="text-zinc-400">Sin dato todavía:</span>{" "}{[
                  ...faltan.map((f) => `${ORIGEN_DEL_RIESGO[f.fuente] ?? "una fuente"} (no se pudo leer)`),
                  ...datos.sin_fuente.map((x) => x.que),
                  ...(vacios.length ? [`${vacios.map((x) => NOMBRE_DEL_SECTOR[x].nombre.toLowerCase()).join(", ")}: el sistema todavía no tiene de dónde leerlos`] : []),
                ].join(" · ")}</p>
                {avisos.map((f) => <p key={`a-${f.fuente}`} className="mt-1">{ORIGEN_DEL_RIESGO[f.fuente] ?? "Una fuente"}: {(f.detalle ?? "").replace(/\bn8n\b/g, "el sistema de procesos")}</p>)}
                {datos.caducados > 0 && <p className="mt-1">{datos.caducados === 1 ? "1 aviso viejo caducó solo" : `${datos.caducados} avisos viejos caducaron solos`}</p>}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}
