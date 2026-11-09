"use client"

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react"
import { HORA_24 } from "@/lib/formato"
import { haceCuanto } from "@/lib/direccion-decisiones"
import { GRADOS_POR_SECTOR, NOMBRE_DE_LA_GRAVEDAD, NOMBRE_DEL_SECTOR, ORIGEN_DEL_RIESGO, SECTORES, SECTORES_SIN_FUENTE, alPlano, lugarEnElRadar, type Gravedad, type Riesgo, type Riesgos, type Sector } from "@/lib/direccion-riesgos"
import { riesgoClaro } from "@/lib/riesgo-claro"
import { estadoDeLosRiesgos, marcarRiesgoVisto, type Cerrada, type VistosDeRiesgos } from "@/lib/riesgos-vistos"
import { Acciones, BOTON_PRINCIPAL, BOTON_SECUNDARIO, PanelBase, Pares, Recuadros } from "@/components/nuevo/EstiloBase"

/**
 * TU OFICINA · RIESGOS (se abre con la campana del marco y con la pantalla 6 de la escena) · ESTILO BASE (guía `00-meta/ESTILO-DASHBOARD.md`, imagen `APROBADO-concepto.png`).
 * Corrección de Emilio (06-nov 01:46, en escritorio): «el radar a la izquierda, y lo nuevo reemplaza lo de la derecha».
 *  - IZQUIERDA: el radar de siempre, recoloreado (oro y gris; rojo solo lo grave) y, debajo, los 8 temas como recuadros de número (tocar uno filtra).
 *  - DERECHA: el título con la ✕; los recuadros Abiertas · Tomadas · Cerradas (filtran); la tarjeta del riesgo con «Detalle» y «Visto»; la lista debajo.
 * «Visto» guarda la marca en la tabla de marcas del tablero (`lib/riesgos-vistos.ts`): pasa a Tomada; cuando la plataforma deja de mostrarlo, a Cerrada.
 * Datos: `/api/direccion/riesgos` (servidor del tablero → ruta certificada de la plataforma + las marcas). Si la lista está incompleta, nunca dice «sin riesgos».
 */
type ConMarcas = { vistos?: VistosDeRiesgos | null; cierres?: VistosDeRiesgos | null }
type Respuesta = ({ ok: true } & ConMarcas & Riesgos) | { ok: false; error: string }
export type Filtro = "abiertas" | "tomadas" | "cerradas"

const fecha = (iso: string | null) => { if (!iso) return null; const t = new Date(iso); return Number.isNaN(t.getTime()) ? null : t.toLocaleString("es-EC", { timeZone: "America/Guayaquil", day: "numeric", month: "short", ...HORA_24 }) }
/** el punto de cada riesgo: alarma solo para lo grave; oro para lo que hay que atender; el resto, apagado */
const PUNTO: Record<Gravedad, string> = { 3: "bg-alarma", 2: "bg-oro", 1: "bg-apagado" }
/** lo mismo dentro del radar (relleno y trazo con los tokens) */
const RELLENO: Record<Gravedad, string> = { 3: "fill-alarma", 2: "fill-oro", 1: "fill-apagado" }
const TRAZO: Record<Gravedad, string> = { 3: "stroke-alarma", 2: "stroke-oro", 1: "stroke-apagado" }
const ordenar = (xs: Riesgo[]) => xs.slice().sort((a, b) => b.gravedad - a.gravedad || Date.parse(b.desde ?? "") - Date.parse(a.desde ?? ""))
const peor = (lista: Riesgo[]): Gravedad | null => (lista.length ? (Math.max(...lista.map((r) => r.gravedad)) as Gravedad) : null)

// ── el radar ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const FRANJAS: Record<Gravedad, [number, number]> = { 3: [0, 0.41], 2: [0.41, 0.69], 1: [0.69, 1] }
const VUELTA = 8 // segundos por vuelta del haz
const ESTELA = 14 // gajos de la estela del haz
const ESTILO = `
.ri-punto{cursor:pointer}
.ri-punto[data-anima="detecta"]{animation:riDetecta ${VUELTA}s ease-out infinite}
@keyframes riDetecta{0%{opacity:1}35%,100%{opacity:.5}}
.ri-eco{animation:riEco ${VUELTA}s ease-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes riEco{0%{transform:scale(1);opacity:.75}30%,100%{transform:scale(3.4);opacity:0}}
.ri-haz{transform-box:view-box;transform-origin:200px 200px;will-change:transform;animation:riGira ${VUELTA}s linear infinite}
@keyframes riGira{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.ri-punto[data-anima="detecta"],.ri-eco,.ri-haz{animation:none}}
`
const punto = (C: number, r: number, a: number) => alPlano(C, C, r, a, 1).map((v) => v.toFixed(2)).join(" ")
const arco = (C: number, r: number, a0: number, a1: number) => `M${punto(C, r, a0)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${punto(C, r, a1)}`
const gajo = (C: number, r: number, a0: number, a1: number) => `M${C} ${C} L${punto(C, r, a0)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${punto(C, r, a1)} Z`

/** el radar de siempre (bisel, franjas de gravedad, 8 sectores, haz con estela, un punto por riesgo), con los colores del estilo base */
function Radar({ riesgos, todos, elegido, alElegir, sector }: { riesgos: Riesgo[]; todos: Riesgo[]; elegido: string | null; alElegir: (id: string) => void; sector: Sector | null }) {
  const C = 200, R = 150, lugar = useMemo(() => lugarEnElRadar(riesgos), [riesgos])
  return (
    <svg viewBox="-16 -8 432 416" className="h-full w-full" role="img" aria-label={`Radar de riesgos: ${riesgos.length} puntos en 8 sectores`}>
      <defs>
        <radialGradient id="ri-fondo" cx="50%" cy="50%" r="50%"><stop offset="0%" style={{ stopColor: "var(--color-oro)", stopOpacity: 0.14 }} /><stop offset="55%" style={{ stopColor: "var(--color-oro)", stopOpacity: 0.04 }} /><stop offset="100%" style={{ stopColor: "var(--color-oro)", stopOpacity: 0 }} /></radialGradient>
      </defs>
      <circle cx={C} cy={C} r={R + 18} fill="none" className="stroke-oro" strokeOpacity={0.08} strokeWidth={1} />
      <circle cx={C} cy={C} r={R + 9} fill="none" className="stroke-oro" strokeOpacity={0.16} strokeWidth={0.8} />
      {Array.from({ length: 120 }, (_, i) => { const a = i * 3, largo = a % 15 === 0 ? 6 : 2.6, [x0, y0] = alPlano(C, C, R + 9, a, 1), [x1, y1] = alPlano(C, C, R + 9 + largo, a, 1); return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} className="stroke-oro" strokeOpacity={0.26} strokeWidth={a % 15 === 0 ? 0.9 : 0.5} /> })}
      <circle cx={C} cy={C} r={R} fill="url(#ri-fondo)" className="stroke-oro" strokeOpacity={0.3} strokeWidth={0.9} />
      {sector && <path data-sector-elegido={sector} d={gajo(C, R, SECTORES.indexOf(sector) * GRADOS_POR_SECTOR, (SECTORES.indexOf(sector) + 1) * GRADOS_POR_SECTOR)} className="fill-oro" fillOpacity={0.08} />}
      {/* las 3 franjas de gravedad: grave al centro (alarma), atender en medio (oro), a la vista afuera (gris) */}
      {([3, 2, 1] as Gravedad[]).map((g) => { const [a, b] = FRANJAS[g]; return (
        <g key={`f${g}`} data-anillo={g}>
          <circle cx={C} cy={C} r={(R * (a + b)) / 2} fill="none" className={TRAZO[g]} strokeOpacity={0.06} strokeWidth={R * (b - a)} />
          <circle cx={C} cy={C} r={R * b} fill="none" className={TRAZO[g]} strokeOpacity={0.45} strokeWidth={0.8} />
        </g>
      ) })}
      {/* los 8 sectores: frontera fina y arco de estado en el borde (el color de su riesgo más grave) */}
      {SECTORES.map((s, i) => {
        const a0 = i * GRADOS_POR_SECTOR, a1 = a0 + GRADOS_POR_SECTOR, [x, y] = alPlano(C, C, R, a0, 1), del = todos.filter((r) => r.sector === s), g = peor(del)
        const sinFuente = SECTORES_SIN_FUENTE.includes(s) && !del.length
        return (
          <g key={s} data-sector={s}>
            <line x1={C} y1={C} x2={x} y2={y} className="stroke-oro" strokeOpacity={0.1} strokeWidth={0.7} />
            <path d={arco(C, R + 3.5, a0 + 2.5, a1 - 2.5)} fill="none" className={g ? TRAZO[g] : "stroke-apagado"} strokeOpacity={g ? 1 : 0.4} strokeWidth={g ? 2.6 : 1.4} strokeLinecap="round" strokeDasharray={sinFuente ? "1 3" : undefined} />
          </g>
        )
      })}
      {/* el haz con su estela, en oro */}
      <g data-haz className="ri-haz">
        {Array.from({ length: ESTELA }, (_, k) => <path key={k} d={gajo(C, R, 360 - (k + 1) * 3, 360 - k * 3)} className="fill-oro" fillOpacity={Number((0.16 * (1 - k / ESTELA) ** 1.6).toFixed(3))} />)}
        <line x1={C} y1={C} x2={C} y2={C - R} className="stroke-oro" strokeOpacity={0.85} strokeWidth={1} />
      </g>
      <circle cx={C} cy={C} r={5} fill="none" className="stroke-oro" strokeOpacity={0.35} strokeWidth={0.7} />
      <circle cx={C} cy={C} r={1.8} className="fill-hueso" />
      {riesgos.map((x) => {
        const l = lugar.get(x.id)!, [px, py] = alPlano(C, C, R, l.angulo, l.radio), r = x.gravedad === 3 ? 4.6 : x.gravedad === 2 ? 3.6 : 3
        const tarde: CSSProperties = { animationDelay: `${((l.angulo / 360) * VUELTA).toFixed(2)}s` }
        return (
          <g key={x.id}>
            {x.gravedad === 3 && <circle className="ri-eco stroke-alarma" cx={px} cy={py} r={r} fill="none" strokeWidth={1} style={tarde} />}
            {elegido === x.id && <circle cx={px} cy={py} r={r + 5} fill="none" className="stroke-hueso" strokeOpacity={0.9} strokeWidth={0.9} />}
            <circle cx={px} cy={py} r={r * 2.1} className={`ri-halo ${RELLENO[x.gravedad]}`} opacity={0.2} pointerEvents="none" />
            <circle className={`ri-punto ${RELLENO[x.gravedad]}`} data-riesgo={x.id} data-gravedad={x.gravedad} data-anima="detecta" style={tarde} cx={px} cy={py} r={r} onClick={() => alElegir(x.id)}><title>{riesgoClaro(x).frase}</title></circle>
          </g>
        )
      })}
    </svg>
  )
}

/** izquierda: el radar y los 8 temas como recuadros de número (tocar uno filtra; tocarlo otra vez quita el filtro) */
function ColumnaDelRadar({ riesgos, todos, elegido, alElegir, sector, alElegirSector, cargado }: { riesgos: Riesgo[]; todos: Riesgo[]; elegido: string | null; alElegir: (id: string) => void; sector: Sector | null; alElegirSector: (s: Sector) => void; cargado: boolean }) {
  return (
    <>
      <style>{ESTILO}</style>
      <div data-radar className="mx-auto aspect-square w-full max-w-[420px]"><Radar riesgos={riesgos} todos={todos} elegido={elegido} alElegir={alElegir} sector={sector} /></div>
      <div role="group" aria-label="Filtrar por tema" className="mt-6 grid grid-cols-4 gap-3">
        {SECTORES.map((s) => {
          const del = todos.filter((r) => r.sector === s), g = peor(del), sinFuente = SECTORES_SIN_FUENTE.includes(s) && !del.length
          return (
            <button key={s} type="button" data-tarjeta-sector={s} aria-pressed={sector === s} onClick={() => alElegirSector(s)} title={NOMBRE_DEL_SECTOR[s].que}
              className={`rounded-tarjeta border bg-grafito-2 px-2 py-3 text-center ${sector === s ? "border-linea-oro" : "border-linea hover:border-linea-oro"}`}>
              <span className={`block text-cifra font-medio [font-variant-numeric:tabular-nums] ${sinFuente ? "text-apagado" : g === 3 ? "text-alarma" : sector === s ? "text-oro" : "text-hueso"}`}>{sinFuente ? "—" : !cargado ? "…" : del.length}</span>
              <span className="mt-1 block truncate text-rotulo uppercase tracking-rotulo text-gris">{NOMBRE_DEL_SECTOR[s].corto}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

/** la tarjeta del riesgo: gravedad · cliente · tema → qué pasó → a quién afecta → desde cuándo y de dónde; «Detalle» y «Visto» (ámbar, a la derecha) */
function Tarjeta({ r, tomada, puedeMarcar, marcando, alMarcar }: { r: Riesgo; tomada: string | null; puedeMarcar: boolean; marcando: boolean; alMarcar: () => void }) {
  const c = riesgoClaro(r)
  const [detalle, setDetalle] = useState(false)
  const hayDetalle = !!(c.detalle || c.tecnico)
  return (
    <article data-ficha={r.id} data-gravedad={r.gravedad} data-tomada={tomada ? "si" : "no"} className="shrink-0 rounded-tarjeta border border-linea bg-grafito-2 p-6 text-center">
      <p className="flex flex-wrap items-center justify-center gap-x-2 text-rotulo uppercase tracking-rotulo text-gris">
        <span data-gravedad-nombre className={`inline-flex items-center gap-1.5 font-medio ${r.gravedad === 3 ? "text-alarma" : "text-oro"}`}><span aria-hidden className={`h-[7px] w-[7px] rounded-full ${PUNTO[r.gravedad]}`} />{NOMBRE_DE_LA_GRAVEDAD[r.gravedad].nombre}</span>
        <span aria-hidden>·</span><span>{r.cliente ?? "Toda la empresa"}</span><span aria-hidden>·</span><span>{NOMBRE_DEL_SECTOR[r.sector].corto}</span>
      </p>
      <h3 data-titulo className="mt-3 text-cuerpo font-medio text-hueso">{c.frase}</h3>
      <p data-quien className="mt-1.5 text-dato text-gris">Afecta a {c.afecta} · {c.arregla ?? "sin responsable asignado"}</p>
      <div className="mt-5"><Pares valor="text-dato" pares={[
        { rotulo: "Desde", valor: haceCuanto(r.desde), dato: fecha(r.desde) ?? undefined },
        { rotulo: "Origen", valor: <span data-origen>{ORIGEN_DEL_RIESGO[r.fuente ?? ""] ?? "Sin dato"}</span> },
      ]} /></div>
      {detalle && (
        <div data-detalle-abierto className="mt-4 border-t border-linea pt-4 text-left">
          {c.detalle && <p data-detalle className="text-dato text-hueso">{c.detalle}</p>}
          {c.tecnico && <p data-tecnico className="mt-2 whitespace-pre-wrap break-words text-dato text-gris">{c.tecnico}</p>}
        </div>
      )}
      {(hayDetalle || (puedeMarcar && !tomada)) && (
        <Acciones>
          {hayDetalle && <button type="button" data-ver-detalle aria-expanded={detalle} onClick={() => setDetalle((x) => !x)} className={BOTON_SECUNDARIO}>{detalle ? "Ocultar detalle" : "Detalle"}</button>}
          {puedeMarcar && !tomada && <button type="button" data-visto={r.id} disabled={marcando} onClick={alMarcar} className={BOTON_PRINCIPAL}>{marcando ? "Guardando…" : "Visto"}</button>}
        </Acciones>
      )}
      {tomada && <p data-tomada-en className="mt-4 text-rotulo uppercase tracking-rotulo text-gris">Tomada · la viste {haceCuanto(tomada)}</p>}
    </article>
  )
}

/** de una cerrada solo se sabe cuándo se cerró (la marca no guarda el título) */
function TarjetaCerrada({ x }: { x: Cerrada }) {
  return (
    <article data-ficha-cerrada={x.id} className="shrink-0 rounded-tarjeta border border-linea bg-grafito-2 p-6 text-center">
      <p className="text-rotulo uppercase tracking-rotulo text-gris">Cerrada</p>
      <h3 className="mt-3 text-cuerpo font-medio text-hueso">Ya no aparece: se resolvió</h3>
      <p className="mt-1.5 text-dato text-gris">Se cerró {haceCuanto(x.cerrada_en)}{fecha(x.cerrada_en) ? ` · ${fecha(x.cerrada_en)}` : ""}</p>
    </article>
  )
}

export function PanelRiesgos({ onCerrar, datosIniciales = null, fetchImpl = fetch, filtroInicial = "abiertas" }: { onCerrar: () => void; datosIniciales?: (Riesgos & ConMarcas) | null; fetchImpl?: typeof fetch; filtroInicial?: Filtro }) {
  const [datos, setDatos] = useState<(Riesgos & ConMarcas) | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!datosIniciales)
  const [elegido, setElegido] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>(filtroInicial)
  const [sector, setSector] = useState<Sector | null>(null)
  const [marcando, setMarcando] = useState<string | null>(null)

  const leer = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      const r = await fetchImpl("/api/direccion/riesgos", { cache: "no-store" })
      const j = (await r.json().catch(() => null)) as Respuesta | null
      if (!r.ok || !j || !j.ok) throw new Error(r.status === 401 || r.status === 403 ? "Necesitas una sesión de administrador para ver los riesgos." : (j && !j.ok && j.error) || `No pude leer los riesgos (${r.status}).`)
      setDatos(j)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setCargando(false) }
  }, [fetchImpl])
  useEffect(() => { void leer() }, [leer]) // siempre se refresca al abrir; con datos iniciales, sin pantalla vacía
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key !== "Escape") return; e.stopPropagation(); e.preventDefault(); onCerrar() }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar])

  // «Visto»: guarda la marca y la pasa a Tomada sin esperar otra lectura
  const marcar = useCallback(async (id: string) => {
    setMarcando(id); setError(null)
    const r = await marcarRiesgoVisto(fetchImpl, id, datos?.vistos)
    if (r.ok) { setDatos((d) => (d ? { ...d, vistos: { ...(d.vistos ?? {}), ...r.vistos } } : d)); setElegido(null) } else setError(r.error)
    setMarcando(null)
  }, [fetchImpl, datos?.vistos])

  const todos = ordenar(datos?.riesgos ?? [])
  // sin las marcas leídas (todavía, o no se pudieron leer) no se inventan tomadas ni cerradas
  const vistos = datos?.vistos ?? null
  const estado = estadoDeLosRiesgos(todos, vistos ?? {}, { cierres: datos?.cierres ?? null, completo: !!datos?.completo })
  const delSector = (xs: Riesgo[]) => (sector ? xs.filter((r) => r.sector === sector) : xs)
  const visibles = filtro === "cerradas" ? [] : delSector(filtro === "tomadas" ? estado.tomadas : vistos ? estado.abiertas : todos)
  const ficha = visibles.find((r) => r.id === elegido) ?? visibles[0] ?? null
  const resto = visibles.filter((r) => r.id !== ficha?.id)
  const cerradas = filtro === "cerradas" ? (estado.cerradas ?? []) : []
  const total = datos?.total ?? 0
  const n = (x: number) => (!datos ? "…" : x)
  // «…» mientras llegan las marcas (la escena pasa su lectura sin ellas); «—» si no se pudieron leer
  const conMarcas = (x: number) => (!datos || datos.vistos === undefined ? "…" : vistos ? x : "—")
  const resumen = !datos ? "" : `${total} ${total === 1 ? "riesgo" : "riesgos"} · ${datos.por_gravedad[3]} ${datos.por_gravedad[3] === 1 ? "grave" : "graves"}${datos.completo ? "" : " · la lista puede estar incompleta"}`
  const elegirFiltro = (k: string) => { setFiltro(k as Filtro); setElegido(null) }
  const elegirSector = (s: Sector) => { setSector((x) => (x === s ? null : s)); setElegido(null) }
  const elegirPunto = (id: string) => { const t = estado.tomadas.some((r) => r.id === id); setFiltro(vistos && t ? "tomadas" : "abiertas"); setSector(null); setElegido(id) }

  return (
    <PanelBase titulo="Riesgos" id="riesgos-titulo" seccion="riesgos" onCerrar={onCerrar} etiquetaCerrar="Cerrar los riesgos" ancho="max-w-[1120px]"
      lado={<ColumnaDelRadar riesgos={datos ? delSector(todos) : []} todos={todos} elegido={ficha?.id ?? null} alElegir={elegirPunto} sector={sector} alElegirSector={elegirSector} cargado={!!datos} />}>
      <p data-resumen className="sr-only">{cargando && !datos ? "Leyendo…" : resumen}</p>
      <Recuadros etiqueta="Filtrar los riesgos" alElegir={elegirFiltro} items={[
        { clave: "abiertas", numero: vistos ? n(estado.abiertas.length) : n(total), rotulo: "Abiertas", activo: filtro === "abiertas", alarma: estado.abiertas.some((r) => r.gravedad === 3) },
        { clave: "tomadas", numero: conMarcas(estado.tomadas.length), rotulo: "Tomadas", activo: filtro === "tomadas" },
        { clave: "cerradas", numero: !datos || datos.cierres === undefined ? "…" : estado.cerradas ? estado.cerradas.length : "—", rotulo: "Cerradas", activo: filtro === "cerradas" },
      ]} />
      {error && <p role="alert" className="mb-4 border-y border-linea-alarma py-3 text-center text-dato text-hueso">{error}</p>}
      {datos && !vistos && datos.vistos === null && <p data-sin-marcas className="mb-4 text-center text-dato text-gris">No pude leer lo que marcaste visto: por ahora no se puede marcar.</p>}

      {filtro === "cerradas" ? (
        cerradas.length ? <TarjetaCerrada x={cerradas[0]} /> : <p data-vacio className="py-6 text-center text-cuerpo text-gris">{estado.cerradas ? `Nada cerrado en los últimos 7 días.` : datos && !datos.completo ? "La lista vino incompleta: no puedo decirte qué se cerró." : "Sin dato de lo cerrado."}</p>
      ) : ficha ? <Tarjeta key={ficha.id} r={ficha} tomada={vistos?.[ficha.id] ?? null} puedeMarcar={!!vistos} marcando={marcando === ficha.id} alMarcar={() => void marcar(ficha.id)} />
        : datos ? (
          <p data-vacio className="py-6 text-center text-cuerpo text-gris">
            {total > 0 ? "Nada en este filtro." : datos.completo && !error ? "Sin riesgos abiertos ahora." : "No pude leer todas las fuentes: no puedo asegurarte que no haya riesgos."}
          </p>
        ) : <p className="py-6 text-center text-dato text-gris">Leyendo los riesgos…</p>}

      {resto.length > 0 && (
        <ul aria-label="Los demás riesgos" className="mt-6 shrink-0">
          {resto.map((r) => {
            const c = riesgoClaro(r)
            return (
              <li key={r.id} className="border-t border-linea">
                <button type="button" data-fila={r.id} onClick={() => setElegido(r.id)} className="grid min-h-11 w-full grid-cols-[16px_1fr] items-start gap-x-1 py-4 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-oro">
                  <span aria-hidden className={`mt-2 h-[7px] w-[7px] rounded-full ${PUNTO[r.gravedad]}`} />
                  <span className="min-w-0"><span className="block text-cuerpo text-hueso">{c.frase}</span><span className="block text-dato text-gris">{NOMBRE_DEL_SECTOR[r.sector].corto} · {r.cliente ?? "Toda la empresa"} · {haceCuanto(r.desde)}</span></span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {cerradas.length > 1 && (
        <ul aria-label="Las demás cerradas" className="mt-6 shrink-0">
          {cerradas.slice(1).map((x) => <li key={x.id} data-fila-cerrada={x.id} className="border-t border-linea py-4 text-dato text-gris"><span className="text-cuerpo text-hueso">Se resolvió</span> · se cerró {haceCuanto(x.cerrada_en)}</li>)}
        </ul>
      )}
    </PanelBase>
  )
}
