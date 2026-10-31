"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { ManualDelCliente } from "@/lib/manual-datos"
import { CAMPOS_DEL_LECTOR, type CampoLeido } from "@/lib/manual-lector"
import { contrasteDelTexto, etiquetaDelHueco, fechaCortaEC, procedenciaLegible, rolDeLaLetraLegible, rolDelColorLegible, separarPropuesta } from "@/lib/manual"

const AMBAR = "#f5a524"
type Respuesta = ({ ok: true } & ManualDelCliente) | { ok: false; error: string }

const ESTILO = `
.mn-seccion{animation:mnEntra .45s cubic-bezier(.2,.8,.2,1) both}
.mn-color{transition:transform .18s ease,box-shadow .18s ease}
.mn-color:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(0,0,0,.45)}
@keyframes mnEntra{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.mn-seccion{animation:none}.mn-color{transition:none}}
`

/** los apartados del manual, en el orden en que se leen: qué es la marca · cómo habla · a quién le habla */
export const APARTADOS_DEL_MANUAL: ReadonlyArray<{ titulo: string; claves: string[] }> = [
  { titulo: "Lo que la marca es", claves: ["proposito", "mision", "vision", "valores", "eslogan", "posicionamiento", "personalidad"] },
  { titulo: "Cómo habla", claves: ["voz", "mensajes_clave", "propuestas_de_valor", "nunca"] },
  { titulo: "A quién le habla", claves: ["publico"] },
]
const LARGO_PLEGADO = 650
const esLista = (clave: string) => CAMPOS_DEL_LECTOR.find((c) => c.clave === clave)?.lista === true

/** un valor de lista guardado como «a · b · c» vuelve a ser lista para leerse como viñetas */
export function viñetasDelCampo(c: Pick<CampoLeido, "clave" | "valor">): string[] | null {
  if (!c.valor || !esLista(c.clave)) return null
  const partes = c.valor.split(" · ").map((s) => s.trim()).filter(Boolean)
  return partes.length > 1 ? partes : null
}

function Chip({ children, tono = "neutro" }: { children: React.ReactNode; tono?: "neutro" | "ambar" | "verde" }) {
  const clase = tono === "ambar" ? "border-amber-400/50 text-amber-200" : tono === "verde" ? "border-emerald-400/40 text-emerald-200" : "border-white/15 text-zinc-300"
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] ${clase}`}>{children}</span>
}

function Campo({ c: crudo, opciones = [] }: { c: CampoLeido; /** opciones de eslogan cuando el eslogan aún no está decidido */ opciones?: string[] }) {
  const sep = separarPropuesta(crudo.valor)
  const c: CampoLeido = sep.propuesta ? { ...crudo, valor: sep.valor, estado: "propuesta" } : crudo
  const viñetas = viñetasDelCampo(c)
  const largo = !!c.valor && !viñetas && c.valor.length > LARGO_PLEGADO
  const opcionesLeidas = c.valor ? [] : opciones.map((o) => separarPropuesta(o)).filter((o): o is { valor: string; propuesta: boolean } => !!o.valor)
  return (
    <div data-campo={c.clave} data-estado={c.estado} className="border-t border-white/[0.06] py-3 first:border-t-0 first:pt-0">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h4 className="text-[11px] uppercase tracking-[0.08em] text-zinc-500">{c.etiqueta}</h4>
        {c.estado === "propuesta" && <Chip tono="ambar">propuesta del agente · sin validar</Chip>}
        {c.origen === "dueno" && <Chip tono="verde">escrito por el dueño</Chip>}
        {c.origen === "aceptado" && <Chip>aceptado por el dueño</Chip>}
      </div>
      {!c.valor && <p className="text-[13px] italic text-amber-200/80">{c.nota ?? "Sin dato"}</p>}
      {c.valor && viñetas && <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-zinc-200">{viñetas.map((v, i) => <li key={i}>{v}</li>)}</ul>}
      {c.valor && !viñetas && !largo && <p className="whitespace-pre-line text-[13px] leading-relaxed text-zinc-200">{c.valor}</p>}
      {c.valor && !viñetas && largo && (
        <details className="group">
          <summary className="cursor-pointer list-none whitespace-pre-line text-[13px] leading-relaxed text-zinc-200 group-open:hidden">{c.valor.slice(0, LARGO_PLEGADO).trimEnd()}… <span className="text-amber-300">Leer todo</span></summary>
          <p className="whitespace-pre-line text-[13px] leading-relaxed text-zinc-200">{c.valor}</p>
        </details>
      )}
      {c.explicacion && <details className="mt-1 text-[11.5px] text-zinc-500"><summary className="cursor-pointer">Por qué se propone</summary><p className="mt-1">{c.explicacion}</p></details>}
      {opcionesLeidas.length > 0 && (
        <div className="mt-2" data-opciones={c.clave}>
          <h5 className="mb-1 text-[11px] text-zinc-500">Opciones de eslogan · sin decidir</h5>
          <ul className="space-y-1">{opcionesLeidas.map((o, i) => <li key={i} className="flex flex-wrap items-center gap-2 text-[13px] text-zinc-200"><span>«{o.valor}»</span>{o.propuesta ? <Chip tono="ambar">propuesta del agente</Chip> : <Chip tono="verde">dicho por el cliente</Chip>}</li>)}</ul>
        </div>
      )}
    </div>
  )
}

export function PanelManual({ onCerrar, datosIniciales = null }: { onCerrar: () => void; datosIniciales?: ManualDelCliente | null }) {
  const [datos, setDatos] = useState<ManualDelCliente | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!datosIniciales)
  const [cliente, setCliente] = useState<string | null>(datosIniciales?.cliente?.id ?? null)
  const cerrar = useRef<HTMLButtonElement>(null)

  useEffect(() => { cerrar.current?.focus() }, [])
  // Esc cierra el manual y NO la oficina: se atiende en captura y se detiene ahí
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); onCerrar() } }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar])

  const leer = useCallback(async (id: string | null) => {
    setCargando(true); setError(null)
    try {
      const r = await fetch(`/api/manual${id ? `?cliente=${encodeURIComponent(id)}` : ""}`, { cache: "no-store" })
      const j = (await r.json().catch(() => null)) as Respuesta | null
      if (!r.ok || !j || !j.ok) throw new Error(r.status === 401 || r.status === 403 ? "Necesitas una sesión de administrador para ver el manual." : (j && !j.ok && j.error) || `No pude leer el manual (${r.status}).`)
      setDatos(j); setCliente(j.cliente?.id ?? null)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setCargando(false) }
  }, [])
  useEffect(() => { if (!datosIniciales) void leer(null) }, [leer, datosIniciales])

  const m = datos?.manual ?? null
  const campos = new Map((m?.lector.campos ?? []).map((c) => [c.clave, c]))
  const faltan = m ? m.lector.huecos.map(etiquetaDelHueco) : []

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <style>{ESTILO}</style>
      <section role="dialog" aria-modal="true" aria-labelledby="manual-titulo" data-seccion="manual" className="relative flex max-h-full w-full max-w-[1280px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#171717] text-zinc-200 shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <h2 id="manual-titulo" className="font-display text-[15px] font-light uppercase tracking-[0.28em]" style={{ color: AMBAR }}>Manual de marca</h2>
          <p className="hidden text-[12px] text-zinc-500 md:block">Lo que la marca es, cómo habla y cómo se ve · solo lectura</p>
          <label className="ml-auto flex items-center gap-2 text-[12px] text-zinc-400">
            <span>Cliente</span>
            <select value={cliente ?? ""} onChange={(e) => void leer(e.target.value || null)} disabled={!datos || cargando} aria-label="Elegir el cliente"
              className="rounded-md border border-white/10 bg-[#111] px-2 py-1 text-[13px] text-zinc-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">
              {(datos?.clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.con_manual ? "" : " · sin manual"}</option>)}
              {!datos && <option value="">Leyendo…</option>}
            </select>
          </label>
          <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </button>
        </header>

        {error && <p role="alert" className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-[13px] text-rose-200 sm:px-6">{error}</p>}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {!datos && !error && <p className="text-[13px] text-zinc-500">Leyendo el manual…</p>}
          {datos && !m && <p className="text-[13px] text-zinc-400">{datos.cliente ? `${datos.cliente.nombre} todavía no tiene manual de marca.` : "No hay clientes para mostrar."}</p>}
          {datos && m && (
            <>
              {/* la portada: quién es, qué versión, quién lo validó, qué falta */}
              <section aria-label="La portada del manual" className="mn-seccion mb-5 rounded-lg border border-white/10 bg-black/30 p-4 sm:p-5">
                <h3 className="font-display text-[24px] font-semibold leading-tight tracking-tight text-zinc-50">{datos.cliente?.nombre}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Chip>{m.version != null ? `versión ${m.version}` : "sin versión"}{m.versiones > 1 ? ` · ${m.versiones} versiones` : ""}</Chip>
                  <Chip tono={m.lector.validadoPor === "propuesta" ? "ambar" : "verde"}>{m.lector.rotulo}</Chip>
                  <Chip tono={m.lector.completo ? "neutro" : "ambar"}>{m.lector.completo ? (m.lector.rotuloVisual ?? "Completo") : `Incompleto · faltan ${faltan.length}`}</Chip>
                  <Chip>{m.fidelidad}</Chip>
                  {m.origen && <Chip>{m.origen}</Chip>}
                </div>
                {!m.lector.completo && faltan.length > 0 && <p className="mt-2 text-[12px] text-amber-200/80">Falta: {faltan.join(" · ")}</p>}
                <p className="mt-2 text-[11.5px] text-zinc-500">{m.actualizado_en ? `Última actualización ${fechaCortaEC(m.actualizado_en)}` : ""}{m.creado_en ? ` · creado ${fechaCortaEC(m.creado_en)}` : ""}</p>
              </section>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
                <div className="min-w-0 space-y-5">
                  {APARTADOS_DEL_MANUAL.map((ap, i) => {
                    const lista = ap.claves.map((k) => campos.get(k)).filter((c): c is CampoLeido => !!c)
                    if (!lista.length) return null
                    return (
                      <section key={ap.titulo} aria-label={ap.titulo} className="mn-seccion rounded-lg border border-white/10 bg-white/[0.02] p-4" style={{ animationDelay: `${60 + i * 60}ms` }}>
                        <h3 className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em]" style={{ color: AMBAR }}>{ap.titulo}</h3>
                        {lista.map((c) => <Campo key={c.clave} c={c} opciones={c.clave === "eslogan" ? m.opciones_eslogan : []} />)}
                      </section>
                    )
                  })}

                  {(m.palabras_prohibidas.length > 0 || m.terminos_propios.length > 0 || m.politica_competidores) && (
                    <section aria-label="Palabras" className="mn-seccion rounded-lg border border-white/10 bg-white/[0.02] p-4" style={{ animationDelay: "240ms" }}>
                      <h3 className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em]" style={{ color: AMBAR }}>Palabras</h3>
                      {m.terminos_propios.length > 0 && (
                        <div className="mb-3"><h4 className="mb-1.5 text-[11px] uppercase tracking-[0.08em] text-zinc-500">Términos propios · se usan</h4>
                          <ul className="flex flex-wrap gap-1.5">{m.terminos_propios.map((t) => <li key={t} className="rounded-md border border-emerald-400/25 bg-emerald-400/[0.06] px-2 py-0.5 text-[12px] text-emerald-100">{t}</li>)}</ul></div>
                      )}
                      {m.palabras_prohibidas.length > 0 && (
                        <div className="mb-3"><h4 className="mb-1.5 text-[11px] uppercase tracking-[0.08em] text-zinc-500">Palabras prohibidas · nunca</h4>
                          <ul className="flex flex-wrap gap-1.5">{m.palabras_prohibidas.map((t) => <li key={t} className="rounded-md border border-rose-400/25 bg-rose-400/[0.06] px-2 py-0.5 text-[12px] text-rose-100 line-through decoration-rose-300/60">{t}</li>)}</ul></div>
                      )}
                      {m.politica_competidores && <p className="text-[12.5px] text-zinc-300"><span className="text-zinc-500">Competencia · </span>{m.politica_competidores}</p>}
                    </section>
                  )}
                </div>

                {/* la identidad visual: colores y letras con su procedencia */}
                <aside aria-label="Identidad visual" className="mn-seccion space-y-5 lg:sticky lg:top-0 lg:self-start" style={{ animationDelay: "120ms" }}>
                  <section className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                    <h3 className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em]" style={{ color: AMBAR }}>Colores</h3>
                    {m.colores.length === 0 ? <p className="text-[12.5px] italic text-zinc-500">Sin colores observados todavía.</p> : (
                      <ul className="grid grid-cols-3 gap-2" aria-label="La paleta">
                        {m.colores.map((c, i) => (
                          <li key={`${c.hex}-${i}`} className="min-w-0">
                            <div className="mn-color flex aspect-square items-end rounded-lg p-1.5 ring-1 ring-white/10" style={{ background: c.hex }} data-color={c.hex} title={procedenciaLegible(c.procedencia) ?? undefined}>
                              <span className="font-mono text-[10px]" style={{ color: contrasteDelTexto(c.hex) }}>{c.hex}</span>
                            </div>
                            <p className="mt-1 truncate text-[11px] text-zinc-400">{rolDelColorLegible(c.rol)}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                    {m.colores[0]?.procedencia && <p className="mt-2 text-[11px] text-zinc-500">Tomados {procedenciaLegible(m.colores[0].procedencia)}.</p>}
                  </section>
                  <section className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                    <h3 className="mb-3 text-[12px] font-medium uppercase tracking-[0.18em]" style={{ color: AMBAR }}>Letras</h3>
                    {m.tipografias.length === 0 ? <p className="text-[12.5px] italic text-zinc-500">{m.lector.rotuloVisual ? "Sin letra observada en el sitio." : "Sin tipografías observadas todavía."}</p> : (
                      <ul className="space-y-2">
                        {m.tipografias.map((t, i) => (
                          <li key={`${t.familia}-${i}`} className="flex items-baseline justify-between gap-3 border-t border-white/[0.06] pt-2 first:border-t-0 first:pt-0">
                            <span className="text-[16px] text-zinc-100" style={{ fontFamily: `"${t.familia}", system-ui, sans-serif` }}>{t.familia}</span>
                            <span className="shrink-0 text-[11px] text-zinc-500">{rolDeLaLetraLegible(t.rol)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </aside>
              </div>
            </>
          )}
        </div>
        <footer className="border-t border-white/10 px-4 py-2 text-[11.5px] text-zinc-500 sm:px-6">Solo lectura · editar y validar el manual desde aquí es el siguiente paso del dashboard nuevo.</footer>
      </section>
    </div>
  )
}
