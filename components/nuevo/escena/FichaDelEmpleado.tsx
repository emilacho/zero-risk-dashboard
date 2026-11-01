"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { iniciales, type FichaDelEmpleado as Ficha } from "@/lib/escena-empleado"
import { MESAS } from "@/lib/escena-avatares"
import { fechaCortaEC } from "@/lib/manual"
import { usdES } from "@/lib/lenguaje"

type Respuesta = ({ ok: true } & Ficha) | { ok: false; error: string }
const AMBAR = "#f5a524"

/** el retrato: un busto en el mismo estilo de la escena (negro, trazo ámbar, el color del equipo en el hombro) con sus iniciales */
function Retrato({ nombre, color }: { nombre: string; color: string }) {
  return (
    <svg viewBox="0 0 120 120" width={112} height={112} aria-hidden className="shrink-0 rounded-2xl border border-amber-400/40 bg-[#0d0b09]">
      <defs><radialGradient id="ficha-luz" cx=".5" cy=".35" r=".7"><stop offset="0" stopColor="#ffb347" stopOpacity=".25" /><stop offset="1" stopColor="#ffb347" stopOpacity="0" /></radialGradient></defs>
      <rect width="120" height="120" fill="url(#ficha-luz)" />
      <path d="M18 120c2-24 20-36 42-36s40 12 42 36" fill="#1b1714" stroke={AMBAR} strokeOpacity=".55" strokeWidth="1.5" />
      <path d="M28 104c8-6 18-9 32-9" stroke={color} strokeWidth="5" strokeLinecap="round" fill="none" opacity=".85" />
      <circle cx="60" cy="50" r="23" fill="#24201c" stroke={AMBAR} strokeOpacity=".6" strokeWidth="1.5" />
      <text x="60" y="57" textAnchor="middle" fontSize="18" fontWeight="600" fill="#ffe2b8" fontFamily="system-ui, Arial, sans-serif">{iniciales(nombre)}</text>
    </svg>
  )
}
const Titulo = ({ children }: { children: React.ReactNode }) => <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em]" style={{ color: AMBAR }}>{children}</h3>
const Vacio = ({ children }: { children: React.ReactNode }) => <p className="text-[12.5px] italic text-zinc-500">{children}</p>
function Cifra({ etiqueta, valor, nota }: { etiqueta: string; valor: string; nota?: string }) {
  return <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2"><div className="text-[11px] uppercase tracking-[0.06em] text-zinc-500">{etiqueta}</div><div className="text-[18px] font-semibold tabular-nums text-zinc-50">{valor}</div>{nota && <div className="text-[11px] text-zinc-500">{nota}</div>}</div>
}

/**
 * LA FICHA DEL EMPLEADO (CC6 · Sprint B · pedido de Emilio, 01-nov): un currículum moderno, mismo estilo oscuro/ámbar. Se abre al tocar un nombre en la lista
 * de la mesa. Nombre de persona inventado y estable + su puesto real · retrato · habilidades · métodos · modelo · equipo y mesa · quién lo revisa · origen ·
 * contratado el · trabajo reciente · números. Todo con fuente y hora; «sin dato» honesto; solo lectura. Va por un portal (encima de todo menos del chat).
 */
export function FichaDelEmpleado({ agente, onCerrar, datosIniciales = null }: { agente: string; onCerrar: () => void; datosIniciales?: Ficha | null }) {
  const [ficha, setFicha] = useState<Ficha | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const cerrar = useRef<HTMLButtonElement>(null)
  useEffect(() => { cerrar.current?.focus() }, [])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onCerrar() } }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar])
  useEffect(() => {
    if (datosIniciales) return
    let vivo = true
    void (async () => {
      try {
        const r = await fetch(`/api/escena-viva/empleado?agente=${encodeURIComponent(agente)}`, { cache: "no-store" })
        const j = (await r.json().catch(() => null)) as Respuesta | null
        if (!r.ok || !j || !j.ok) throw new Error(r.status === 401 || r.status === 403 ? "Necesitas una sesión de administrador." : r.status === 404 ? "Ese empleado no está en la base." : (j && !j.ok && j.error) || `No pude leer la ficha (${r.status}).`)
        if (vivo) setFicha(j)
      } catch (e) { if (vivo) setError(e instanceof Error ? e.message : String(e)) }
    })()
    return () => { vivo = false }
  }, [agente, datosIniciales])

  const color = MESAS.find((m) => m.clave === ficha?.equipo.clave)?.color ?? AMBAR
  const n = ficha?.numeros
  const cuerpo = (
    <div data-ficha-del-empleado={agente} className="nv-panel fixed inset-0 z-[75] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onCerrar() }}>
      <section role="dialog" aria-modal="true" aria-label={ficha ? `Ficha de ${ficha.persona}` : "Ficha del empleado"} className="relative flex max-h-full w-full max-w-[960px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#161412] text-zinc-200 shadow-2xl">
        <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar" className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
        </button>
        {error && <p role="alert" className="m-6 text-[13px] text-rose-300">{error}</p>}
        {!ficha && !error && <p className="m-6 text-[13px] text-zinc-500">Leyendo la ficha…</p>}
        {ficha && n && (
          <div className="min-h-0 overflow-y-auto p-5 sm:p-7">
            {/* encabezado: el nombre de persona y su puesto real */}
            <header className="flex flex-wrap items-center gap-5">
              <Retrato nombre={ficha.persona} color={color} />
              <div className="min-w-0">
                <h2 className="font-display text-[28px] font-semibold leading-tight text-zinc-50" data-persona>{ficha.persona}</h2>
                <p className="text-[15px] text-amber-200" data-puesto>{ficha.puesto}</p>
                {ficha.especialidad && <p className="mt-0.5 max-w-[46rem] text-[13px] text-zinc-400">{ficha.especialidad}</p>}
                <div className="mt-2 flex flex-wrap gap-2 text-[11.5px]">
                  <span className="rounded-full border px-2.5 py-0.5" style={{ borderColor: color, color }}>{ficha.equipo.nombre}{ficha.equipo.origen === "mapa" ? " (según el mapa)" : ""}</span>
                  <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-zinc-300">{ficha.modelo}</span>
                  <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-zinc-300">contratado el {ficha.contratado_en ? fechaCortaEC(ficha.contratado_en) : "sin dato"}</span>
                  {ficha.ahora.trabajando > 0 && <span className="rounded-full border border-amber-400/60 px-2.5 py-0.5 text-amber-200">trabajando ahora</span>}
                  {ficha.ahora.sin_cierre_registrado > 0 && <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-zinc-400" title="Despachos abiertos hace más de 20 min sin fin registrado: no cuentan como trabajando">{ficha.ahora.sin_cierre_registrado} sin cierre registrado</span>}
                </div>
              </div>
            </header>

            <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="min-w-0 space-y-6">
                <section aria-label="Habilidades"><Titulo>Habilidades destacadas</Titulo>
                  {ficha.habilidades.lista.length ? <ul className="list-disc space-y-1 pl-5 text-[13.5px] text-zinc-200">{ficha.habilidades.lista.map((h, i) => <li key={i}>{h}</li>)}</ul> : <Vacio>sin dato</Vacio>}
                  {ficha.habilidades.fuente && <p className="mt-1 text-[11px] text-zinc-500">según {ficha.habilidades.fuente === "directorio" ? "el directorio de la oficina" : "su identidad"}</p>}
                </section>
                <section aria-label="Métodos"><Titulo>Métodos</Titulo>
                  {ficha.metodos.length ? <ul className="flex flex-wrap gap-2">{ficha.metodos.map((m) => <li key={m.nombre} className="rounded-md border border-white/10 bg-black/30 px-2.5 py-1 text-[12.5px] text-zinc-200" title={m.fuente ?? undefined}>{m.nombre}{m.fuente ? <span className="ml-1 text-[11px] text-zinc-500">· {m.fuente}</span> : null}</li>)}</ul> : <Vacio>sin métodos asignados en la base</Vacio>}
                </section>
                <section aria-label="Trabajo reciente"><Titulo>Trabajo reciente</Titulo>
                  {ficha.recientes.length ? (
                    <table className="w-full text-left text-[12.5px]">
                      <thead className="text-[11px] uppercase tracking-[0.05em] text-zinc-500"><tr><th className="py-1 pr-2 font-normal">Fecha</th><th className="py-1 pr-2 font-normal">Cliente</th><th className="py-1 pr-2 font-normal">Flujo · paso</th><th className="py-1 pr-2 font-normal">Estado</th><th className="py-1 text-right font-normal">Costo</th></tr></thead>
                      <tbody>{ficha.recientes.map((r, i) => (
                        <tr key={i} className="border-t border-white/5" data-tarea={r.estado}>
                          <td className="py-1 pr-2 text-zinc-400">{r.fecha ? fechaCortaEC(r.fecha) : "—"}</td>
                          <td className="py-1 pr-2 text-zinc-200">{r.cliente}</td>
                          <td className="py-1 pr-2 text-zinc-300">{r.flujo}{r.paso ? ` · ${r.paso}` : ""}</td>
                          <td className={`py-1 pr-2 ${r.estado === "fallida" ? "text-rose-300" : r.estado === "completada" ? "text-emerald-300" : "text-zinc-400"}`}>{r.estado}</td>
                          <td className="py-1 text-right tabular-nums text-zinc-300">{r.costo_usd == null ? "—" : usdES(r.costo_usd)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  ) : <Vacio>sin tareas registradas</Vacio>}
                </section>
              </div>
              <aside className="space-y-6">
                <section aria-label="Números"><Titulo>Números</Titulo>
                  <div className="grid grid-cols-2 gap-2">
                    <Cifra etiqueta="Tareas" valor={String(n.tareas)} nota={`${n.completadas} completas · ${n.fallidas} fallidas`} />
                    <Cifra etiqueta="Éxito" valor={n.tasa_de_exito == null ? "sin dato" : `${n.tasa_de_exito} %`} />
                    <Cifra etiqueta="Tiempo por tarea" valor={n.minutos_promedio == null ? "sin dato" : `${n.minutos_promedio.toLocaleString("es-EC")} min`} />
                    <Cifra etiqueta="Gasto" valor={usdES(n.gasto_total_usd)} nota={`últimos 30 días ${usdES(n.gasto_30d_usd)}`} />
                  </div>
                </section>
                <section aria-label="Equipo y origen"><Titulo>Equipo y origen</Titulo>
                  <dl className="space-y-1.5 text-[12.5px]">
                    <div><dt className="text-[11px] text-zinc-500">Mesa</dt><dd className="text-zinc-200">{ficha.equipo.nombre}</dd></div>
                    <div><dt className="text-[11px] text-zinc-500">Quién lo revisa</dt><dd className="text-zinc-200">{ficha.revisa}</dd></div>
                    <div><dt className="text-[11px] text-zinc-500">Origen</dt><dd className="text-zinc-200">{ficha.origen.texto}{ficha.origen.archivo ? <span className="block text-[11px] text-zinc-500">{ficha.origen.archivo}</span> : null}<span className="block text-[11px] text-zinc-500">licencia: sin dato en la base</span></dd></div>
                    {ficha.aportes.length > 0 && <div><dt className="text-[11px] text-zinc-500">Aportes en mesas</dt><dd className="text-zinc-200">{ficha.aportes.map((a) => `${a.n} ${a.tipo}`).join(" · ")}</dd></div>}
                  </dl>
                </section>
              </aside>
            </div>
            <p className="mt-6 text-[11px] text-zinc-500" data-fuente>fuente {ficha.fuente} · leído {ficha.leido_en.slice(11, 16)}Z · el nombre de persona es inventado y no cambia</p>
          </div>
        )}
      </section>
    </div>
  )
  return typeof document === "undefined" ? cuerpo : createPortal(cuerpo, document.body)
}
