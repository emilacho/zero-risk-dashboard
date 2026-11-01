"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react"
import {
  COLOR_DEL_ESTADO, ESTADOS, NOMBRE_DEL_ESTADO, arbolDeNodos, costoComoDato, cuando, duracion, lineaDeTiempo, miles, nombreDeLaRama, palabras,
  type Corrida, type DetalleDeCorrida, type EstadoCorrida, type ListaDeCorridas, type Nodo,
} from "@/lib/direccion-corridas"

/**
 * TU OFICINA · PANTALLA 9 · OBSERVABILIDAD (6.26). Estructura COPIADA de LangSmith (regla de Emilio: «copia del mejor del mercado; adaptar solo la fachada»):
 *  1 · la tabla de corridas con búsqueda y filtros (fecha, cliente, estado) · 2 · al abrir una, el árbol de pasos con la cascada de tiempos ·
 *  3 · al tocar un paso, su detalle con pestañas Entrada / Salida / Metadatos · 4 · los errores en rojo arriba del árbol.
 * Datos: `/api/direccion/corridas` y `/api/direccion/corridas/{ejecución}` (servidor del tablero → rutas certificadas de la plataforma). SOLO LECTURA.
 * El costo es un dato de la corrida, como en LangSmith: sin avisos.
 */
const AMBAR = "#e8731a"
const NUM: CSSProperties = { fontVariantNumeric: "tabular-nums" }
type Dias = 1 | 7 | 30
const FECHAS: { dias: Dias; nombre: string }[] = [{ dias: 1, nombre: "Últimas 24 h" }, { dias: 7, nombre: "7 días" }, { dias: 30, nombre: "30 días" }]
type Pestana = "entrada" | "salida" | "metadatos"
const PESTANAS: { id: Pestana; nombre: string }[] = [{ id: "entrada", nombre: "Entrada" }, { id: "salida", nombre: "Salida" }, { id: "metadatos", nombre: "Metadatos" }]
const SIN_TEXTO = "La plataforma guarda quién trabajó, cuándo, con qué modelo y cuántos tokens usó, pero todavía no guarda el texto"

/** el ícono de estado, como en LangSmith: visto bueno, equis, círculo que gira */
function IconoDeEstado({ estado, tam = 14 }: { estado: EstadoCorrida; tam?: number }) {
  const c = COLOR_DEL_ESTADO[estado]
  return (
    <svg viewBox="0 0 16 16" width={tam} height={tam} className="shrink-0" aria-hidden="true">
      {estado === "completa" && <><circle cx={8} cy={8} r={7} fill={`${c}22`} stroke={c} strokeWidth={1.2} /><path d="M4.8 8.3 7 10.4l4.3-4.6" fill="none" stroke={c} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></>}
      {estado === "fallida" && <><circle cx={8} cy={8} r={7} fill={`${c}26`} stroke={c} strokeWidth={1.2} /><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke={c} strokeWidth={1.6} strokeLinecap="round" /></>}
      {(estado === "en_curso" || estado === "atascada") && <><circle cx={8} cy={8} r={6} fill="none" stroke={`${c}44`} strokeWidth={2} /><path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" className={estado === "en_curso" ? "ob-gira" : undefined} /></>}
      {estado === "sin_cierre" && <><circle cx={8} cy={8} r={7} fill="none" stroke={c} strokeWidth={1.2} strokeDasharray="2 2" /><circle cx={8} cy={8} r={1.4} fill={c} /></>}
    </svg>
  )
}
const Estado = ({ estado }: { estado: EstadoCorrida }) => (
  <span data-estado={estado} className="inline-flex items-center gap-1.5 text-[12.5px]" style={{ color: COLOR_DEL_ESTADO[estado] }}><IconoDeEstado estado={estado} />{NOMBRE_DEL_ESTADO[estado]}</span>
)
const Ficha = ({ titulo, children }: { titulo: string; children: ReactNode }) => (
  <span className="inline-flex items-baseline gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[12px]"><span className="text-zinc-500">{titulo}</span><span className="text-zinc-100" style={NUM}>{children}</span></span>
)
const Chip = ({ activo, onClick, children, ...resto }: { activo: boolean; onClick: () => void; children: ReactNode } & Record<`data-${string}`, string>) => (
  <button type="button" onClick={onClick} aria-pressed={activo} {...resto}
    className={`rounded-md border px-2.5 py-1 text-[12px] transition-colors ${activo ? "border-amber-500/60 bg-amber-500/15 text-amber-100" : "border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200"}`}>{children}</button>
)

async function leerJson<T>(f: typeof fetch, url: string, que: string): Promise<T> {
  const r = await f(url, { cache: "no-store" })
  const j = (await r.json().catch(() => null)) as ({ ok: true } & T) | { ok: false; error: string } | null
  if (!r.ok || !j || !j.ok) throw new Error(r.status === 401 || r.status === 403 ? "Necesitas una sesión de administrador para ver las corridas." : (j && !j.ok && j.error) || `No pude leer ${que} (${r.status}).`)
  return j
}

/** ─── 1 · LA LISTA DE CORRIDAS (la tabla «Runs» de LangSmith) ─── */
function Lista({ lista, dias, setDias, cliente, setCliente, clientes, estado, setEstado, busca, setBusca, abrir, cargando }: {
  lista: ListaDeCorridas | null; dias: Dias; setDias: (d: Dias) => void; cliente: string; setCliente: (c: string) => void; clientes: { id: string; nombre: string }[]
  estado: EstadoCorrida | "todas"; setEstado: (e: EstadoCorrida | "todas") => void; busca: string; setBusca: (b: string) => void; abrir: (c: Corrida) => void; cargando: boolean
}) {
  const corridas = lista?.corridas ?? []
  const b = busca.trim().toLowerCase()
  const buscadas = b ? corridas.filter((c) => [c.nombre, c.cliente ?? "", c.workflow_execution_id].some((x) => x.toLowerCase().includes(b))) : corridas
  const visibles = estado === "todas" ? buscadas : buscadas.filter((c) => c.estado === estado)
  const cuenta = (e: EstadoCorrida) => buscadas.filter((c) => c.estado === e).length
  return (
    <div data-vista="lista" className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3 sm:px-6">
        <input data-busca type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nombre, cliente o ejecución"
          className="h-8 w-full min-w-0 rounded-md border border-white/10 bg-black/30 px-3 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/60 focus:outline-none sm:w-[320px]" />
        <div className="flex items-center gap-1" role="group" aria-label="Fecha">{FECHAS.map((f) => <Chip key={f.dias} data-fecha={String(f.dias)} activo={dias === f.dias} onClick={() => setDias(f.dias)}>{f.nombre}</Chip>)}</div>
        <select data-filtro-cliente value={cliente} onChange={(e) => setCliente(e.target.value)} aria-label="Cliente" className="h-8 rounded-md border border-white/10 bg-black/30 px-2 text-[12.5px] text-zinc-200 focus:border-amber-500/60 focus:outline-none">
          <option value="">Todos los clientes</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-1 border-b border-white/10 px-4 py-2 sm:px-6" role="group" aria-label="Estado">
        <Chip data-filtro-estado="todas" activo={estado === "todas"} onClick={() => setEstado("todas")}>Todas <span style={NUM}>{buscadas.length}</span></Chip>
        {ESTADOS.map((e) => <Chip key={e} data-filtro-estado={e} activo={estado === e} onClick={() => setEstado(e)}><span style={{ color: COLOR_DEL_ESTADO[e] }}>●</span> {NOMBRE_DEL_ESTADO[e]} <span style={NUM}>{cuenta(e)}</span></Chip>)}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table data-tabla-corridas className="w-full min-w-[860px] border-collapse text-left text-[13px]">
          <thead className="sticky top-0 z-[1] bg-[#1b1815] text-[11px] uppercase tracking-[0.12em] text-zinc-500">
            <tr>{["Nombre", "Cliente", "Estado", "Inicio", "Duración", "Tokens", "Costo", "Pasos"].map((h, i) => <th key={h} className={`border-b border-white/10 px-3 py-2 font-medium ${i === 0 ? "pl-4 sm:pl-6" : ""} ${i >= 4 ? "text-right" : ""}`}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {visibles.map((c) => (
              <tr key={c.workflow_execution_id} data-corrida={c.workflow_execution_id} tabIndex={0} role="button" aria-label={`Abrir la corrida ${c.nombre}`}
                onClick={() => abrir(c)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(c) } }}
                className="cursor-pointer border-b border-white/[0.05] hover:bg-amber-500/[0.06] focus-visible:bg-amber-500/[0.08] focus-visible:outline-none">
                <td className="max-w-[340px] py-2 pl-4 pr-3 sm:pl-6"><p className="truncate text-zinc-100">{c.nombre}</p><p className="truncate text-[11px] text-zinc-600" style={NUM}>{c.workflow_execution_id}{c.ramas.length ? ` · ${c.ramas.length} ${c.ramas.length === 1 ? "rama" : "ramas"}` : ""}</p></td>
                <td className="px-3 py-2 text-zinc-300">{c.cliente ?? <span className="text-zinc-600">sin cliente</span>}</td>
                <td className="px-3 py-2"><Estado estado={c.estado} /></td>
                <td className="whitespace-nowrap px-3 py-2 text-zinc-400" style={NUM}>{cuando(c.inicio)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-zinc-200" style={NUM}>{duracion(c.duracion_ms)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-zinc-300" style={NUM}>{miles(c.tokens)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-zinc-300" style={NUM}>{costoComoDato(c.costo_usd)}</td>
                <td className="whitespace-nowrap px-3 py-2 pr-4 text-right text-zinc-400 sm:pr-6" style={NUM}>{c.pasos}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {lista && !visibles.length && <p className="px-6 py-8 text-center text-[13px] text-zinc-500">{cargando ? "Leyendo…" : "Ninguna corrida con estos filtros."}</p>}
      </div>
      {lista && (
        <div data-sin-dato className="border-t border-white/10 px-4 py-2 text-[12px] leading-relaxed text-zinc-500 sm:px-6">
          <span style={NUM}>Mostrando {visibles.length} de {lista.total} corridas</span>
          {lista.total > corridas.length && <> · la plataforma entrega las {corridas.length} más recientes por lectura</>}
          {!lista.completo && <> · lectura incompleta: alguna fuente no respondió entera</>}
          <> · <span className="text-zinc-400">Sin dato todavía:</span> entrada y salida de cada corrida</>
        </div>
      )}
    </div>
  )
}

/** ─── 2 · UNA CORRIDA: árbol de pasos + cascada de tiempos (izquierda) · 3 · detalle con pestañas (derecha) ─── */
function Traza({ detalle, volver }: { detalle: DetalleDeCorrida; volver: () => void }) {
  const nodos = useMemo(() => arbolDeNodos(detalle), [detalle])
  const tiempo = useMemo(() => lineaDeTiempo(nodos), [nodos])
  const [clave, setClave] = useState("corrida")
  const [pestana, setPestana] = useState<Pestana>("metadatos")
  const elegido = nodos.find((n) => n.clave === clave) ?? nodos[0]
  const errores = nodos.filter((n) => n.tipo === "paso" && n.estado === "fallida")
  const c = detalle.corrida
  const marcas = [0, 0.25, 0.5, 0.75, 1]
  return (
    <div data-vista="traza" className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3 sm:px-6">
        <button type="button" data-volver onClick={volver} className="rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06]">← Corridas</button>
        <h3 className="min-w-0 truncate text-[15px] text-white">{c.nombre}</h3>
        <span className="text-[12px] text-zinc-500" style={NUM}>{c.workflow_execution_id}</span>
        <Estado estado={c.estado} />
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Ficha titulo="Cliente">{c.cliente ?? "sin cliente"}</Ficha>
          <Ficha titulo="Inicio">{cuando(c.inicio)}</Ficha>
          <Ficha titulo="Duración">{duracion(c.duracion_ms)}</Ficha>
          <Ficha titulo="Tokens">{miles(c.tokens)}</Ficha>
          <Ficha titulo="Costo">{costoComoDato(c.costo_usd)}</Ficha>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="flex min-h-0 min-w-0 flex-col border-b border-white/10 lg:border-b-0 lg:border-r">
          {errores.length > 0 && (
            <div data-errores role="alert" className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 sm:px-6">
              <p className="text-[12.5px] font-medium text-rose-200">{errores.length} {errores.length === 1 ? "paso con error" : "pasos con error"}</p>
              {errores.map((n) => <button key={n.clave} type="button" onClick={() => { setClave(n.clave); setPestana("metadatos") }} className="block max-w-full truncate text-left text-[12px] text-rose-200/80 hover:text-rose-100">✕ {n.nombre}{n.error ? ` · ${n.error}` : ""}</button>)}
            </div>
          )}
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] border-b border-white/10 bg-[#1b1815] text-[10.5px] uppercase tracking-[0.12em] text-zinc-500 sm:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)]">
            <span className="px-4 py-1.5 sm:px-6">Pasos</span>
            <div className="relative mr-4 h-full sm:mr-6">{marcas.map((m) => <span key={m} className="absolute top-1.5 -translate-x-1/2 whitespace-nowrap normal-case tracking-normal first:translate-x-0 last:-translate-x-full" style={{ left: `${m * 100}%`, ...NUM }}>{m === 0 ? "0" : duracion(tiempo.total * m)}</span>)}</div>
          </div>
          <ol data-arbol className="min-h-0 flex-1 overflow-y-auto py-1">
            {nodos.map((n) => {
              const b = tiempo.barra(n), color = COLOR_DEL_ESTADO[n.estado], activo = n.clave === elegido.clave
              return (
                <li key={n.clave}>
                  <button type="button" data-nodo={n.tipo} data-clave={n.clave} aria-current={activo || undefined} onClick={() => setClave(n.clave)}
                    className={`grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center text-left sm:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)] ${activo ? "bg-amber-500/[0.1]" : "hover:bg-white/[0.03]"}`}>
                    <span className="flex min-w-0 items-center gap-2 py-1.5 pl-4 pr-2 sm:pl-6" style={{ paddingLeft: `calc(${n.nivel * 18}px + 1rem)` }}>
                      {n.nivel > 0 && <span className="h-px w-2.5 shrink-0 bg-white/15" aria-hidden="true" />}
                      <IconoDeEstado estado={n.estado} tam={13} />
                      <span className="min-w-0">
                        <span className={`block truncate text-[13px] ${n.tipo === "corrida" ? "font-medium text-white" : "text-zinc-100"}`}>{n.nombre}</span>
                        <span className="block truncate text-[11px] text-zinc-500" style={NUM}>{[n.sub, duracion(n.duracion_ms), n.tokens ? `${miles(n.tokens)} tokens` : null].filter(Boolean).join(" · ")}</span>
                      </span>
                    </span>
                    <span className="relative mr-4 h-5 sm:mr-6">
                      <span className="absolute inset-y-[9px] left-0 right-0 bg-white/[0.04]" />
                      {b && <span data-barra className="absolute inset-y-[5px] rounded-sm" style={{ left: `${b.izq}%`, width: `${b.ancho}%`, background: `${color}${n.tipo === "corrida" ? "55" : "aa"}`, boxShadow: activo ? `0 0 0 1px ${color}` : undefined }} />}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
          <p data-sin-dato className="border-t border-white/10 px-4 py-2 text-[11.5px] leading-relaxed text-zinc-500 sm:px-6">
            <span className="text-zinc-400">Sin dato todavía:</span> los pasos del proceso que no hace un empleado AI no quedan registrados por corrida (solo aparecen los empleados){detalle.sin_enlace_a_trazas ? " · enlace a la traza completa (la plataforma aún no guarda su identificador)" : ""}
          </p>
        </div>
        <Detalle nodo={elegido} corrida={c} pestana={pestana} setPestana={setPestana} />
      </div>
    </div>
  )
}

function Detalle({ nodo, corrida, pestana, setPestana }: { nodo: Nodo; corrida: Corrida; pestana: Pestana; setPestana: (p: Pestana) => void }) {
  const p = nodo.paso
  const filas: [string, ReactNode][] = nodo.tipo === "paso" && p
    ? [
      ["Empleado", p.agente ? <>{palabras(p.agente)} <span className="text-zinc-500">({p.agente})</span></> : "sin nombre"], ["Modelo", p.modelo ?? "sin dato"], ["Estado", <Estado key="e" estado={nodo.estado} />],
      ["Inicio", cuando(p.inicio)], ["Fin", cuando(nodo.fin)], ["Duración", duracion(nodo.duracion_ms)], ["Tokens de entrada", miles(p.tokens.entrada)], ["Tokens de salida", miles(p.tokens.salida)],
      ["Tokens leídos de la caché", miles(p.tokens.cache_lectura)], ["Tokens escritos en la caché", miles(p.tokens.cache_escritura)], ["Tokens en total", miles(p.tokens_total)], ["Turnos", p.turnos ?? "sin dato"],
      ["Costo", costoComoDato(p.costo_usd)], ["Rama", nodo.rama ? nombreDeLaRama(nodo.rama) : "principal"], ["Registro", p.origen === "despacho" ? "solo el encargo (el empleado no dejó fila)" : "libro de los empleados"],
      ["Identificador", <span key="i" className="break-all">{p.id}</span>], ["Encargo", p.despacho ? <span key="d" className="break-all">{p.despacho}</span> : "sin dato"],
    ]
    : nodo.tipo === "rama"
      ? [["Rama", nodo.nombre], ["Pasos", nodo.sub ?? ""], ["Estado", <Estado key="e" estado={nodo.estado} />], ["Inicio", cuando(nodo.inicio)], ["Duración", duracion(nodo.duracion_ms)], ["Tokens", miles(nodo.tokens)], ["Costo", costoComoDato(nodo.costo_usd)]]
      : [
        ["Proceso", corrida.nombre], ["Cliente", corrida.cliente ?? "sin cliente"], ["Estado", <Estado key="e" estado={corrida.estado} />], ["Inicio", cuando(corrida.inicio)], ["Fin", cuando(corrida.fin)],
        ["Duración", duracion(corrida.duracion_ms)], ["Pasos de empleados", corrida.pasos], ["Encargos", corrida.despachos], ["Ramas", corrida.ramas.length ? corrida.ramas.map(nombreDeLaRama).join(" · ") : "ninguna"],
        ["Tokens", miles(corrida.tokens)], ["Costo", costoComoDato(corrida.costo_usd)], ["Ejecución", corrida.workflow_execution_id], ["Proceso (identificador)", corrida.workflow_id ?? "sin dato"],
      ]
  return (
    <aside data-detalle={nodo.clave} className="flex min-h-0 min-w-0 flex-col">
      <div className="border-b border-white/10 px-4 pt-3 sm:px-6">
        <div className="flex items-center gap-2"><IconoDeEstado estado={nodo.estado} /><h4 className="min-w-0 truncate text-[15px] text-white">{nodo.nombre}</h4></div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Ficha titulo="Duración">{duracion(nodo.duracion_ms)}</Ficha>
          <Ficha titulo="Tokens">{miles(nodo.tokens)}</Ficha>
          <Ficha titulo="Costo">{costoComoDato(nodo.costo_usd)}</Ficha>
          {p?.modelo && <Ficha titulo="Modelo">{p.modelo}</Ficha>}
        </div>
        <div className="mt-3 flex gap-4" role="tablist">
          {PESTANAS.map((t) => (
            <button key={t.id} type="button" role="tab" data-pestana={t.id} aria-selected={pestana === t.id} onClick={() => setPestana(t.id)}
              className={`-mb-px border-b-2 pb-2 text-[13px] ${pestana === t.id ? "border-amber-500 text-amber-100" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>{t.nombre}</button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {nodo.error && <div data-error className="mb-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3"><p className="text-[11px] uppercase tracking-[0.14em] text-rose-300">Error</p><p className="mt-1 whitespace-pre-wrap break-words text-[13px] text-rose-100">{nodo.error}</p></div>}
        {pestana === "metadatos" && (
          <dl data-metadatos className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] gap-x-4 gap-y-2 text-[13px]">
            {filas.map(([k, v]) => <div key={k} className="contents"><dt className="text-zinc-500">{k}</dt><dd className="min-w-0 text-zinc-100" style={NUM}>{v}</dd></div>)}
          </dl>
        )}
        {pestana !== "metadatos" && (
          <div data-sin-texto={pestana} className="rounded-lg border border-dashed border-white/15 p-4">
            <p className="text-[13px] text-zinc-300">Sin dato todavía</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">{SIN_TEXTO} {pestana === "entrada" ? "que entró al empleado (lo que se le pidió y lo que leyó)." : "que devolvió el empleado."}</p>
          </div>
        )}
      </div>
    </aside>
  )
}

export function PanelObservabilidad({ onCerrar, listaInicial = null, detalleInicial = null, fetchImpl = fetch }: { onCerrar: () => void; listaInicial?: ListaDeCorridas | null; detalleInicial?: DetalleDeCorrida | null; fetchImpl?: typeof fetch }) {
  const [dias, setDias] = useState<Dias>(7)
  const [cliente, setCliente] = useState("")
  const [estado, setEstado] = useState<EstadoCorrida | "todas">("todas")
  const [busca, setBusca] = useState("")
  const [lista, setLista] = useState<ListaDeCorridas | null>(listaInicial)
  const [detalle, setDetalle] = useState<DetalleDeCorrida | null>(detalleInicial)
  const [abriendo, setAbriendo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!listaInicial)
  const [conocidos, setConocidos] = useState<Map<string, string>>(new Map())
  const cerrar = useRef<HTMLButtonElement>(null)
  const primera = useRef(!!listaInicial)

  const leer = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      const q = new URLSearchParams({ dias: String(dias) }); if (cliente) q.set("client_id", cliente)
      setLista(await leerJson<ListaDeCorridas>(fetchImpl, `/api/direccion/corridas?${q}`, "las corridas"))
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setCargando(false) }
  }, [dias, cliente, fetchImpl])
  useEffect(() => { if (primera.current) { primera.current = false; return } void leer() }, [leer])
  // los clientes del filtro: los que aparecieron en alguna lectura (no desaparecen al filtrar por uno)
  useEffect(() => { if (!lista) return; setConocidos((m) => { const n = new Map(m); for (const c of lista.corridas) if (c.client_id && c.cliente) n.set(c.client_id, c.cliente); return n.size === m.size ? m : n }) }, [lista])
  const clientes = useMemo(() => [...conocidos.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre)), [conocidos])

  const abrir = useCallback(async (c: Corrida) => {
    setAbriendo(c.workflow_execution_id); setError(null)
    try { setDetalle(await leerJson<DetalleDeCorrida>(fetchImpl, `/api/direccion/corridas/${encodeURIComponent(c.workflow_execution_id)}`, "la corrida")) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setAbriendo(null) }
  }, [fetchImpl])
  const volver = useCallback(() => setDetalle(null), [])

  useEffect(() => { cerrar.current?.focus() }, [])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key !== "Escape") return; e.stopPropagation(); e.preventDefault(); if (detalle) setDetalle(null); else onCerrar() }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar, detalle])

  return (
    <div className="nv-panel fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <style>{".ob-gira{transform-origin:8px 8px;animation:obGira 1s linear infinite}@keyframes obGira{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.ob-gira{animation:none}}"}</style>
      <section role="dialog" aria-modal="true" aria-labelledby="observabilidad-titulo" data-seccion="observabilidad" className="relative flex h-full max-h-full w-full max-w-[1400px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#161412] text-zinc-200 shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <h2 id="observabilidad-titulo" className="font-display text-[15px] font-light uppercase tracking-[0.28em]" style={{ color: AMBAR }}>Observabilidad</h2>
          <p className="text-[12px] text-zinc-400">Cada corrida de los empleados, paso a paso</p>
          {abriendo && <p className="text-[12px] text-zinc-500">Abriendo {abriendo}…</p>}
          <button type="button" onClick={() => void leer()} disabled={cargando} className="ml-auto rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50">{cargando ? "Leyendo…" : "Actualizar"}</button>
          <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar la observabilidad" className="rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">Cerrar · Esc</button>
        </header>
        {error && <p role="alert" className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-[13px] text-rose-200 sm:px-6">{error}</p>}
        {cargando && !lista && <p className="px-6 py-6 text-[13px] text-zinc-500">Leyendo…</p>}
        {detalle
          ? <Traza key={detalle.corrida.workflow_execution_id} detalle={detalle} volver={volver} />
          : lista && <Lista lista={lista} dias={dias} setDias={setDias} cliente={cliente} setCliente={setCliente} clientes={clientes} estado={estado} setEstado={setEstado} busca={busca} setBusca={setBusca} abrir={(c) => void abrir(c)} cargando={cargando} />}
      </section>
    </div>
  )
}
