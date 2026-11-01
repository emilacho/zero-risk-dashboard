"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { EquipoDelCliente } from "@/lib/equipo-datos"
import { EQUIPOS_DE_MARKETING, estadoDeAhoraLegible, etapaLegible, type ClaveDeEquipo, type EquipoArmado, type Miembro } from "@/lib/organigrama"
import { diaYHora, plural, usdFinoES } from "@/lib/lenguaje"

/**
 * EQUIPO (sprint 6.10 · encargo 01-nov §2 botón 8 + ADENDA 6 + MAPA «6 EQUIPOS»): el organigrama del departamento como en una agencia real · Dirección · Estrategia ·
 * Creativo (activos) · Web y búsqueda · Medios y Performance · Relaciones (segunda etapa, atenuados). Cada agente en SU equipo, con lo que está haciendo AHORA
 * (corridas reales de los últimos 7 días). SOLO LECTURA. Lo firmado y no instalado se ve «por instalar»; lo que ningún equipo nombra va a «Otros departamentos».
 * Mismo explorador que informes y cerebro: ruta arriba · equipos a la izquierda · tarjetas → la persona abierta. Sin selector de cliente (lo enfoca la oficina).
 */
const AMBAR = "#f5a524"
type Respuesta = ({ ok: true } & EquipoDelCliente) | { ok: false; error: string }

const ESTILO = `
.eq-entra{animation:eqEntra .4s cubic-bezier(.2,.8,.2,1) both}
.eq-tarjeta{transition:transform .15s ease,border-color .15s ease,background .15s ease}
.eq-tarjeta:hover,.eq-tarjeta:focus-visible{transform:translateY(-2px);border-color:rgba(245,165,36,.55);background:rgba(245,165,36,.06)}
.eq-nodo[aria-current="true"]{background:rgba(245,165,36,.12);color:#fde68a}
.eq-equipo[data-etapa="segunda_etapa"],.eq-equipo[data-etapa="fuera"]{opacity:.62}
.eq-equipo[data-etapa="segunda_etapa"]:hover,.eq-equipo[data-etapa="fuera"]:hover{opacity:.9}
.eq-luz[data-estado="trabajando"]{animation:eqLate 1.8s ease-in-out infinite}
@keyframes eqEntra{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes eqLate{0%,100%{box-shadow:0 0 0 0 rgba(245,165,36,.65)}50%{box-shadow:0 0 0 6px rgba(245,165,36,0)}}
@media (prefers-reduced-motion:reduce){.eq-entra{animation:none}.eq-tarjeta{transition:none}.eq-luz[data-estado="trabajando"]{animation:none}}
`
const Titulito = ({ children }: { children: React.ReactNode }) => <h4 className="mb-1 text-[11px] uppercase tracking-[0.08em] text-zinc-500">{children}</h4>
const MIGA = "rounded px-1.5 py-0.5 text-[12.5px] text-zinc-300 hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400"
const TARJETA = "eq-tarjeta flex w-full flex-col gap-1.5 rounded-xl border border-white/10 bg-[#1c1c1c] p-3.5 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400"
const B_GRIS = "rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-zinc-400 transition hover:bg-white/[0.05]"
const Sep = () => <span className="text-zinc-600" aria-hidden>›</span>
const Chip = ({ children, tono = "neutro" }: { children: React.ReactNode; tono?: "neutro" | "ambar" | "verde" | "gris" }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] ${tono === "ambar" ? "border-amber-400/50 text-amber-200" : tono === "verde" ? "border-emerald-400/40 text-emerald-200" : tono === "gris" ? "border-white/10 text-zinc-500" : "border-white/15 text-zinc-300"}`}>{children}</span>
)

/** el avatar: silueta oscura con la luz del equipo (ADENDA 6); la luz late cuando trabaja ahora */
export function Avatar({ color, estado, tam = 34 }: { color: string; estado: Miembro["actividad"]["estado"]; tam?: number }) {
  const apagado = estado === "quieto"
  return (
    <span className="relative inline-flex shrink-0" style={{ width: tam, height: tam }} aria-hidden>
      <svg viewBox="0 0 32 32" width={tam} height={tam}><circle cx="16" cy="16" r="15" fill="#141414" stroke={apagado ? "rgba(255,255,255,.14)" : color} strokeWidth="1.2" /><circle cx="16" cy="12.5" r="4.6" fill={apagado ? "#2a2a2a" : "#1f1f1f"} stroke={apagado ? "rgba(255,255,255,.18)" : color} strokeWidth="1" /><path d="M7.5 26c1.2-5 4.6-7.5 8.5-7.5s7.3 2.5 8.5 7.5" fill={apagado ? "#2a2a2a" : "#1f1f1f"} stroke={apagado ? "rgba(255,255,255,.18)" : color} strokeWidth="1" /></svg>
      <span className="eq-luz absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-black" data-estado={estado} style={{ background: estado === "trabajando" ? AMBAR : estado === "reciente" ? "rgba(245,165,36,.45)" : "#333" }} />
    </span>
  )
}

function TarjetaDeMiembro({ m, color, onAbrir }: { m: Miembro; color: string; onAbrir: () => void }) {
  return (
    <li>
      <button type="button" data-miembro={m.nombre} data-estado={m.actividad.estado} onClick={onAbrir} className={TARJETA}>
        <div className="flex w-full items-center gap-2.5">
          <Avatar color={color} estado={m.actividad.estado} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-zinc-100">{m.nombre_visible}</span>
            <span className="block truncate text-[11px] text-zinc-500">{m.especialidad ?? m.rol_en_sesion ?? m.nombre}</span>
          </span>
        </div>
        <p className="line-clamp-2 text-[12px] leading-snug text-zinc-400">{estadoDeAhoraLegible(m.actividad)}</p>
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          {m.rol_en_sesion === "Dirige la sesión" && <Chip tono="ambar">Dirige</Chip>}
          {!m.instalado && <Chip tono="gris">Sin ficha en agentes</Chip>}
          {m.instalado && !m.activo && <Chip tono="gris">Inactivo</Chip>}
          {m.actividad.para_el_cliente_7d > 0 && <Chip>{plural(m.actividad.para_el_cliente_7d, "trabajo", "trabajos")} para este cliente · 7 d</Chip>}
        </div>
      </button>
    </li>
  )
}

export function PanelEquipo({ onCerrar, datosIniciales = null, clienteInicial = null, fetchImpl = fetch }: {
  onCerrar: () => void
  datosIniciales?: EquipoDelCliente | null
  /** el cliente enfocado en la oficina. El explorador no cambia de cliente */
  clienteInicial?: string | null
  fetchImpl?: typeof fetch
}) {
  const [datos, setDatos] = useState<EquipoDelCliente | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!datosIniciales)
  const [equipoClave, setEquipoClave] = useState<ClaveDeEquipo | null>(null)
  const [miembroNombre, setMiembroNombre] = useState<string | null>(null)
  const cerrar = useRef<HTMLButtonElement>(null)

  const leer = useCallback(async (id: string | null) => {
    setCargando(true); setError(null)
    try {
      const r = await fetchImpl(`/api/equipo${id ? `?cliente=${encodeURIComponent(id)}` : ""}`, { cache: "no-store" })
      const j = (await r.json().catch(() => null)) as Respuesta | null
      if (!r.ok || !j || !j.ok) throw new Error(r.status === 401 || r.status === 403 ? "Necesitas una sesión de administrador para ver el equipo." : (j && !j.ok && j.error) || `No pude leer el equipo (${r.status}).`)
      setDatos(j)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setCargando(false) }
  }, [fetchImpl])
  useEffect(() => { cerrar.current?.focus() }, [])
  useEffect(() => { if (!datosIniciales) void leer(clienteInicial) }, [leer, datosIniciales, clienteInicial])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopPropagation(); e.preventDefault()
      if (miembroNombre) setMiembroNombre(null); else if (equipoClave) setEquipoClave(null); else onCerrar()
    }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar, miembroNombre, equipoClave])

  const equipos = datos?.equipos ?? []
  const marketing = equipos.filter((e) => EQUIPOS_DE_MARKETING.includes(e.clave))
  const fuera = equipos.filter((e) => !EQUIPOS_DE_MARKETING.includes(e.clave) && e.miembros.length)
  const equipo: EquipoArmado | null = equipoClave ? equipos.find((e) => e.clave === equipoClave) ?? null : null
  const miembro = miembroNombre && equipo ? equipo.miembros.find((m) => m.nombre === miembroNombre) ?? null : null
  const nombre = datos?.cliente?.nombre ?? "Cliente"
  const r = datos?.resumen
  const resumen = r ? `${plural(r.activos, "equipo activo", "equipos activos")} de ${r.equipos} · ${plural(r.miembros, "empleado", "empleados")} · ${r.trabajando ? `${r.trabajando} ahora mismo` : "nadie trabaja ahora"}` : ""
  const irA = (k: ClaveDeEquipo | null) => { setEquipoClave(k); setMiembroNombre(null) }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <style>{ESTILO}</style>
      <section role="dialog" aria-modal="true" aria-labelledby="equipo-titulo" data-seccion="equipo" className="relative flex h-full max-h-full w-full max-w-[1400px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#171717] text-zinc-200 shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <h2 id="equipo-titulo" className="font-display text-[15px] font-light uppercase tracking-[0.28em]" style={{ color: AMBAR }}>Equipo</h2>
          <p className="hidden text-[12px] text-zinc-500 md:block">El departamento de marketing de {nombre}{resumen ? ` · ${resumen}` : ""}</p>
          <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar el equipo" className="ml-auto rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">Cerrar · Esc</button>
        </header>
        <nav aria-label="Dónde estás" data-ruta className="flex flex-wrap items-center gap-1 border-b border-white/10 px-4 py-2 sm:px-6">
          <button type="button" data-miga="cliente" onClick={() => irA(null)} aria-current={!equipo ? "page" : undefined} className={`${MIGA} ${!equipo ? "text-white" : ""}`}>{nombre}</button>
          {equipo && <><Sep /><button type="button" data-miga="equipo" onClick={() => setMiembroNombre(null)} aria-current={!miembro ? "page" : undefined} className={`${MIGA} ${!miembro ? "text-white" : ""}`}>{equipo.nombre}</button></>}
          {miembro && <><Sep /><span data-miga="miembro" className="truncate px-1.5 text-[12.5px] text-white">{miembro.nombre_visible}</span></>}
        </nav>

        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-[250px] shrink-0 overflow-y-auto border-r border-white/10 p-3 md:block" aria-label="Equipos">
            <button type="button" data-nodo="cliente" onClick={() => irA(null)} aria-current={!equipoClave} className="eq-nodo flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium text-zinc-100 hover:bg-white/[0.05]"><span className="truncate">Departamento de marketing</span></button>
            <ul className="mt-1 space-y-0.5 pl-3">
              {marketing.map((e) => (
                <li key={e.clave}>
                  <button type="button" data-nodo-equipo={e.clave} data-etapa={e.etapa} onClick={() => irA(e.clave)} aria-current={equipoClave === e.clave} className={`eq-nodo eq-equipo flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-zinc-300 hover:bg-white/[0.05]`}>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: e.color }} aria-hidden /><span className="min-w-0 flex-1 truncate">{e.nombre}</span>
                    <span className={`shrink-0 rounded-full px-1.5 text-[10.5px] ${e.trabajando ? "bg-amber-400/20 text-amber-200" : "bg-white/[0.06] text-zinc-400"}`}>{e.miembros.length}</span>
                  </button>
                </li>
              ))}
            </ul>
            {fuera.length > 0 && (
              <>
                <Titulito>&nbsp;</Titulito>
                <ul className="space-y-0.5 pl-3">
                  {fuera.map((e) => (
                    <li key={e.clave}>
                      <button type="button" data-nodo-equipo={e.clave} data-etapa={e.etapa} onClick={() => irA(e.clave)} aria-current={equipoClave === e.clave} className="eq-nodo eq-equipo flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-zinc-400 hover:bg-white/[0.05]">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: e.color }} aria-hidden /><span className="min-w-0 flex-1 truncate">{e.nombre}</span>
                        <span className="shrink-0 rounded-full bg-white/[0.06] px-1.5 text-[10.5px] text-zinc-400">{e.miembros.length}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </aside>

          <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {error && <p role="alert" className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-200">{error}</p>}
            {cargando && !datos && <p className="text-[13px] text-zinc-400">Leyendo…</p>}

            {/* el organigrama: los 6 equipos */}
            {datos && !equipo && (
              <div data-vista="organigrama" className="eq-entra space-y-5">
                <div className="flex flex-wrap items-baseline gap-3">
                  <h3 className="text-[15px] font-medium text-zinc-100">Los 6 equipos del departamento</h3>
                  <span className="text-[12px] text-zinc-500">Lo que hace cada uno sale de corridas reales de los últimos 7 días{datos.ventana.corridas ? ` (${datos.ventana.corridas} corridas miradas)` : ""}</span>
                </div>
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {marketing.map((e) => (
                    <li key={e.clave}>
                      <button type="button" data-equipo={e.clave} data-etapa={e.etapa} data-trabajando={e.trabajando} onClick={() => irA(e.clave)} className={`${TARJETA} eq-equipo min-h-[150px]`}>
                        <div className="flex w-full items-center gap-2">
                          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: e.color, boxShadow: e.etapa === "activo" ? `0 0 10px ${e.color}` : "none" }} aria-hidden />
                          <span className="text-[14px] font-medium text-zinc-100">{e.nombre}</span>
                          <span className="ml-auto text-[11px] text-zinc-500">{e.sistema}</span>
                        </div>
                        <p className="text-[12px] leading-snug text-zinc-400">{e.descripcion}</p>
                        <div className="mt-1 flex -space-x-2">{e.miembros.slice(0, 8).map((m) => <Avatar key={m.nombre} color={e.color} estado={m.actividad.estado} tam={26} />)}{e.miembros.length > 8 && <span className="ml-3 self-center text-[11px] text-zinc-500">+{e.miembros.length - 8}</span>}</div>
                        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                          <Chip tono={e.etapa === "activo" ? "verde" : "gris"}>{etapaLegible(e.etapa)}</Chip>
                          <Chip>{plural(e.miembros.length, "empleado", "empleados")}</Chip>
                          {e.trabajando > 0 && <Chip tono="ambar">{e.trabajando} ahora</Chip>}
                          {e.por_instalar_total > 0 && <Chip tono="gris">{e.por_instalar_total} por instalar</Chip>}
                        </div>
                        {e.bloqueo && <span className="text-[11px] text-zinc-500">{e.bloqueo}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
                {fuera.length > 0 && (
                  <div data-grupo="fuera">
                    <Titulito>Fuera del departamento · le sirven a marketing</Titulito>
                    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {fuera.map((e) => (
                        <li key={e.clave}>
                          <button type="button" data-equipo={e.clave} data-etapa={e.etapa} onClick={() => irA(e.clave)} className={`${TARJETA} eq-equipo`}>
                            <div className="flex w-full items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-full" style={{ background: e.color }} aria-hidden /><span className="text-[13px] font-medium text-zinc-200">{e.nombre}</span></div>
                            <p className="text-[12px] leading-snug text-zinc-400">{e.descripcion}</p>
                            <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1"><Chip>{plural(e.miembros.length, "empleado", "empleados")}</Chip>{e.trabajando > 0 && <Chip tono="ambar">{e.trabajando} ahora</Chip>}</div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-[11.5px] text-zinc-500">{datos.equipos[0]?.origen === "directorio" ? "El equipo de cada empleado viene del directorio de la oficina." : "El equipo de cada empleado sale del mapa firmado el 1 de noviembre; cuando el directorio de la oficina traiga el equipo, manda el dato."}</p>
              </div>
            )}

            {/* un equipo: sus áreas y su gente */}
            {datos && equipo && !miembro && (
              <div data-vista="equipo" data-equipo-abierto={equipo.clave} className="eq-entra space-y-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: equipo.color }} aria-hidden />
                    <h3 className="text-[16px] font-medium text-zinc-50">{equipo.nombre}</h3>
                    <Chip tono={equipo.etapa === "activo" ? "verde" : "gris"}>{etapaLegible(equipo.etapa)}</Chip>
                    <Chip>{plural(equipo.miembros.length, "empleado", "empleados")}</Chip>
                    {equipo.trabajando > 0 && <Chip tono="ambar">{equipo.trabajando} trabajando ahora</Chip>}
                  </div>
                  <p className="mt-1 text-[13px] text-zinc-400">{equipo.descripcion}{equipo.bloqueo ? ` · ${equipo.bloqueo}` : ""}</p>
                  <p className="mt-0.5 text-[11.5px] text-zinc-500">En el sistema: {equipo.sistema} · fuente: {equipo.fuente}</p>
                </div>
                {equipo.areas.map((a) => (
                  <div key={a.clave} data-area={a.clave}>
                    <Titulito>{a.nombre}{a.momento ? ` · ${a.momento}` : ""}{a.miembros.length ? ` · ${plural(a.miembros.length, "empleado", "empleados")}` : ""}</Titulito>
                    {a.nota && <p className="mb-2 text-[11.5px] text-zinc-500">{a.nota}</p>}
                    {a.miembros.length > 0 ? (
                      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{a.miembros.map((m) => <TarjetaDeMiembro key={m.nombre} m={m} color={equipo.color} onAbrir={() => setMiembroNombre(m.nombre)} />)}</ul>
                    ) : (
                      <p className="text-[12.5px] text-zinc-500">{a.por_instalar.length ? "Todavía sin nadie instalado." : "Sin empleados asignados."}</p>
                    )}
                    {a.por_instalar.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Por instalar" data-por-instalar>
                        {a.por_instalar.map((n) => <li key={n}><Chip tono="gris">{n} · por instalar</Chip></li>)}
                      </ul>
                    )}
                  </div>
                ))}
                {!equipo.miembros.length && !equipo.areas.some((a) => a.por_instalar.length) && <p className="text-[13px] text-zinc-400">Nadie todavía en este equipo.</p>}
                <div><button type="button" onClick={() => irA(null)} className={B_GRIS}>← Volver al organigrama</button></div>
              </div>
            )}

            {/* la persona abierta */}
            {datos && equipo && miembro && (
              <article data-vista="miembro" data-miembro-abierto={miembro.nombre} className="eq-entra max-w-[820px] space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar color={equipo.color} estado={miembro.actividad.estado} tam={52} />
                  <div className="min-w-0">
                    <h3 className="text-[16px] font-medium leading-snug text-zinc-50">{miembro.nombre_visible}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Chip>{equipo.nombre}</Chip>
                      {miembro.equipos.filter((k) => k !== equipo.clave).map((k) => <Chip key={k} tono="gris">también en {equipos.find((e) => e.clave === k)?.nombre ?? k}</Chip>)}
                      {miembro.rol_en_sesion && <Chip tono={miembro.rol_en_sesion === "Dirige la sesión" ? "ambar" : "neutro"}>{miembro.rol_en_sesion}</Chip>}
                      {miembro.modelo && <Chip tono="gris">{miembro.modelo}</Chip>}
                      {!miembro.instalado && <Chip tono="gris">Sin ficha en agentes · se lo ve trabajar</Chip>}
                    </div>
                  </div>
                </div>
                <div data-bloque="ahora">
                  <Titulito>Ahora</Titulito>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-[12.5px] leading-relaxed text-zinc-200">
                    <p>{estadoDeAhoraLegible(miembro.actividad)}{miembro.actividad.para_este_cliente ? " · para este cliente" : ""}</p>
                    {miembro.actividad.ultima && <p className="text-[11.5px] text-zinc-500">Última corrida: {diaYHora(miembro.actividad.ultima)}</p>}
                    <p className="mt-1 text-[11.5px] text-zinc-400">Últimos 7 días: {plural(miembro.actividad.trabajos_7d, "corrida", "corridas")} · {plural(miembro.actividad.para_el_cliente_7d, "para este cliente", "para este cliente")} · {usdFinoES(miembro.actividad.gasto_7d_usd)}</p>
                  </div>
                </div>
                {miembro.en_directorio ? (
                  <>
                    {miembro.especialidad && <div data-bloque="especialidad"><Titulito>Especialidad</Titulito><p className="text-[12.5px] text-zinc-200">{miembro.especialidad}</p></div>}
                    {[["sabe_hacer", "Sabe hacer"], ["necesita", "Necesita"], ["entrega", "Entrega"], ["pertinente_en", "Pertinente en"]].map(([k, t]) => {
                      const xs = miembro[k as "sabe_hacer" | "necesita" | "entrega" | "pertinente_en"]
                      return xs.length ? <div key={k} data-bloque={k}><Titulito>{t}</Titulito><ul className="list-disc space-y-0.5 pl-4 text-[12.5px] text-zinc-200">{xs.map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null
                    })}
                  </>
                ) : (
                  <p className="text-[12px] text-zinc-500">Este empleado todavía no tiene ficha en el directorio de la oficina (qué sabe hacer, qué necesita, qué entrega).</p>
                )}
                <div><button type="button" onClick={() => setMiembroNombre(null)} className={B_GRIS}>← Volver a {equipo.nombre}</button></div>
              </article>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
