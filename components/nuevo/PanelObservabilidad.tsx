"use client"

import { BotonVolver } from "@/components/nuevo/BotonVolver"
import { FichaDeRendimiento } from "@/components/nuevo/escena/FichaDeRendimiento"
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { createPortal } from "react-dom"
import {
  COLOR_DEL_ESTADO, ESTADOS, NOMBRE_DEL_ESTADO, TOPE_DEL_TEXTO, arbolDeNodos, clienteVisible, costoComoDato, cuando, duracion, lineaDeTiempo, mayuscula, miles, nombreDeLaRama, palabras,
  type Corrida, type DetalleDeCorrida, type EstadoCorrida, type ListaDeCorridas, type Nodo,
} from "@/lib/direccion-corridas"
import { diaLocal, diasEntre, fechaCorta, PERIODOS, usdCorto, type Dinero, type Periodo } from "@/lib/dinero-completo"
import { BarraHorizontal, CascadaVisible, GRIS, GraficoDeBarras, ROJO } from "@/components/nuevo/ObservabilidadGraficos"
import {
  NOMBRE_DE_AGRUPAR, agrupar, conFallosDelProceso, agruparPorEmpleado, cobertura, costoDeLaCorrida, costoDelPeriodo, costoPorEjecucion, demoraCorta, dondeFallo, enRango, esCorridaInterna, motivoEnPalabras, numerosDe,
  cascadaDe, costoPorCubeta, cubetasDe, desdeDeLaLectura, noLeidas, procesoDe, rotuloDe, rotuloLargo, serieDe, topEmpleados, variacion, ventanaDe,
  type AgruparPor, type Cascada, type DondeFallo, type EmpleadoObs, type Grupo,
} from "@/lib/observabilidad"
import { nombreCanonico } from "@/lib/organigrama"
import type { Rendimiento } from "@/lib/rendimiento"

/**
 * TU OFICINA · PANTALLA 9 · OBSERVABILIDAD.
 * 6.26 · estructura COPIADA de LangSmith (tabla de corridas → árbol de pasos con cascada de tiempos → detalle con pestañas Entrada / Salida / Metadatos).
 * 6.47 · «fácil de leer» (Emilio: «veo una lista gigante, nada user friendly»): una capa de lectura ENCIMA de la tabla, que se conserva.
 *  Arriba el resumen (LangSmith / Langfuse: corridas · % con error · demora típica · costo, con mini gráfico y frente al período anterior), después
 *  «lo que falló» con el motivo en palabras y el salto al paso (Datadog), los grupos por proceso · cliente · empleado (gráficos agrupados de LangSmith),
 *  el trabajo interno oculto por defecto, y los empleados que más fallan y más tardan con la flecha a su ficha de rendimiento (la de CC6).
 * Datos: `/api/direccion/corridas`, `/api/direccion/corridas/{ejecución}`, `/api/direccion/observabilidad` y `/api/direccion/dinero` (el costo, la MISMA cuenta
 * que Dinero). SOLO LECTURA. El costo es un dato, nunca un aviso.
 */
const AMBAR = "#e8731a"
const NUM: CSSProperties = { fontVariantNumeric: "tabular-nums" }
type Pestana = "entrada" | "salida" | "metadatos"
const PESTANAS: { id: Pestana; nombre: string }[] = [{ id: "entrada", nombre: "Entrada" }, { id: "salida", nombre: "Salida" }, { id: "metadatos", nombre: "Metadatos" }]
const CAJA = "rounded-xl border border-white/[0.09] bg-[#1b1815]"
const PERIODO_EN_PALABRAS: Record<Periodo, string> = { hoy: "hoy", "7": "7 días", mes: "este mes", "30": "30 días" }
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

/** ─── 1 · LA LISTA DE CORRIDAS (la tabla «Runs» de LangSmith) · 6.47: segundo nivel, ya filtrada por período, interno y búsqueda ─── */
function Lista({ corridas, titulo, total, cliente, setCliente, clientes, estado, setEstado, abrir, cargando, pie, costoDe }: {
  corridas: Corrida[]; titulo: string; total: number; cliente: string; setCliente: (c: string) => void; clientes: { id: string; nombre: string }[]
  estado: EstadoCorrida | "todas"; setEstado: (e: EstadoCorrida | "todas") => void; abrir: (c: Corrida) => void; cargando: boolean; pie: ReactNode; costoDe: (c: Corrida) => number
}) {
  const visibles = estado === "todas" ? corridas : corridas.filter((c) => c.estado === estado)
  const cuenta = (e: EstadoCorrida) => corridas.filter((c) => c.estado === e).length
  return (
    <div data-vista="lista" className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2 sm:px-6">
        <h3 className="mr-2 text-[14px] text-white">{titulo}</h3>
        <select data-filtro-cliente value={cliente} onChange={(e) => setCliente(e.target.value)} aria-label="Cliente" className="h-8 rounded-md border border-white/10 bg-black/30 px-2 text-[12.5px] text-zinc-200 focus:border-amber-500/60 focus:outline-none">
          <option value="">Todos los clientes</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Estado">
          <Chip data-filtro-estado="todas" activo={estado === "todas"} onClick={() => setEstado("todas")}>Todas <span style={NUM}>{corridas.length}</span></Chip>
          {ESTADOS.map((e) => <Chip key={e} data-filtro-estado={e} activo={estado === e} onClick={() => setEstado(e)}><span style={{ color: COLOR_DEL_ESTADO[e] }}>●</span> {NOMBRE_DEL_ESTADO[e]} <span style={NUM}>{cuenta(e)}</span></Chip>)}
        </div>
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
                <td className="max-w-[340px] py-2 pl-4 pr-3 sm:pl-6"><p className="truncate text-zinc-100">{c.nombre}</p>{c.ramas.length > 0 && <p className="truncate text-[11px] text-zinc-600" style={NUM}>{c.ramas.length} {c.ramas.length === 1 ? "rama" : "ramas"}</p>}</td>
                <td data-cliente={c.interno ? "interno" : c.client_id ?? "ninguno"} className="px-3 py-2 text-zinc-300">{clienteVisible(c) ?? <span className="text-zinc-600">sin cliente</span>}</td>
                <td className="px-3 py-2"><Estado estado={c.estado} /></td>
                <td className="whitespace-nowrap px-3 py-2 text-zinc-400" style={NUM}>{cuando(c.inicio)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-zinc-200" style={NUM}>{duracion(c.duracion_ms)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-zinc-300" style={NUM}>{miles(c.tokens)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-zinc-300" style={NUM}>{costoComoDato(costoDe(c))}</td>
                <td className="whitespace-nowrap px-3 py-2 pr-4 text-right text-zinc-400 sm:pr-6" style={NUM}>{c.pasos}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visibles.length && <p className="px-6 py-8 text-center text-[13px] text-zinc-500">{cargando ? "Leyendo…" : "Ninguna corrida con estos filtros."}</p>}
      </div>
      <div data-sin-dato className="border-t border-white/10 px-4 py-2 text-[12px] leading-relaxed text-zinc-500 sm:px-6">
        <span style={NUM}>Mostrando {visibles.length} de {total} corridas</span>{pie}
        <> · horas en la zona de tu equipo · entrada y salida de cada paso: los primeros {TOPE_DEL_TEXTO.toLocaleString("es-EC")} caracteres</>
      </div>
    </div>
  )
}

/** ─── 2 · UNA CORRIDA: árbol de pasos + cascada de tiempos (izquierda) · 3 · detalle con pestañas (derecha) ─── */
function Traza({ detalle, volver, claveInicial = null, volverA = "Corridas" }: { detalle: DetalleDeCorrida; volver: () => void; /** 6.47 · «ver dónde falló» abre en el paso en rojo */ claveInicial?: string | null; volverA?: string }) {
  const nodos = useMemo(() => arbolDeNodos(detalle), [detalle])
  const tiempo = useMemo(() => lineaDeTiempo(nodos), [nodos])
  const [clave, setClave] = useState(claveInicial ?? "corrida")
  const [pestana, setPestana] = useState<Pestana>("metadatos")
  const elegido = nodos.find((n) => n.clave === clave) ?? nodos[0]
  const errores = nodos.filter((n) => n.tipo === "paso" && n.estado === "fallida")
  const c = detalle.corrida
  const marcas = [0, 0.25, 0.5, 0.75, 1]
  return (
    <div data-vista="traza" className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3 sm:px-6">
        <button type="button" data-volver onClick={volver} className="rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06]">← {volverA}</button>
        <h3 className="min-w-0 truncate text-[15px] text-white">{c.nombre}</h3>
        <Estado estado={c.estado} />
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Ficha titulo="Cliente">{clienteVisible(c) ?? "sin cliente"}</Ficha>
          <Ficha titulo="Inicio">{cuando(c.inicio)}</Ficha>
          <Ficha titulo="Duración">{duracion(c.duracion_ms)}</Ficha>
          <Ficha titulo="Tokens">{miles(c.tokens)}</Ficha>
          <Ficha titulo="Costo">{costoComoDato(c.costo_usd)}</Ficha>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="flex min-h-0 min-w-0 flex-col border-b border-white/10 lg:border-b-0 lg:border-r">
          {c.estado === "atascada" && (
            <div data-atascada role="status" className="border-b border-orange-500/30 bg-orange-500/10 px-4 py-2 text-[12.5px] text-orange-100 sm:px-6">
              Atascada: el trabajo se encargó y nunca dio señales de vida (no dejó fila en el libro de los empleados). También aparece en Riesgos.
            </div>
          )}
          {errores.length > 0 && (
            <div data-errores role="alert" className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 sm:px-6">
              <p className="text-[12.5px] font-medium text-rose-200">{errores.length} {errores.length === 1 ? "paso con error" : "pasos con error"}</p>
              {errores.map((n) => <button key={n.clave} type="button" data-paso-con-error={n.clave} onClick={() => { setClave(n.clave); setPestana("metadatos") }} className="block max-w-full truncate text-left text-[12px] text-rose-200/80 hover:text-rose-100">✕ {n.nombre} · {motivoEnPalabras(n.error, n.estado)}</button>)}
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
      ["Empleado", p.agente ? <>{mayuscula(palabras(p.agente))} <span className="text-zinc-500">({p.agente})</span></> : "sin nombre"], ["Modelo", p.modelo ?? "sin dato"], ["Estado", <Estado key="e" estado={nodo.estado} />],
      ["Inicio", cuando(p.inicio)], ["Fin", cuando(nodo.fin)], ["Duración", duracion(nodo.duracion_ms)], ["Tokens de entrada", miles(p.tokens.entrada)], ["Tokens de salida", miles(p.tokens.salida)],
      ["Tokens leídos de la caché", miles(p.tokens.cache_lectura)], ["Tokens escritos en la caché", miles(p.tokens.cache_escritura)], ["Tokens en total", miles(p.tokens_total)], ["Turnos", p.turnos ?? "sin dato"],
      ["Costo", costoComoDato(p.costo_usd)], ["Rama", nodo.rama ? nombreDeLaRama(nodo.rama) : "principal"], ["Registro", p.origen === "despacho" ? "solo el encargo (el empleado no dejó fila)" : p.origen === "registro" ? "paso del proceso (tablas de la jefatura, la oficina o el plan)" : "libro de los empleados"],
      ["Identificador", <span key="i" className="break-all">{p.id}</span>], ["Encargo", p.despacho ? <span key="d" className="break-all">{p.despacho}</span> : "sin dato"],
    ]
    : nodo.tipo === "rama"
      ? [["Rama", nodo.nombre], ["Pasos", nodo.sub ?? ""], ["Estado", <Estado key="e" estado={nodo.estado} />], ["Inicio", cuando(nodo.inicio)], ["Duración", duracion(nodo.duracion_ms)], ["Tokens", miles(nodo.tokens)], ["Costo", costoComoDato(nodo.costo_usd)]]
      : [
        ["Proceso", corrida.nombre], ["Nombre técnico", <span key="t" className="break-all">{corrida.nombre_tecnico ?? "sin dato"}</span>], ["Cliente", clienteVisible(corrida) ?? "sin cliente"], ["Estado", <Estado key="e" estado={corrida.estado} />], ["Inicio", cuando(corrida.inicio)], ["Fin", cuando(corrida.fin)],
        ["Duración", duracion(corrida.duracion_ms)], ["Pasos de empleados", corrida.pasos], ["Encargos", corrida.despachos], ["Ramas", corrida.ramas.length ? corrida.ramas.map(nombreDeLaRama).join(" · ") : "ninguna"],
        ["Tokens", miles(corrida.tokens)], ["Costo", costoComoDato(corrida.costo_usd)], [corrida.miembros ? "Ejecuciones del pedido" : "Ejecución", corrida.miembros ? corrida.miembros.join(" · ") : corrida.workflow_execution_id], ["Proceso (identificador)", corrida.workflow_id ?? "sin dato"],
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
        {(nodo.error || nodo.estado === "fallida" || nodo.estado === "atascada") && nodo.tipo === "paso" && (
          <div data-error className="mb-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-rose-300">Por qué falló</p>
            <p data-motivo className="mt-1 text-[14px] text-rose-50">{mayuscula(motivoEnPalabras(nodo.error, nodo.estado))}</p>
            {nodo.error && <details data-texto-tecnico className="mt-2"><summary className="cursor-pointer text-[12px] text-rose-200/70 hover:text-rose-100">Ver el texto técnico</summary><p className="mt-1 whitespace-pre-wrap break-words font-mono text-[12px] text-rose-100/90">{nodo.error}</p></details>}
          </div>
        )}
        {pestana === "metadatos" && (
          <dl data-metadatos className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] gap-x-4 gap-y-2 text-[13px]">
            {filas.map(([k, v]) => <div key={k} className="contents"><dt className="text-zinc-500">{k}</dt><dd className="min-w-0 text-zinc-100" style={NUM}>{v}</dd></div>)}
          </dl>
        )}
        {pestana !== "metadatos" && <Texto nodo={nodo} pestana={pestana} />}
      </div>
    </aside>
  )
}

/** 6.27 · la pestaña Entrada / Salida: el texto que guarda el libro de los empleados, tal cual; lo que no existe se dice */
function Texto({ nodo, pestana }: { nodo: Nodo; pestana: "entrada" | "salida" }) {
  const p = nodo.paso
  const texto = p ? (pestana === "entrada" ? p.entrada : p.salida) : null
  if (!texto) {
    const motivo = nodo.tipo !== "paso"
      ? "La entrada y la salida se ven en cada paso: elige un empleado del árbol."
      : p?.origen === "registro"
        ? "Este paso lo hace el proceso, no un empleado AI: no tiene texto propio."
        : p?.origen === "despacho"
        ? "Este encargo no dejó fila en el libro de los empleados, así que no hay texto que mostrar."
        : pestana === "entrada"
          ? "Este empleado no guarda lo que se le pidió: su registro solo trae la respuesta y las cifras."
          : "Este paso no guardó su respuesta."
    return (
      <div data-sin-texto={pestana} className="rounded-lg border border-dashed border-white/15 p-4">
        <p className="text-[13px] text-zinc-300">Sin dato todavía</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">{motivo}</p>
      </div>
    )
  }
  const tope = TOPE_DEL_TEXTO.toLocaleString("es-EC")
  const nota = pestana === "entrada"
    ? (p?.entrada_recortada ? `Se guardan los primeros ${tope} caracteres de lo que se le pidió; el resto no queda registrado.` : null)
    : p?.salida_total && p.salida_total > texto.length ? `Se guardan los primeros ${tope} caracteres de ${miles(p.salida_total)}.` : p?.salida_total == null ? `Se guardan como máximo ${tope} caracteres.` : null
  return (
    <div>
      {nota && <p data-recorte={pestana} className="mb-2 text-[12px] text-zinc-500">{nota}</p>}
      <pre data-texto={pestana} className="whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-[12px] leading-relaxed text-zinc-200">{texto}</pre>
    </div>
  )
}

/** ─── 6.47 · LA CAPA DE LECTURA ─── */
/** ─── 6.49 · OBSERVABILIDAD VISUAL: el encabezado de cada gráfico es su cifra grande ─── */
const TITULO_CHICO = "text-[13px] font-medium uppercase tracking-[0.12em] text-[#ffc07a]"
const CIFRA = "text-[30px] font-light leading-tight text-white"
const Punto = ({ color }: { color: string }) => <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />

function Encabezado({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <>
      <h3 className={TITULO_CHICO}>{titulo}</h3>
      <div className="mb-1 mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">{children}</div>
    </>
  )
}
/** frente al período anterior: solo cuando hay con qué comparar (si no, lo dice una vez la línea gris de arriba) */
function Frente({ vs, nombre, sube_es_malo = true }: { vs: { texto: string; sube: boolean } | null; nombre: string; sube_es_malo?: boolean }) {
  if (!vs) return null
  const color = vs.texto === "igual" ? "#a1a1aa" : vs.sube === sube_es_malo ? "#ffb86b" : "#7fc99a"
  return <span data-frente-al-anterior className="text-[14px]" style={{ color }}>{vs.texto === "igual" ? `igual que ${nombre}` : `${vs.texto} frente a ${nombre}`}</span>
}

function LoQueFallo({ fallas, donde, cascadas, periodo, abrirEn }: {
  fallas: Corrida[]; donde: Map<string, DondeFallo | "leyendo" | "sin_lectura">; cascadas: Map<string, Cascada | null>; periodo: string; abrirEn: (c: Corrida, clave: string | null) => void
}) {
  const titulo = <h3 className={`mr-1 ${TITULO_CHICO}`}>Lo que falló <span style={NUM}>({fallas.length})</span></h3>
  return (
    <section data-lo-que-fallo className={`${CAJA} px-4 py-2.5`}>
      {!fallas.length ? <div className="flex flex-wrap items-baseline gap-3">{titulo}<p data-sin-errores className="text-[14px] text-[#8fd19e]">Sin errores en {periodo} ✓</p></div> : (
        <ul className="flex flex-col gap-2.5">
          {fallas.map((c, i) => {
            const id = c.workflow_execution_id, d = donde.get(id), listo = d && d !== "leyendo" && d !== "sin_lectura" ? d : null
            const quien = listo?.nombre ? listo.nombre.split(" · ")[0] : null, cas = i === 0 ? cascadas.get(id) : undefined
            return (
              <li key={id} data-falla={id}>
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  {i === 0 && titulo}
                  <span className="text-[#ff5a36]">✕</span>
                  <span className="text-[14px] text-zinc-50" title={c.nombre}>{procesoDe(c)}</span>
                  <span className="text-[13.5px] text-zinc-300" style={NUM}>· {[clienteVisible(c), cuando(c.inicio).replace(/:\d{2}$/, "")].filter(Boolean).join(" · ")}</span>
                  <span data-motivo className="text-[13.5px] text-[#ff9b85]">
                    {d === "leyendo" || !d ? "Leyendo el motivo…" : d === "sin_lectura" ? `«${motivoEnPalabras(null, c.estado)}» · no pude leer sus pasos` : `«${listo!.motivo}»`}
                  </span>
                  {listo?.paso ? <span className="text-[13px] text-zinc-500" style={NUM}>· paso {listo.paso} de {listo.de}{quien ? ` · ${quien}` : ""}</span> : null}
                  <button type="button" data-ver-donde-fallo={id} onClick={() => abrirEn(c, listo?.clave ?? null)}
                    className="ml-auto shrink-0 self-center rounded-md border border-rose-400/45 bg-rose-500/10 px-3 py-1 text-[13px] text-rose-50 hover:bg-rose-500/20">Ver completa →</button>
                </div>
                {i === 0 && (cas ? <CascadaVisible c={cas} alTocar={(k) => abrirEn(c, k)} /> : cas === undefined && d === "leyendo" ? <p className="mt-1 text-[12px] text-zinc-500">Leyendo sus pasos…</p> : null)}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

type Medida = "costo" | "corridas"
const PLURAL_DE: Record<AgruparPor, string> = { proceso: "procesos", cliente: "clientes", empleado: "empleados" }

function Grupos({ grupos, por, setPor, abierto, setAbierto, abrir, costoDe, oculto, mostrarInterno, empleadosListos }: {
  grupos: Grupo[]; por: AgruparPor; setPor: (p: AgruparPor) => void; abierto: string | null; setAbierto: (k: string | null) => void; abrir: (c: Corrida) => void; costoDe: (c: Corrida) => number
  oculto: { corridas: number; costo: number | null } | null; mostrarInterno: () => void; empleadosListos: boolean
}) {
  const [medida, setMedida] = useState<Medida>("costo")
  const [todos, setTodos] = useState(false)
  const cuenta = (g: Grupo) => (por === "empleado" ? g.llamadas ?? g.numeros.corridas : g.numeros.corridas)
  const valor = (g: Grupo) => (medida === "costo" ? g.costo : cuenta(g))
  const orden = [...grupos].sort((a, b) => valor(b) - valor(a) || b.numeros.con_error - a.numeros.con_error)
  const mayor = Math.max(0, ...orden.map(valor))
  const visibles = todos ? orden : orden.slice(0, 4), resto = orden.slice(4)
  const unidad = por === "empleado" ? ["llamada", "llamadas"] : ["corrida", "corridas"]
  return (
    <section data-grupos={por} className={`${CAJA} px-4 py-2.5`}>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <h3 className={TITULO_CHICO}>Por {NOMBRE_DE_AGRUPAR[por].toLocaleLowerCase("es")}</h3>
        <span className="hidden text-[12px] text-zinc-500 sm:inline">largo = {medida === "costo" ? "costo" : unidad[1]} · tramo rojo = {unidad[1]} con error</span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {(["costo", "corridas"] as Medida[]).map((m) => (
            <Chip key={m} activo={medida === m} onClick={() => setMedida(m)} data-medir-por={m}>{m === "costo" ? "Costo" : mayuscula(unidad[1])}</Chip>
          ))}
          <label className="ml-1 flex items-center gap-2 text-[12.5px] text-zinc-400">Agrupar por
            <select data-agrupar-por value={por} onChange={(e) => { setPor(e.target.value as AgruparPor); setAbierto(null) }} className="h-8 rounded-md border border-white/10 bg-black/30 px-2 text-[13px] text-zinc-100 focus:border-amber-500/60 focus:outline-none">
              {(Object.keys(NOMBRE_DE_AGRUPAR) as AgruparPor[]).map((k) => <option key={k} value={k}>{NOMBRE_DE_AGRUPAR[k]}</option>)}
            </select>
          </label>
        </div>
      </div>
      {por === "empleado" && !empleadosListos ? <p className="py-3 text-[13px] text-zinc-500">Leyendo a los empleados…</p> : !grupos.length ? <p className="py-3 text-[13px] text-zinc-500">Ninguna corrida con estos filtros.</p> : (
        <ul>
          {visibles.map((g) => {
            const abre = abierto === g.clave, n = g.numeros, cu = cuenta(g)
            const interno = g.corridas.length > 0 && g.corridas.every(esCorridaInterna)
            return (
              <li key={g.clave} data-grupo={g.clave}>
                <button type="button" aria-expanded={abre} onClick={() => setAbierto(abre ? null : g.clave)} title="Tocar para ver sus corridas"
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1 rounded-md py-[5px] text-left hover:bg-white/[0.03] sm:grid-cols-[170px_minmax(0,1fr)_250px]">
                  <span className="flex min-w-0 items-center gap-1.5 text-[14px] text-zinc-50"><span className={`text-[11px] text-zinc-500 transition-transform ${abre ? "rotate-90" : ""}`}>▸</span><span className="truncate" title={g.nombre}>{g.nombre}</span></span>
                  <span className="order-last col-span-2 sm:order-none sm:col-span-1">
                    <BarraHorizontal pct={mayor > 0 ? (valor(g) / mayor) * 100 : 0} rojo={cu > 0 ? (n.con_error / cu) * 100 : 0} color={interno ? GRIS : AMBAR} />
                  </span>
                  <span className="whitespace-nowrap text-right text-[13px] text-zinc-300 sm:text-left" style={NUM}>
                    {usdCorto(g.costo)} · {cu} {cu === 1 ? unidad[0] : unidad[1]}
                    <span data-errores-del-grupo={n.con_error} className="text-[#ff8a6a]">{n.con_error ? ` · ${n.con_error} con error` : ""}</span>
                  </span>
                </button>
                {abre && (
                  <ul data-corridas-del-grupo className="mb-2 ml-5 divide-y divide-white/[0.04] rounded-lg border border-white/[0.06] bg-black/20">
                    {!g.corridas.length && <li className="px-3 py-2 text-[12.5px] text-zinc-500">Sus corridas de este período no llegaron en la lectura.</li>}
                    {g.corridas.map((c) => (
                      <li key={c.workflow_execution_id}>
                        <button type="button" data-corrida={c.workflow_execution_id} onClick={() => abrir(c)} className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-amber-500/[0.06] sm:flex-row sm:items-center sm:gap-4">
                          <span className="min-w-0 flex-1 text-[13.5px] text-zinc-100">{c.nombre}</span>
                          <span className="flex flex-wrap items-center gap-x-3 text-[12.5px] text-zinc-400" style={NUM}><Estado estado={c.estado} /><span>{clienteVisible(c) ?? "sin cliente"}</span><span>{cuando(c.inicio)}</span><span>{duracion(c.duracion_ms)}</span><span className="text-zinc-200">{costoComoDato(costoDe(c))}</span></span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
        {resto.length > 0 && (
          <button type="button" data-ver-mas-grupos onClick={() => setTodos(!todos)} className="text-zinc-400 underline underline-offset-[3px] hover:text-zinc-200" style={NUM}>
            {todos ? "Ver solo los 4 primeros" : `+ ${resto.length} ${PLURAL_DE[por]} más · ${usdCorto(Math.round(resto.reduce((s, g) => s + g.costo, 0) * 100) / 100)} →`}
          </button>
        )}
        {oculto && oculto.corridas > 0 && (
          <p data-interno-oculto className="text-[12.5px] text-zinc-500" style={NUM}>(interno oculto: {oculto.corridas} {oculto.corridas === 1 ? "corrida" : "corridas"} · {oculto.costo == null ? "…" : usdCorto(oculto.costo)} <button type="button" onClick={mostrarInterno} className="text-amber-200 underline underline-offset-2 hover:text-amber-100">mostrar</button>)</p>
        )}
      </div>
    </section>
  )
}

function Empleados({ top, verFicha, conFicha }: { top: { fallan: EmpleadoObs[]; tardan: EmpleadoObs[] } | null; verFicha: (e: EmpleadoObs) => void; conFicha: (slug: string) => boolean | null }) {
  const Fila = ({ e, pct, color, dato }: { e: EmpleadoObs; pct: number; color: string; dato: ReactNode }) => {
    const f = conFicha(e.slug)
    return (
      <li data-empleado-obs={e.slug} className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_auto_28px] items-center gap-3 py-[5px]">
        <span className="truncate text-[14px] text-zinc-100" title={e.nombre}>{e.nombre}</span>
        <BarraHorizontal pct={pct} color={color} alto={16} />
        <span className="whitespace-nowrap text-[13px] text-zinc-300" style={NUM}>{dato}</span>
        <button type="button" data-ficha-de={e.slug} disabled={f === false} onClick={() => verFicha(e)} aria-label={`Ver la ficha de rendimiento de ${e.nombre}`} title={f === false ? "Todavía no tiene ficha de rendimiento" : "Ver su ficha de rendimiento"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/15 text-amber-200 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-30">→</button>
      </li>
    )
  }
  const maxErr = Math.max(1, ...(top?.fallan ?? []).map((e) => e.errores)), maxMs = Math.max(1, ...(top?.tardan ?? []).map((e) => e.mediana_ms ?? 0))
  return (
    <section data-empleados-obs className="grid gap-3 md:grid-cols-2">
      <div className={`${CAJA} px-4 py-3`}>
        <h3 className={`mb-1.5 ${TITULO_CHICO}`} style={{ color: "#ff9b85" }}>Los que más fallan</h3>
        {!top ? <p className="text-[13px] text-zinc-500">Leyendo a los empleados…</p> : top.fallan.length
          ? <ul data-top="fallan">{top.fallan.map((e) => <Fila key={e.slug} e={e} pct={(e.errores / maxErr) * 100} color={ROJO} dato={<>{e.errores} {e.errores === 1 ? "fallo" : "fallos"} de {e.llamadas}</>} />)}</ul>
          : <p className="text-[13px] text-[#8fd19e]">Ningún empleado falló ✓</p>}
      </div>
      <div className={`${CAJA} px-4 py-3`}>
        <h3 className={`mb-1.5 ${TITULO_CHICO}`}>Los que más tardan</h3>
        {!top ? <p className="text-[13px] text-zinc-500">Leyendo a los empleados…</p> : top.tardan.length
          ? <ul data-top="tardan">{top.tardan.map((e) => <Fila key={e.slug} e={e} pct={((e.mediana_ms ?? 0) / maxMs) * 100} color={AMBAR} dato={<span title={e.max_ms != null ? `la más lenta: ${demoraCorta(e.max_ms)}` : undefined}>{demoraCorta(e.mediana_ms)} típica</span>} />)}</ul>
          : <p className="text-[13px] text-zinc-500">Sin dato de demora todavía.</p>}
      </div>
    </section>
  )
}

const cortadaDe = (l: ListaDeCorridas | null) => !!l && (l.ejecuciones_total ?? l.total) > (l.ejecuciones_leidas ?? l.corridas.length)
type DatosDeEmpleados = { todo: EmpleadoObs[]; sin_interno: EmpleadoObs[] }
type Vista = "resumen" | "todas"

export function PanelObservabilidad({ onCerrar, listaInicial = null, detalleInicial = null, fetchImpl = fetch, corridaInicial = null, alVolver, hoy: hoyFijo, dineroInicial = null, empleadosInicial = null, vistaInicial = "resumen", internoInicial = false }: {
  /** 6.44 · abierta desde Dinero: la flecha regresa a Dinero */ alVolver?: () => void; onCerrar: () => void; listaInicial?: ListaDeCorridas | null; detalleInicial?: DetalleDeCorrida | null; fetchImpl?: typeof fetch
  /** 6.36 · Dinero abre aquí la corrida de un pico */ corridaInicial?: string | null
  /** 6.47 · para pruebas: el día (Ecuador), Dinero, los empleados, la vista y el interruptor de interno */ hoy?: string; dineroInicial?: Dinero | null; empleadosInicial?: DatosDeEmpleados | null; vistaInicial?: Vista; internoInicial?: boolean
}) {
  const hoy = useMemo(() => hoyFijo ?? diaLocal(new Date().toISOString()), [hoyFijo])
  const [periodo, setPeriodo] = useState<Periodo>("7")
  const v = useMemo(() => ventanaDe(periodo, hoy), [periodo, hoy])
  const [vista, setVista] = useState<Vista>(vistaInicial)
  const [por, setPor] = useState<AgruparPor>("proceso")
  const [abierto, setAbierto] = useState<string | null>(null)
  const [conInterno, setConInterno] = useState(internoInicial)
  const [cliente, setCliente] = useState("")
  const [estado, setEstado] = useState<EstadoCorrida | "todas">("todas")
  const [busca, setBusca] = useState("")
  const [lista, setLista] = useState<ListaDeCorridas | null>(listaInicial)
  /** 6.47 · la lectura del período MÁS el anterior, solo para comparar (la del período va aparte: así el tope de 200 no se la come el anterior) */
  const [listaAnt, setListaAnt] = useState<ListaDeCorridas | null>(listaInicial)
  const [dinero, setDinero] = useState<Dinero | null>(dineroInicial)
  const [empleados, setEmpleados] = useState<DatosDeEmpleados | null>(empleadosInicial)
  const [rendimiento, setRendimiento] = useState<Record<string, Rendimiento> | null>(null)
  const [ficha, setFicha] = useState<EmpleadoObs | null>(null)
  const [donde, setDonde] = useState<Map<string, DondeFallo | "leyendo" | "sin_lectura">>(new Map())
  /** 6.49 · la cascada de cada corrida con error (sale de la misma lectura de sus pasos que «dónde falló») */
  const [cascadas, setCascadas] = useState<Map<string, Cascada | null>>(new Map())
  const [detalle,setDetalle] = useState<DetalleDeCorrida | null>(detalleInicial)
  const [claveInicial, setClaveInicial] = useState<string | null>(null)
  const [abriendo, setAbriendo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!listaInicial)
  const [cargaMs, setCargaMs] = useState<number | null>(null)
  const [partes, setPartes] = useState<{ corridas?: number; costo?: number }>({})
  const [conocidos, setConocidos] = useState<Map<string, string>>(new Map())
  const cerrar = useRef<HTMLButtonElement>(null)
  const primera = useRef(!!listaInicial)

  // el costo: lo mismo que lee Dinero (una sola lectura de 62 días; el período se recorta aquí con la misma función)
  const dineroEnCamino = useRef<Promise<void> | null>(null)
  const leerDinero = useCallback(() => {
    if (dineroInicial) return Promise.resolve()
    dineroEnCamino.current ??= leerJson<Dinero>(fetchImpl, "/api/direccion/dinero", "el costo").then(setDinero, () => { dineroEnCamino.current = null })
    return dineroEnCamino.current
  }, [fetchImpl, dineroInicial])
  // el período, el período + el anterior, los empleados y el costo, en paralelo; el tiempo de carga (hasta la última cifra) se mide y se muestra
  const leer = useCallback(async () => {
    setCargando(true); setError(null); setCargaMs(null); setPartes({}); const t0 = performance.now(), ms = () => Math.round(performance.now() - t0)
    const q = (dias: number) => { const x = new URLSearchParams({ dias: String(dias) }); if (cliente) x.set("client_id", cliente); return `/api/direccion/corridas?${x}` }
    const lis = leerJson<ListaDeCorridas>(fetchImpl, q(v.dias_periodo), "las corridas").then((l) => { setLista(l); setPartes((p) => ({ ...p, corridas: ms() })) })
    const ant = (v.dias > v.dias_periodo ? leerJson<ListaDeCorridas>(fetchImpl, q(v.dias), "las corridas del período anterior") : Promise.resolve(null)).then(setListaAnt, () => setListaAnt(null))
    const emp = leerJson<DatosDeEmpleados>(fetchImpl, `/api/direccion/observabilidad?desde=${v.r.desde}&hasta=${v.r.hasta}`, "a los empleados").then(setEmpleados).catch(() => setEmpleados({ todo: [], sin_interno: [] }))
    const din = leerDinero().then(() => setPartes((p) => ({ ...p, costo: ms() })))
    try { await Promise.all([lis, ant, emp, din]); setCargaMs(ms()) } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setCargando(false) }
  }, [v, cliente, fetchImpl, leerDinero])
  useEffect(() => { if (primera.current) { primera.current = false; return } void leer() }, [leer])
  // las fichas de rendimiento (las de CC6): se leen al abrir, así la flecha sabe de antemano quién tiene ficha
  useEffect(() => {
    if (listaInicial) return
    let vivo = true
    leerJson<{ empleados: Record<string, Rendimiento> }>(fetchImpl, "/api/rendimiento", "las fichas").then((j) => { if (vivo) setRendimiento(j.empleados) }, () => { if (vivo) setRendimiento({}) })
    return () => { vivo = false }
  }, [fetchImpl, listaInicial])
  useEffect(() => { if (!lista) return; setConocidos((m) => { const n = new Map(m); for (const c of lista.corridas) if (c.client_id && c.cliente) n.set(c.client_id, c.cliente); return n.size === m.size ? m : n }) }, [lista])
  const clientes = useMemo(() => [...conocidos.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre)), [conocidos])

  // ─── las cifras ───
  const b = busca.trim().toLowerCase()
  const todas = useMemo(() => (lista?.corridas ?? []).filter((c) => !b || [c.nombre, clienteVisible(c) ?? "", c.nombre_tecnico ?? "", c.workflow_execution_id].some((x) => x.toLowerCase().includes(b))), [lista, b])
  const visibles = useMemo(() => (conInterno ? todas : todas.filter((c) => !esCorridaInterna(c))), [todas, conInterno])
  const delPeriodo = useMemo(() => visibles.filter((c) => enRango(c, v.r)), [visibles, v])
  const filtrar = useCallback((l: ListaDeCorridas | null) => (l?.corridas ?? []).filter((c) => (!b || [c.nombre, clienteVisible(c) ?? "", c.nombre_tecnico ?? "", c.workflow_execution_id].some((x) => x.toLowerCase().includes(b))) && (conInterno || !esCorridaInterna(c))), [b, conInterno])
  const delAnterior = useMemo(() => filtrar(listaAnt).filter((c) => enRango(c, v.ant)), [filtrar, listaAnt, v])
  const cob = useMemo(() => cobertura(lista?.corridas ?? [], cortadaDe(lista), v.dias_periodo, v.r.desde, hoy), [lista, v, hoy])
  const cobAnt = useMemo(() => (listaAnt ? cobertura(listaAnt.corridas, cortadaDe(listaAnt), v.dias, v.ant.desde, hoy) : null), [listaAnt, v, hoy])
  const n = useMemo(() => numerosDe(delPeriodo), [delPeriodo])
  const na = useMemo(() => (cobAnt?.cubre ? numerosDe(delAnterior) : null), [cobAnt, delAnterior])
  const costo = useMemo(() => (dinero ? costoDelPeriodo(dinero, v, hoy, conInterno) : null), [dinero, v, hoy, conInterno])
  const costoCon = useMemo(() => (dinero && !conInterno ? costoDelPeriodo(dinero, v, hoy, true) : null), [dinero, v, hoy, conInterno])
  const porEj = useMemo(() => (dinero ? costoPorEjecucion(dinero) : null), [dinero])
  const costoDe = useCallback((c: Corrida) => costoDeLaCorrida(c, porEj), [porEj])
  const fallosDelProceso = useMemo(() => [...donde.values()].flatMap((d) => (d !== "leyendo" && d !== "sin_lectura" ? [d] : [])), [donde])
  const emp = useMemo(() => (empleados ? conFallosDelProceso(conInterno ? empleados.todo : empleados.sin_interno, fallosDelProceso, nombreCanonico) : null), [empleados, conInterno, fallosDelProceso])
  const grupos = useMemo(() => (por === "empleado" ? (emp ? agruparPorEmpleado(emp, delPeriodo, v.r) : []) : agrupar(delPeriodo, por, porEj, v.r)), [por, emp, delPeriodo, porEj, v])
  const top = useMemo(() => (emp ? topEmpleados(emp) : null), [emp])
  const fallas = useMemo(() => delPeriodo.filter((c) => c.estado === "fallida" || c.estado === "atascada").sort((x, y) => (y.inicio ?? "").localeCompare(x.inicio ?? "")), [delPeriodo])
  const internas = useMemo(() => (conInterno ? [] : todas.filter((c) => esCorridaInterna(c) && enRango(c, v.r))), [todas, conInterno, v])
  // ─── 6.49 · las series de los gráficos grandes (por día; por hora si el período es Hoy) ───
  const k = useMemo(() => cubetasDe(v), [v])
  const porCubeta = useMemo(() => serieDe(delPeriodo, k, (xs) => ({ total: xs.length, con_error: xs.filter((c) => c.estado === "fallida").length, mediana_ms: numerosDe(xs).mediana_ms })), [delPeriodo, k])
  const noLeido = useMemo(() => noLeidas(k, desdeDeLaLectura(lista?.corridas ?? [], cortadaDe(lista)), v.r.desde), [k, lista, v])
  const costoSerie = useMemo(() => (dinero ? costoPorCubeta(dinero, v, k, conInterno) : k.rotulos.map(() => 0)), [dinero, v, k, conInterno])
  const maxDemora = Math.max(0, ...porCubeta.map((x) => x.mediana_ms ?? 0)), enMinutos = maxDemora >= 120000, unidadDemora = enMinutos ? 60000 : 1000

  // ─── dónde falló cada corrida con error: se lee su traza (solo las del período, hasta 12) ───
  useEffect(() => {
    const faltan = fallas.slice(0, 12).filter((c) => !donde.has(c.workflow_execution_id))
    if (!faltan.length) return
    setDonde((m) => { const x = new Map(m); for (const c of faltan) x.set(c.workflow_execution_id, "leyendo"); return x })
    for (const c of faltan) {
      leerJson<DetalleDeCorrida>(fetchImpl, `/api/direccion/corridas/${encodeURIComponent(c.workflow_execution_id)}`, "la corrida")
        .then((d) => { setDonde((m) => new Map(m).set(c.workflow_execution_id, dondeFallo(d))); setCascadas((m) => new Map(m).set(c.workflow_execution_id, cascadaDe(d))) }, () => setDonde((m) => new Map(m).set(c.workflow_execution_id, "sin_lectura")))
    }
  }, [fallas, donde, fetchImpl])

  const abrir = useCallback(async (c: Corrida, clave: string | null = null) => {
    setAbriendo(c.nombre); setError(null)
    try { const d = await leerJson<DetalleDeCorrida>(fetchImpl, `/api/direccion/corridas/${encodeURIComponent(c.workflow_execution_id)}`, "la corrida"); setClaveInicial(clave ?? dondeFallo(d).clave); setDetalle(d) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setAbriendo(null) }
  }, [fetchImpl])
  useEffect(() => {
    if (!corridaInicial) return
    setAbriendo("la corrida")
    leerJson<DetalleDeCorrida>(fetchImpl, `/api/direccion/corridas/${encodeURIComponent(corridaInicial)}`, "la corrida").then(setDetalle, (e) => setError(e instanceof Error ? e.message : String(e))).finally(() => setAbriendo(null))
  }, [corridaInicial, fetchImpl])
  const volver = useCallback(() => { setDetalle(null); setClaveInicial(null) }, [])

  // la ficha de rendimiento (la de CC6): se lee al tocar la primera flecha
  const verFicha = useCallback((e: EmpleadoObs) => setFicha(e), [])
  const conFicha = useCallback((slug: string) => (rendimiento ? !!rendimiento[nombreCanonico(slug)] : null), [rendimiento])
  const rFicha = ficha && rendimiento ? rendimiento[nombreCanonico(ficha.slug)] ?? null : null
  useEffect(() => { if (ficha && rendimiento && !rFicha) setFicha(null) }, [ficha, rendimiento, rFicha])

  useEffect(() => { cerrar.current?.focus() }, [])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key !== "Escape" || ficha) return; e.stopPropagation(); e.preventDefault(); if (detalle) volver(); else if (vista === "todas") setVista("resumen"); else onCerrar() }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar, detalle, vista, ficha, volver])

  const enPalabras = PERIODO_EN_PALABRAS[periodo]
  // 6.48 · por qué no hay comparación, dicho UNA vez arriba (cuando CC1 publique la lectura agregada, esto desaparece solo: la lectura alcanzará)
  const sinComparacion = diasEntre(v.ant.desde, hoy).length > 30 ? "la plataforma lee como máximo 30 días hacia atrás" : listaAnt && !cobAnt?.cubre ? "la plataforma entrega 200 ejecuciones por lectura y el período anterior no entra" : null
  const sobre = !cob.cubre ? `sobre las últimas ${lista?.ejecuciones_leidas ?? lista?.corridas.length ?? 0} ejecuciones (desde el ${cob.desde_dia ? fechaCorta(cob.desde_dia) : "—"})` : null
  // 6.49 · si ya se dijo «sobre las últimas 200», el porqué de la falta de comparación sobra: una sola línea gris
  const porQueSinComparar = sobre && sinComparacion?.startsWith("la plataforma entrega 200") ? null : sinComparacion
  const vsN = (a: number | null, b: number | null) => (na ? variacion(a, b) : null)
  const contra = v.ant.nombre
  const usdEje = (x: number) => `US$ ${x.toLocaleString("es-EC", { minimumFractionDigits: Number.isInteger(x) ? 0 : Number.isInteger(x * 10) ? 1 : 2, maximumFractionDigits: 2 })}`
  const tituloDe = (que: string) => `${que} por ${k.porHora ? "hora" : "día"}`

  return (
    <div className="nv-panel fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-1.5 sm:p-2" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <style>{".ob-gira{transform-origin:8px 8px;animation:obGira 1s linear infinite}@keyframes obGira{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.ob-gira{animation:none}}"}</style>
      <section role="dialog" aria-modal="true" aria-labelledby="observabilidad-titulo" data-seccion="observabilidad" data-pantalla-completa className="relative flex h-full max-h-full w-full flex-col overflow-hidden rounded-xl border border-white/10 bg-[#161412] text-zinc-200 shadow-2xl">
        {/* 6.49 · un solo renglón arriba (título, período, interno, búsqueda, «ver todas»): el alto queda para los gráficos */}
        <header className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-white/10 px-4 py-2.5 sm:px-5">
          {alVolver && <BotonVolver alVolver={alVolver} a="Dinero" />}
          <h2 id="observabilidad-titulo" className="mr-1.5 font-display text-[15px] font-light uppercase tracking-[0.28em]" style={{ color: AMBAR }}>Observabilidad</h2>
          {!detalle && (
            <div data-controles className="order-last flex w-full min-w-0 flex-wrap items-center gap-2 lg:order-none lg:w-auto lg:flex-1">
              <div className="flex flex-wrap gap-1" role="group" aria-label="Período">
                {PERIODOS.map((p) => <button key={p.k} type="button" data-periodo={p.k} aria-pressed={periodo === p.k} onClick={() => { setPeriodo(p.k); setAbierto(null) }} className={`rounded-full border px-2.5 py-1 text-[12.5px] ${periodo === p.k ? "border-amber-500/60 bg-amber-500/10 text-zinc-100" : "border-white/10 text-zinc-400 hover:text-zinc-200"}`}>{p.t}</button>)}
              </div>
              <label className="flex cursor-pointer items-center gap-2 rounded-full border border-white/10 px-2.5 py-1 text-[12.5px] text-zinc-300 hover:border-white/20">
                <input type="checkbox" data-mostrar-interno checked={conInterno} onChange={(e) => setConInterno(e.target.checked)} className="accent-amber-500" />Mostrar interno
              </label>
              <input data-busca type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar proceso, cliente o ejecución"
                className="h-8 w-full min-w-0 rounded-md border border-white/10 bg-black/30 px-3 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/60 focus:outline-none sm:w-[250px]" />
              <button type="button" data-ver-todas onClick={() => setVista(vista === "todas" ? "resumen" : "todas")} className="rounded-md border border-white/15 px-2.5 py-1 text-[12.5px] text-zinc-200 hover:bg-white/[0.06] sm:ml-auto">{vista === "todas" ? "← Resumen" : "Ver todas las corridas"}</button>
            </div>
          )}
          {abriendo && <p className="text-[12px] text-zinc-500">Abriendo {abriendo}…</p>}
          <button type="button" onClick={() => void leer()} disabled={cargando} className={`ml-auto ${detalle ? "" : "lg:ml-0 "}rounded-md border border-white/15 px-2.5 py-1 text-[12.5px] text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50`}>{cargando ? "Leyendo…" : "Actualizar"}</button>
          <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar la observabilidad" className="rounded-md border border-white/15 px-2.5 py-1 text-[12.5px] text-zinc-300 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">Cerrar · Esc</button>
        </header>
        {error && <p role="alert" className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-[13px] text-rose-200 sm:px-6">{error}</p>}
        {cargando && !lista && <p className="px-6 py-6 text-[13px] text-zinc-500">Leyendo…</p>}
        {detalle
          ? <Traza key={detalle.corrida.workflow_execution_id} detalle={detalle} volver={volver} claveInicial={claveInicial} volverA={vista === "todas" ? "Corridas" : "Resumen"} />
          : lista && vista === "todas"
            ? <Lista corridas={delPeriodo} titulo={`Corridas · ${enPalabras}${conInterno ? " · con interno" : " · sin interno"}`} total={delPeriodo.length} cliente={cliente} setCliente={setCliente} clientes={clientes} estado={estado} setEstado={setEstado} abrir={(c) => void abrir(c)} cargando={cargando} costoDe={costoDe}
              pie={<>{sobre && <> · {sobre}: la plataforma entrega 200 por lectura</>}{!lista.completo && <> · lectura incompleta: alguna fuente no respondió entera</>}{lista.agrupado && <> · una fila por pedido</>}</>} />
            : lista && (
              <div data-vista="resumen" className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-1.5 sm:px-5">
                <div className="mx-auto flex max-w-[1600px] flex-col gap-2.5">
                  {(sobre || sinComparacion) && (
                    <p data-aviso-lectura role="status" className="px-0.5 text-[12px] leading-snug text-zinc-500" style={NUM}>
                      Corridas, errores y demora: {sobre && <span data-sobre-las-ultimas>{sobre}</span>}{sobre && sinComparacion && ", "}
                      {sinComparacion && <span data-sin-comparacion>sin comparación con {contra}{porQueSinComparar ? ` (${porQueSinComparar})` : ""}</span>}. El costo es el período entero{sinComparacion ? " y sí se compara" : ""} (Dinero).
                    </p>
                  )}
                  <section data-resumen className="grid gap-2.5 md:grid-cols-2">
                    <div data-grafico-caja="corridas" className={`${CAJA} min-w-0 px-4 py-2.5`}>
                      <Encabezado titulo={tituloDe("Corridas")}>
                        <span className={CIFRA} style={NUM}>{n.corridas}</span>
                        <span className="text-[14px]" style={NUM}>
                          {n.con_error ? <span className="text-[#ff5a36]">{n.con_error} con error</span> : <span className="text-[#8fd19e]">sin errores ✓</span>}
                          <span className="text-zinc-400">{n.con_error && n.pct_error != null ? ` · ${n.pct_error.toLocaleString("es-EC")} %` : ""} · demora típica {demoraCorta(n.mediana_ms)}</span>
                        </span>
                        <Frente vs={vsN(n.corridas, na?.corridas ?? null)} nombre={contra} sube_es_malo={false} />
                      </Encabezado>
                      <GraficoDeBarras dato="corridas" enteros titulo={tituloDe("Corridas")} rotulos={k.rotulos} rotulo={(i) => rotuloDe(k.rotulos[i], k, k.rotulos.length)} noLeido={noLeido} formato={(x) => x.toLocaleString("es-EC")} vacio={`Sin corridas en ${enPalabras}`}
                        capas={[{ clave: "con-error", nombre: "con error", color: ROJO, valores: porCubeta.map((x) => x.con_error) }, { clave: "sin-error", nombre: "sin error", color: AMBAR, valores: porCubeta.map((x) => x.total - x.con_error) }]}
                        detalle={(i, t) => (
                          <>
                            <p className="text-zinc-400">{rotuloLargo(k.rotulos[i], k)}</p>
                            <p data-total-del-dia className="text-[19px] font-light text-white" style={NUM}>{t} {t === 1 ? "corrida" : "corridas"}</p>
                            {t > 0 && <p className="flex items-center gap-2" style={NUM}><Punto color={AMBAR} />{t - porCubeta[i].con_error} sin error</p>}
                            {porCubeta[i].con_error > 0 && <p className="flex items-center gap-2" style={NUM}><Punto color={ROJO} />{porCubeta[i].con_error} con error</p>}
                          </>
                        )} />
                    </div>
                    <div data-grafico-caja="costo" className={`${CAJA} min-w-0 px-4 py-2.5`}>
                      <Encabezado titulo={tituloDe("Costo")}>
                        <span className={CIFRA} style={NUM}>{costo ? usdCorto(costo.total) : "…"}</span>
                        <Frente vs={costo ? variacion(costo.total, costo.anterior) : null} nombre={contra} />
                        <span className="text-[13px] text-zinc-500" style={NUM}>{conInterno ? "igual que en Dinero" : costoCon ? `sin interno · con interno ${usdCorto(costoCon.total)}` : "sin interno"}</span>
                      </Encabezado>
                      <GraficoDeBarras dato="costo" titulo={tituloDe("Costo")} rotulos={k.rotulos} rotulo={(i) => rotuloDe(k.rotulos[i], k, k.rotulos.length)} formato={usdEje} vacio={dinero ? `Sin gasto en ${enPalabras}` : "Leyendo el costo…"}
                        capas={[{ clave: "costo", nombre: "costo", color: AMBAR, valores: costoSerie }]}
                        detalle={(i, t) => (
                          <>
                            <p className="text-zinc-400">{rotuloLargo(k.rotulos[i], k)}</p>
                            <p data-total-del-dia className="text-[19px] font-light text-white" style={NUM}>{usdCorto(t)}</p>
                            {t > 0 && t === Math.max(...costoSerie) && <p className="text-zinc-400">el {k.porHora ? "momento" : "día"} que más costó</p>}
                          </>
                        )} />
                    </div>
                  </section>
                  <LoQueFallo fallas={fallas} donde={donde} cascadas={cascadas} periodo={enPalabras} abrirEn={(c, clave) => void abrir(c, clave)} />
                  <Grupos grupos={grupos} por={por} setPor={setPor} abierto={abierto} setAbierto={setAbierto} abrir={(c) => void abrir(c)} costoDe={costoDe} empleadosListos={!!emp}
                    oculto={conInterno ? null : { corridas: internas.length, costo: costoCon && costo ? Math.round((costoCon.total - costo.total) * 100) / 100 : null }} mostrarInterno={() => setConInterno(true)} />
                  <section data-grafico-caja="demora" className={`${CAJA} min-w-0 px-4 py-2.5`}>
                    <Encabezado titulo={tituloDe("Demora típica")}>
                      <span className={CIFRA} style={NUM}>{demoraCorta(n.mediana_ms)}</span>
                      {n.max_ms != null && <span className="text-[14px] text-zinc-400">la más lenta: {n.mas_lenta ? `${n.mas_lenta} · ` : ""}{demoraCorta(n.max_ms)}</span>}
                      <Frente vs={vsN(n.mediana_ms, na?.mediana_ms ?? null)} nombre={contra} />
                    </Encabezado>
                    <GraficoDeBarras dato="demora" titulo={tituloDe("Demora típica")} rotulos={k.rotulos} rotulo={(i) => rotuloDe(k.rotulos[i], k, k.rotulos.length)} noLeido={noLeido} vacio="Sin corridas terminadas"
                      formato={(x) => `${x.toLocaleString("es-EC")} ${enMinutos ? "min" : "s"}`}
                      capas={[{ clave: "demora", nombre: "demora típica", color: AMBAR, valores: porCubeta.map((x) => (x.mediana_ms ?? 0) / unidadDemora) }]}
                      detalle={(i) => (
                        <>
                          <p className="text-zinc-400">{rotuloLargo(k.rotulos[i], k)}</p>
                          <p data-total-del-dia className="text-[19px] font-light text-white" style={NUM}>{porCubeta[i].mediana_ms == null ? "sin terminadas" : `${demoraCorta(porCubeta[i].mediana_ms)} típica`}</p>
                          <p className="text-zinc-400" style={NUM}>{porCubeta[i].total} {porCubeta[i].total === 1 ? "corrida" : "corridas"}</p>
                        </>
                      )} />
                  </section>
                  <Empleados top={top} verFicha={verFicha} conFicha={conFicha} />
                  <p data-pie-obs className="text-[12px] leading-relaxed text-zinc-500" style={NUM}>
                    Período: {enPalabras} ({v.r.desde} a {v.r.hasta}, hora de Ecuador) · comparado con {v.ant.nombre} · una corrida = un pedido · demora típica = la mediana · el costo es la misma cuenta que Dinero
                    {cargaMs != null && <> · <span data-carga-ms={cargaMs} data-carga-corridas={partes.corridas} data-carga-costo={partes.costo}>cargó en {(cargaMs / 1000).toLocaleString("es-EC", { maximumFractionDigits: 1 })} s{partes.corridas != null && partes.costo != null ? ` (corridas ${(partes.corridas / 1000).toLocaleString("es-EC", { maximumFractionDigits: 1 })} s · costo ${(partes.costo / 1000).toLocaleString("es-EC", { maximumFractionDigits: 1 })} s)` : ""}</span></>}
                  </p>
                </div>
              </div>
            )}
      </section>
      {ficha && rFicha && typeof document !== "undefined" && createPortal(<FichaDeRendimiento r={rFicha} nombre={ficha.nombre} color={AMBAR} onCerrar={() => setFicha(null)} />, document.body)}
    </div>
  )
}
