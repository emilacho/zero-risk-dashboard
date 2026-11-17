"use client"

import { useState } from "react"
import type { DetalleDelConcepto, IdeaDelBanco } from "@/lib/concepto-datos"
import { RenglonEditable } from "@/components/nuevo/manual/RenglonEditable"
import { sinCodigos, sinMarcasDeFormato, type ContextoSinCodigos } from "@/lib/sin-codigos"
import { plural } from "@/lib/lenguaje"
import {
  ALCANCE_DE_LOS_CAMBIOS, AL_RETIRAR, CAMPOS_EDITABLES, ETIQUETA_DEL_CAMPO, IDEAS_A_LA_VISTA, bancoEditable, bancoPorCapitulo, conEdicion, cuantosCambios,
  cuerpoDeEdicion, nombreDeRed, type CampoEditable, type EdicionesDelBanco,
} from "@/lib/banco-de-ideas"

/**
 * EL BANCO DE IDEAS dentro de la Gran Idea (17-nov · boceto aprobado por Emilio · `raw/evidencia/2026-11-17-banco-de-ideas/`).
 * Un plegable por capítulo; cada idea se abre y cada campo tiene «Editar» (el renglón del manual). Lo editado queda en «Tus cambios» y sale junto
 * con «Pedir los cambios» (no reescribe ni gasta). «Retirar esta idea» pide confirmación y la plataforma la saca del banco.
 * Solo la gran idea APROBADA se edita: es la que leen el calendario y las hojas. Las demás versiones se leen igual, sin botones.
 */
type Respuesta = { ok: true; nota?: string } | { ok: false; error?: string; detalle?: string }
const CHIP = "inline-flex items-center rounded-full border border-white/15 px-2.5 py-0.5 text-[11px] text-zinc-300"
const Chev = ({ abierta }: { abierta: boolean }) => <span aria-hidden className={`mt-0.5 text-zinc-500 transition ${abierta ? "rotate-90" : ""}`}>›</span>
const fotosDe = (f: string | null): string => {
  if (!f) return "sin foto (se arma con texto y fondo)"
  const n = f.split("|").filter(Boolean).length
  return n === 1 ? "1 foto del expediente" : `${n} fotos del expediente`
}
export const rutaDelBanco = (hitlId: string) => `/api/piezas/${hitlId}/gran-idea/banco`

export function BancoDeIdeas({ d, ctx, onGuardado, fetchImpl = fetch }: {
  d: Pick<DetalleDelConcepto, "hitl_id" | "estado" | "version" | "campana_id" | "banco" | "capitulos">
  ctx: ContextoSinCodigos
  /** tras guardar o retirar: la pantalla vuelve a leer la gran idea */
  onGuardado: () => Promise<void> | void
  fetchImpl?: typeof fetch
}) {
  const editable = bancoEditable(d)
  const capitulos = bancoPorCapitulo(d.banco, d.capitulos)
  const series = new Map(d.capitulos.flatMap((c) => c.series.map((s) => [s.id, s.nombre] as const)))
  const [capAbiertos, setCapAbiertos] = useState<Set<string>>(new Set())
  const [todas, setTodas] = useState<Set<string>>(new Set())
  const [abierta, setAbierta] = useState<string | null>(null)
  const [ediciones, setEdiciones] = useState<EdicionesDelBanco>({})
  const [retirando, setRetirando] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const limpio = (t: string) => sinMarcasDeFormato(sinCodigos(t, ctx))
  const porId = new Map(d.banco.map((i) => [i.id, i]))
  const nombreDelCapitulo = (i: IdeaDelBanco) => capitulos.find((c) => c.ideas.includes(i))?.nombre ?? "Sin capítulo"
  const n = cuantosCambios(ediciones)

  const alternar = (s: Set<string>, k: string) => { const x = new Set(s); if (x.has(k)) x.delete(k); else x.add(k); return x }
  const enviar = async (cuerpo: unknown, alSalir: () => void) => {
    setEnviando(true); setMensaje(null)
    try {
      const r = await fetchImpl(rutaDelBanco(d.hitl_id), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) })
      const j = (await r.json().catch(() => ({}))) as Respuesta
      if (r.ok && j.ok) { alSalir(); setMensaje({ ok: true, texto: j.nota ?? "Listo." }); await onGuardado(); return }
      setMensaje({ ok: false, texto: (!j.ok && (j.detalle || j.error)) || `No se pudo guardar (${r.status}).` })
    } catch { setMensaje({ ok: false, texto: "No se pudo contactar al servidor." }) } finally { setEnviando(false) }
  }
  const pedir = () => { if (d.version != null && n) void enviar(cuerpoDeEdicion(d.version, ediciones), () => setEdiciones({})) }
  const retirar = (id: string) => {
    if (d.version == null) return
    void enviar({ accion: "retirar", version: d.version, idea_id: id }, () => {
      setRetirando(null); setAbierta(null)
      setEdiciones((e) => { const x = { ...e }; delete x[id]; return x })
    })
  }

  const deshacer = (id: string, c: CampoEditable) => setEdiciones((e) => {
    const x = { ...e }, deLaIdea = { ...(x[id] ?? {}) }
    delete deLaIdea[c]
    if (Object.keys(deLaIdea).length) x[id] = deLaIdea; else delete x[id]
    return x
  })
  /** una idea (función, no componente: así el editor abierto no se rearma en cada cambio de la pantalla) */
  const idea = (i: IdeaDelBanco) => {
    const chip = <span className={CHIP}>{nombreDeRed(i.red)}{i.formato ? ` · ${i.formato}` : ""}</span>
    const ed = ediciones[i.id] ?? {}
    const enEspera = Object.keys(ed).length > 0
    if (abierta !== i.id) {
      const t = limpio(ed.idea ?? i.idea)
      return (
        <li key={i.id} data-idea={i.id} className="rounded-lg border border-white/10 bg-black/20">
          <button type="button" aria-expanded={false} onClick={() => { setAbierta(i.id); setRetirando(null) }} className="flex w-full items-start gap-3 px-3 py-2.5 text-left">
            <span className="min-w-0 flex-1"><span className="block text-[13px] text-zinc-100">{t.length > 120 ? `${t.slice(0, 119).trimEnd()}…` : t}</span><span className="mt-1 flex flex-wrap gap-1.5">{chip}{enEspera && <span className="rounded-full border border-amber-400/50 px-2 py-0.5 text-[10px] text-amber-200">editado · en espera</span>}</span></span>
            <Chev abierta={false} />
          </button>
        </li>
      )
    }
    return (
      <li key={i.id} data-idea={i.id} data-abierta="true" className="rounded-lg border border-amber-400/30 bg-white/[0.03]">
        <button type="button" aria-expanded onClick={() => setAbierta(null)} aria-label="Cerrar la idea" className="flex w-full items-start gap-3 px-3 pt-2.5 text-left">
          <span className="min-w-0 flex-1">{chip}</span><Chev abierta />
        </button>
        <div className="px-3 pb-3">
          {CAMPOS_EDITABLES.map((c: CampoEditable) => {
            const guardado = limpio(i[c])
            const valor = ed[c] ?? guardado
            if (!valor) return null
            return (
              <div key={c} data-campo={c} className="mt-2">
                <p className="mb-1 text-[11px] uppercase tracking-[0.08em] text-zinc-500">{ETIQUETA_DEL_CAMPO[c]}{ed[c] != null && <span className="ml-1 rounded-full border border-amber-400/50 px-2 py-0.5 text-[10px] normal-case tracking-normal text-amber-200">editado · en espera</span>}</p>
                {editable
                  ? <div className="flex flex-wrap items-start gap-3"><RenglonEditable key={valor} texto={valor} editado={ed[c] != null} sinVineta etiqueta={ETIQUETA_DEL_CAMPO[c].toLowerCase()} onEditar={(nuevo) => setEdiciones((e) => conEdicion(e, { ...i, [c]: guardado }, c, nuevo))} /></div>
                  : <p className={`text-[13.5px] leading-relaxed text-zinc-200`}>{valor}</p>}
              </div>
            )
          })}
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-zinc-400">
            {i.serie && series.get(i.serie) && <span>Serie: <span className="text-zinc-200">{limpio(series.get(i.serie)!)}</span></span>}
            <span>Foto: <span className="text-zinc-200">{fotosDe(i.foto)}</span></span>
          </div>
          {editable && (retirando === i.id
            ? <div data-aviso-retirar className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-rose-400/40 bg-rose-500/[0.06] px-3 py-2">
                <span className="text-[13.5px] text-zinc-100">¿Retirar esta idea? {AL_RETIRAR}{enEspera ? " Se va con tu edición en espera." : ""}</span>
                <button type="button" data-accion="confirmar-retirar-idea" disabled={enviando} onClick={() => retirar(i.id)} className="rounded-md border border-rose-400/60 bg-rose-500/15 px-3 py-1 text-[13px] text-rose-100 hover:bg-rose-500/25 disabled:opacity-40">{enviando ? "Retirando…" : "Sí, retirar"}</button>
                <button type="button" onClick={() => setRetirando(null)} className="rounded-md border border-white/10 px-3 py-1 text-[13px] text-zinc-300 hover:bg-white/[0.05]">Cancelar</button>
              </div>
            : <div className="mt-3 flex justify-end"><button type="button" data-accion="retirar-idea" onClick={() => setRetirando(i.id)} className="rounded-md border border-white/10 px-2 py-0.5 text-[12px] text-zinc-400 transition hover:border-rose-400/60 hover:text-rose-200">Retirar esta idea</button></div>)}
        </div>
      </li>
    )
  }

  return (
    <div data-banco-de-ideas>
      {mensaje && <p role="status" data-aviso={mensaje.ok ? "ok" : "error"} className={`mb-3 rounded-md border px-3 py-2 text-[12.5px] ${mensaje.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-rose-500/30 bg-rose-500/10 text-rose-200"}`}>{mensaje.texto}</p>}
      <div className="space-y-2">
        {capitulos.map((c) => {
          const abierto = capAbiertos.has(c.clave)
          const verTodas = todas.has(c.clave)
          const vistas = verTodas ? c.ideas : c.ideas.slice(0, IDEAS_A_LA_VISTA)
          const resto = c.ideas.length - vistas.length
          return (
            <section key={c.clave} data-capitulo={c.clave} className={`rounded-lg border ${abierto ? "border-amber-400/30 bg-white/[0.03]" : "border-white/10 bg-white/[0.02]"}`}>
              <button type="button" aria-expanded={abierto} onClick={() => setCapAbiertos((s) => alternar(s, c.clave))} className="flex w-full items-start gap-3 px-3.5 py-3 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium text-zinc-100">{limpio(c.nombre)} · {plural(c.ideas.length, "idea", "ideas")}</span>
                  {!abierto && <span className="mt-0.5 block text-[12.5px] leading-snug text-zinc-400">{(() => { const t = limpio(c.ideas[0].idea); return t.length > 150 ? `${t.slice(0, 149).trimEnd()}…` : t })()}</span>}
                </span>
                <Chev abierta={abierto} />
              </button>
              {abierto && (
                <div className="px-3.5 pb-3.5">
                  <ul className="space-y-2">{vistas.map(idea)}</ul>
                  {resto > 0 && <button type="button" data-accion="ver-todas" onClick={() => setTodas((s) => alternar(s, c.clave))} className="mt-2 px-1 text-[12px] text-zinc-400 underline decoration-dotted underline-offset-4 hover:text-zinc-200">… y {plural(resto, "idea más", "ideas más")} de este capítulo · ver todas</button>}
                  {verTodas && c.ideas.length > IDEAS_A_LA_VISTA && <button type="button" data-accion="ver-menos" onClick={() => setTodas((s) => alternar(s, c.clave))} className="mt-2 px-1 text-[12px] text-zinc-500 underline decoration-dotted underline-offset-4 hover:text-zinc-200">ver menos</button>}
                </div>
              )}
            </section>
          )
        })}
      </div>
      {editable && n > 0 && (
        <div data-tus-cambios className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/[0.07] p-3.5">
          <p className="text-[11px] uppercase tracking-[0.08em] text-zinc-500">Tus cambios · {n}</p>
          <ul className="mt-1 space-y-1 text-[13px] text-zinc-200">
            {Object.entries(ediciones).flatMap(([id, campos]) => Object.entries(campos).map(([c, t]) => {
              const i = porId.get(id)
              return (
                <li key={`${id}-${c}`} data-cambio={`${id}:${c}`} className="flex items-start gap-3">
                  <span className="min-w-0 flex-1">«{i ? limpio(nombreDelCapitulo(i)) : "Idea"}» · {ETIQUETA_DEL_CAMPO[c as CampoEditable]}: <span className="text-amber-50">{t}</span></span>
                  <button type="button" aria-label={`Deshacer el cambio de ${ETIQUETA_DEL_CAMPO[c as CampoEditable].toLowerCase()}`} onClick={() => deshacer(id, c as CampoEditable)} className="text-zinc-500 hover:text-zinc-200">✕</button>
                </li>
              )
            }))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" data-accion="pedir-cambios-banco" disabled={enviando} onClick={pedir} className="rounded-xl border border-amber-400/70 bg-amber-400/15 px-5 py-3 text-[14px] font-medium text-amber-100 hover:bg-amber-400/25 disabled:cursor-not-allowed disabled:opacity-40">{enviando ? "Enviando…" : "Pedir los cambios"}</button>
            <span className="text-[12px] text-zinc-400">No se reescribe ni gasta: se guarda tal cual. {ALCANCE_DE_LOS_CAMBIOS}</span>
          </div>
        </div>
      )}
    </div>
  )
}
