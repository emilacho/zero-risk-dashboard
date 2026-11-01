"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { haceCuanto } from "@/lib/direccion-decisiones"
import {
  ANILLOS, CATEGORIAS_DE_RIESGO, NOMBRE_DE_LA_CATEGORIA, NOMBRE_DE_LA_GRAVEDAD, ORIGEN_DEL_RIESGO, alPlano, lugarEnElRadar, tituloDelRiesgo,
  type Gravedad, type Riesgo, type Riesgos,
} from "@/lib/direccion-riesgos"

/**
 * TU OFICINA · RIESGOS Y ALARMAS (6.21 · capa 2 del encargo «oficina del humano»): un RADAR. Cada tipo de riesgo (incidentes, fallas, topes, saldos, pausas,
 * credenciales, servicios) es un sector del círculo y cada riesgo un punto; cuanto más grave, más cerca del centro (3 grave · 2 atender · 1 a la vista). El haz
 * barre el círculo y cada punto se enciende cuando pasa. Tocar un punto (o su renglón de la lista) muestra su ficha a la derecha. Debajo, los medidores de
 * saldo de los proveedores y del freno de gasto de 24 h por cliente. Lo que el sistema aún no puede saber va como «sin dato».
 * Datos: `/api/direccion/riesgos` (servidor del tablero → ruta certificada de la plataforma). SOLO LECTURA: aquí no se cambia nada. Si la lista está
 * incompleta, nunca dice «sin riesgos».
 */
const AMBAR = "#e8731a"
export const COLOR_DE_LA_GRAVEDAD: Record<Gravedad, string> = { 3: "#ff5a36", 2: "#f5a524", 1: "#e9d6b6" }
const VUELTA = 8 // segundos por vuelta del haz
type Respuesta = ({ ok: true } & Riesgos) | { ok: false; error: string }

const ESTILO = `
.ri-punto{cursor:pointer;transition:r .2s ease}
.ri-punto[data-anima="detecta"]{animation:riDetecta ${VUELTA}s ease-out infinite}
@keyframes riDetecta{0%{opacity:1}40%,100%{opacity:.45}}
.ri-eco{animation:riEco ${VUELTA}s ease-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes riEco{0%{transform:scale(1);opacity:.7}30%,100%{transform:scale(3.2);opacity:0}}
.ri-fila{transition:background .15s ease,border-color .15s ease}
.ri-fila[aria-current="true"]{background:rgba(232,115,26,.1);border-color:rgba(232,115,26,.55)}
.ri-ficha{animation:riFicha .4s cubic-bezier(.2,.8,.2,1) both}
@keyframes riFicha{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.ri-punto[data-anima="detecta"],.ri-eco,.ri-ficha{animation:none}}
`

const fecha = (iso: string | null) => { if (!iso) return null; const t = new Date(iso); return Number.isNaN(t.getTime()) ? null : t.toLocaleString("es-EC", { timeZone: "America/Guayaquil", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) }
const usd = (n: number | null) => (n == null ? "sin dato" : `US$ ${n.toFixed(2)}`)

/** el radar: anillos de gravedad, sectores por categoría, el haz que barre y un punto por riesgo */
function Radar({ riesgos, elegido, alElegir, quieto }: { riesgos: Riesgo[]; elegido: string | null; alElegir: (id: string) => void; quieto: boolean }) {
  const C = 200, R = 176, lugar = useMemo(() => lugarEnElRadar(riesgos), [riesgos]), sector = 360 / CATEGORIAS_DE_RIESGO.length
  return (
    <svg viewBox="-36 -30 472 460" className="h-full w-full" role="img" aria-label={`Radar de riesgos: ${riesgos.length} puntos`}>
      <defs>
        <radialGradient id="ri-fondo" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="rgba(232,115,26,.16)" /><stop offset="100%" stopColor="rgba(232,115,26,0)" /></radialGradient>
        <linearGradient id="ri-haz" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="rgba(255,170,90,0)" /><stop offset="100%" stopColor="rgba(255,170,90,.32)" /></linearGradient>
      </defs>
      <circle cx={C} cy={C} r={R} fill="url(#ri-fondo)" />
      {/* los anillos: el límite de cada gravedad, con su nombre */}
      {([3, 2, 1] as Gravedad[]).map((g) => <circle key={g} cx={C} cy={C} r={R * (ANILLOS[g][1] + 0.03)} fill="none" stroke="rgba(255,226,190,.22)" strokeWidth={1} strokeDasharray={g === 1 ? undefined : "3 5"} />)}
      {([3, 2, 1] as Gravedad[]).map((g) => <text key={`t${g}`} x={C + 4} y={C - R * (ANILLOS[g][1] + 0.03) + 12} fontSize={10} fill="rgba(255,226,190,.5)">{NOMBRE_DE_LA_GRAVEDAD[g].nombre.toLowerCase()}</text>)}
      {/* los sectores: una línea por frontera y el nombre de la categoría afuera */}
      {CATEGORIAS_DE_RIESGO.map((c, i) => {
        const [x, y] = alPlano(C, C, R, i * sector, 1), [tx, ty] = alPlano(C, C, R + 18, i * sector + sector / 2, 1)
        const n = riesgos.filter((r) => r.categoria === c).length
        return (
          <g key={c}>
            <line x1={C} y1={C} x2={x} y2={y} stroke="rgba(255,226,190,.12)" strokeWidth={1} />
            <text x={tx} y={ty} fontSize={11} textAnchor="middle" dominantBaseline="middle" fill={n ? "rgba(255,226,190,.85)" : "rgba(255,226,190,.35)"} data-sector={c}>{NOMBRE_DE_LA_CATEGORIA[c]}{n ? ` · ${n}` : ""}</text>
          </g>
        )
      })}
      {/* el haz que barre (arranca arriba, sentido del reloj) */}
      <g>
        <path d={`M${C} ${C} L${C} ${C - R} A${R} ${R} 0 0 1 ${alPlano(C, C, R, 38, 1).join(" ")} Z`} fill="url(#ri-haz)" transform={`rotate(-38 ${C} ${C})`} />
        <line x1={C} y1={C} x2={C} y2={C - R} stroke="rgba(255,190,120,.7)" strokeWidth={1.2} />
        {!quieto && <animateTransform attributeName="transform" type="rotate" from={`0 ${C} ${C}`} to={`360 ${C} ${C}`} dur={`${VUELTA}s`} repeatCount="indefinite" />}
      </g>
      <circle cx={C} cy={C} r={3} fill="rgba(255,226,190,.8)" />
      {/* los puntos: cada uno se enciende cuando el haz pasa por su ángulo */}
      {riesgos.map((x) => {
        const l = lugar.get(x.id)!, [px, py] = alPlano(C, C, R, l.angulo, l.radio), r = x.gravedad === 3 ? 7 : x.gravedad === 2 ? 5.5 : 4.5
        const tarde: CSSProperties = { animationDelay: `${((l.angulo / 360) * VUELTA).toFixed(2)}s` }
        return (
          <g key={x.id}>
            {x.gravedad === 3 && <circle className="ri-eco" cx={px} cy={py} r={r} fill="none" stroke={COLOR_DE_LA_GRAVEDAD[3]} strokeWidth={1.4} style={tarde} />}
            {elegido === x.id && <circle cx={px} cy={py} r={r + 6} fill="none" stroke="#fff" strokeWidth={1.2} />}
            <circle className="ri-punto" data-riesgo={x.id} data-gravedad={x.gravedad} data-anima="detecta" style={tarde} cx={px} cy={py} r={r} fill={COLOR_DE_LA_GRAVEDAD[x.gravedad]}
              onClick={() => alElegir(x.id)}><title>{tituloDelRiesgo(x.titulo)}</title></circle>
          </g>
        )
      })}
    </svg>
  )
}

/** un medidor horizontal: cuánto va de un total (saldos de proveedores y freno de gasto por cliente) */
function Medidor({ etiqueta, pct, texto }: { etiqueta: string; pct: number | null; texto: string }) {
  const p = pct == null ? null : Math.max(0, Math.min(100, pct)), color = p == null ? "rgba(255,255,255,.2)" : p >= 85 ? COLOR_DE_LA_GRAVEDAD[3] : p >= 60 ? COLOR_DE_LA_GRAVEDAD[2] : AMBAR
  return (
    <div data-medidor={etiqueta} className="min-w-0">
      <div className="flex items-baseline gap-2 text-[12px]"><span className="truncate text-zinc-300">{etiqueta}</span><span className="ml-auto shrink-0 tabular-nums text-zinc-400">{p == null ? "sin dato" : `${p.toFixed(0)} %`}</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full" style={{ width: `${p ?? 0}%`, background: color }} /></div>
      <p className="mt-1 truncate text-[11px] text-zinc-500">{texto}</p>
    </div>
  )
}

export function PanelRiesgos({ onCerrar, datosIniciales = null, fetchImpl = fetch }: { onCerrar: () => void; datosIniciales?: Riesgos | null; fetchImpl?: typeof fetch }) {
  const [datos, setDatos] = useState<Riesgos | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!datosIniciales)
  const [elegido, setElegido] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Gravedad | null>(null)
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
  const visibles = filtro ? todos.filter((r) => r.gravedad === filtro) : todos
  const ficha = todos.find((r) => r.id === elegido) ?? visibles[0] ?? null
  const total = datos?.total ?? 0
  const resumen = !datos ? "" : total ? `${total} ${total === 1 ? "riesgo" : "riesgos"} · ${datos.por_gravedad[3]} graves${datos.completo ? "" : " · la lista puede estar incompleta"}` : datos.completo ? "Sin riesgos abiertos ahora" : "No se pudo leer todo: la lista puede estar incompleta"
  const faltan = (datos?.fuentes ?? []).filter((f) => f.estado === "error" || f.estado === "sin_credencial")
  const avisos = (datos?.fuentes ?? []).filter((f) => f.detalle && f.estado === "ok")

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <style>{ESTILO}</style>
      <section role="dialog" aria-modal="true" aria-labelledby="riesgos-titulo" data-seccion="riesgos" className="relative flex h-full max-h-full w-full max-w-[1300px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#171717] text-zinc-200 shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <h2 id="riesgos-titulo" className="font-display text-[15px] font-light uppercase tracking-[0.28em]" style={{ color: AMBAR }}>Riesgos y alarmas</h2>
          <p data-resumen className="text-[12px] text-zinc-400">{cargando && !datos ? "Leyendo…" : resumen}</p>
          <button type="button" onClick={() => void leer()} disabled={cargando} className="ml-auto rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50">{cargando ? "Leyendo…" : "Actualizar"}</button>
          <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar los riesgos" className="rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">Cerrar · Esc</button>
        </header>
        {error && <p role="alert" className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-[13px] text-rose-200 sm:px-6">{error}</p>}

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:overflow-hidden">
          {/* izquierda: el radar, las cuentas por gravedad (filtran) y los medidores */}
          <div className="flex min-h-0 min-w-0 flex-col border-white/10 p-4 lg:border-r sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              {([3, 2, 1] as Gravedad[]).map((g) => (
                <button key={g} type="button" data-filtro-gravedad={g} aria-pressed={filtro === g} onClick={() => setFiltro((f) => (f === g ? null : g))}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] transition ${filtro === g ? "border-white/60 bg-white/10 text-white" : "border-white/15 text-zinc-300 hover:bg-white/[0.05]"}`}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR_DE_LA_GRAVEDAD[g] }} />{NOMBRE_DE_LA_GRAVEDAD[g].nombre}<span className="tabular-nums text-zinc-400">{datos?.por_gravedad[g] ?? 0}</span>
                </button>
              ))}
            </div>
            <div className="relative mx-auto mt-2 aspect-square w-full max-w-[520px] min-h-0 flex-1">
              {datos && <Radar riesgos={visibles} elegido={ficha?.id ?? null} alElegir={setElegido} quieto={quieto} />}
              {datos && !total && <p data-vacio className="absolute inset-x-0 bottom-2 text-center text-[13px] text-zinc-400">{datos.completo && !error ? "Sin riesgos abiertos ahora." : "No pude leer todas las fuentes: no puedo asegurarte que no haya riesgos."}</p>}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-4 border-t border-white/10 pt-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">Saldos de proveedores</p>
                <div className="space-y-3">
                  {(datos?.saldos ?? []).map((s) => <Medidor key={s.proveedor} etiqueta={`${s.proveedor}${s.plan ? ` · ${s.plan.toLowerCase()}` : ""}`} pct={s.pct} texto={`${usd(s.usado_usd)} de ${usd(s.credito_usd)}${s.ciclo_hasta ? ` · el ciclo cierra el ${new Date(s.ciclo_hasta).toLocaleDateString("es-EC", { timeZone: "America/Guayaquil", day: "numeric", month: "short" })}` : ""}`} />)}
                  {datos && !datos.saldos.length && <p className="text-[12px] text-zinc-500">Sin dato</p>}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">Freno de gasto · últimas 24 h</p>
                <div className="space-y-3">
                  {(datos?.topes ?? []).map((t, k) => <Medidor key={t.client_id ?? k} etiqueta={t.cliente ?? "Sin cliente"} pct={t.pct} texto={`${usd(t.gastado_24h_usd)} de un techo de ${usd(t.techo_usd)}`} />)}
                  {datos && !datos.topes.length && <p className="text-[12px] text-zinc-500">Sin dato</p>}
                </div>
              </div>
            </div>
          </div>

          {/* derecha: la ficha del punto elegido y la lista entera, lo más grave arriba */}
          <div className="flex min-h-0 min-w-0 flex-col p-4 sm:p-6">
            {ficha && (
              <article key={ficha.id} data-ficha={ficha.id} className="ri-ficha rounded-2xl border p-5" style={{ borderColor: `${COLOR_DE_LA_GRAVEDAD[ficha.gravedad]}66`, background: "linear-gradient(160deg,#211812,#151110)" }}>
                <div className="flex items-center gap-2 text-[11.5px]">
                  <span className="rounded-full px-2.5 py-0.5 font-medium text-black" style={{ background: COLOR_DE_LA_GRAVEDAD[ficha.gravedad] }}>{NOMBRE_DE_LA_GRAVEDAD[ficha.gravedad].nombre}</span>
                  <span className="uppercase tracking-[0.18em] text-zinc-400">{NOMBRE_DE_LA_CATEGORIA[ficha.categoria]}</span>
                  <span className="ml-auto truncate text-zinc-400">{ficha.cliente ?? "Toda la empresa"}</span>
                </div>
                <h3 data-titulo className="mt-3 text-[17px] font-light leading-snug text-white">{tituloDelRiesgo(ficha.titulo)}</h3>
                {ficha.detalle && tituloDelRiesgo(ficha.detalle) !== tituloDelRiesgo(ficha.titulo) && <p data-detalle className="mt-2 line-clamp-3 text-[12.5px] text-zinc-400">{tituloDelRiesgo(ficha.detalle)}</p>}
                <dl className="mt-4 grid grid-cols-2 gap-3 text-[12.5px]">
                  <div><dt className="text-zinc-500">Desde</dt><dd className="text-zinc-200">{haceCuanto(ficha.desde)}{fecha(ficha.desde) ? <span className="text-zinc-500"> · {fecha(ficha.desde)}</span> : null}</dd></div>
                  <div><dt className="text-zinc-500">Viene de</dt><dd data-origen className="text-zinc-200">{ORIGEN_DEL_RIESGO[ficha.fuente ?? ""] ?? ficha.fuente ?? "Sin dato"}</dd></div>
                </dl>
              </article>
            )}
            <ul aria-label="Todos los riesgos" className="mt-4 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
              {visibles.map((r) => (
                <li key={r.id}>
                  <button type="button" data-fila={r.id} aria-current={ficha?.id === r.id} onClick={() => setElegido(r.id)} className="ri-fila flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left hover:bg-white/[0.04]">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLOR_DE_LA_GRAVEDAD[r.gravedad] }} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] text-zinc-200">{tituloDelRiesgo(r.titulo)}</span><span className="block truncate text-[11px] text-zinc-500">{NOMBRE_DE_LA_CATEGORIA[r.categoria]} · {r.cliente ?? "Toda la empresa"} · {haceCuanto(r.desde)}</span></span>
                  </button>
                </li>
              ))}
            </ul>
            {(datos?.sin_fuente.length || faltan.length || avisos.length) ? (
              <div data-sin-dato className="mt-3 border-t border-white/10 pt-3 text-[11.5px] leading-relaxed text-zinc-500">
                <p className="mb-1 text-zinc-400">Sin dato todavía</p>
                {faltan.map((f) => <p key={f.fuente}>· {ORIGEN_DEL_RIESGO[f.fuente] ?? f.fuente}: no se pudo leer</p>)}
                {datos?.sin_fuente.map((s) => <p key={s.que} title={s.motivo}>· {s.que}</p>)}
                {avisos.map((f) => <p key={`a-${f.fuente}`}>· {ORIGEN_DEL_RIESGO[f.fuente] ?? f.fuente}: {f.detalle}</p>)}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}
