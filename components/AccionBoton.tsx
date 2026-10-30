"use client"
/**
 * Un botón del tablero que HACE algo (30-oct). Una sola forma para todos:
 *  · opcional: pide datos (campos) en un panel pequeño antes de enviar;
 *  · si la acción gasta, el panel muestra el tope y exige confirmar (el servidor también lo exige);
 *  · dice con franqueza el resultado: hecho, no disponible todavía, o por qué falló. Nunca finge.
 */
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

export interface CampoDeAccion {
  clave: string
  etiqueta: string
  tipo?: "texto" | "largo" | "numero" | "lista"
  opciones?: Array<{ valor: string; texto: string }>
  requerido?: boolean
  inicial?: string
  ayuda?: string
}

export interface AccionBotonProps {
  accion: string
  /** lo que el botón ya sabe (ids); los campos del panel se suman */
  datos?: Record<string, unknown>
  etiqueta: string
  campos?: CampoDeAccion[]
  /** si la acción puede gastar, el tope en dólares: se muestra y se confirma */
  tope_usd?: number
  /** texto de confirmación para acciones fuertes (dar de baja, apagar) */
  confirmar?: string
  variante?: "normal" | "suave" | "peligro"
  /** los campos del panel van dentro de este objeto del cuerpo (`campos`), y solo los que Emilio cambió; una clave «redes.instagram» anida un nivel más */
  anidar?: string
  /** adónde ir al terminar (por omisión, solo recargar) */
  alTerminar?: (resultado: Record<string, unknown>) => string | null
}

const CLASES: Record<NonNullable<AccionBotonProps["variante"]>, string> = {
  normal: "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.18)] text-white hover:bg-[hsl(var(--primary)/0.3)]",
  suave: "border-white/15 text-zinc-200 hover:bg-white/[0.06]",
  peligro: "border-rose-500/50 text-rose-200 hover:bg-rose-500/10",
}

const usd = (n: number) => `US$ ${n.toLocaleString("es-EC", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

export function AccionBoton(p: AccionBotonProps) {
  const router = useRouter()
  const campos = p.campos ?? []
  const necesitaPanel = campos.length > 0 || p.tope_usd != null || !!p.confirmar
  const [abierto, setAbierto] = useState(false)
  const [valores, setValores] = useState<Record<string, string>>(() => Object.fromEntries(campos.map((c) => [c.clave, c.inicial ?? ""])))
  const [estado, setEstado] = useState<"quieto" | "enviando">("quieto")
  const [leyendo, empezarLectura] = useTransition()
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const clase = `rounded-md border px-3 py-1.5 text-[12px] transition disabled:opacity-50 ${CLASES[p.variante ?? "normal"]}`

  async function enviar() {
    const faltan = campos.filter((c) => c.requerido && !(valores[c.clave] ?? "").trim())
    if (faltan.length) { setAviso({ ok: false, texto: `Falta: ${faltan.map((c) => c.etiqueta.toLowerCase()).join(", ")}.` }); return }
    setEstado("enviando"); setAviso(null)
    try {
      const cuerpo: Record<string, unknown> = { ...(p.datos ?? {}) }
      const destino: Record<string, unknown> = p.anidar ? {} : cuerpo
      for (const c of campos) {
        const v = (valores[c.clave] ?? "").trim()
        if (v === "" || (p.anidar && v === (c.inicial ?? "").trim())) continue
        const valor = c.tipo === "numero" ? Number(v) : v
        const [a, b] = c.clave.split(".")
        if (b) destino[a] = { ...((destino[a] as Record<string, unknown>) ?? {}), [b]: valor }
        else destino[a] = valor
      }
      if (p.anidar) cuerpo[p.anidar] = destino
      if (p.tope_usd != null) cuerpo.confirmo_gasto = true
      const r = await fetch(`/api/acciones/${encodeURIComponent(p.accion)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) })
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>
      if (r.ok && j.ok) {
        setAviso({ ok: true, texto: "Hecho." }); setAbierto(false)
        const destino = p.alTerminar?.((j.resultado ?? {}) as Record<string, unknown>)
        if (destino) router.push(destino); else empezarLectura(() => router.refresh())
      } else {
        const texto = r.status === 501 ? "Todavía no está disponible: la plataforma aún no tiene esta acción. No se cambió nada." : r.status === 401 ? "Tu sesión venció: entra de nuevo." : r.status === 409 ? `Otra decisión se adelantó; se actualizó la pantalla. ${String(j.detalle ?? "")}` : `No se pudo: ${String(j.detalle ?? j.error ?? r.status)}`
        setAviso({ ok: false, texto })
        if (r.status === 409) empezarLectura(() => router.refresh())
      }
    } catch (e) {
      setAviso({ ok: false, texto: `No se pudo: ${e instanceof Error ? e.message : String(e)}` })
    } finally { setEstado("quieto") }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1.5 align-top">
      <button type="button" disabled={estado === "enviando" || leyendo} className={clase} onClick={() => (necesitaPanel ? setAbierto(!abierto) : enviar())}>
        {estado === "enviando" ? "Enviando…" : leyendo ? "Actualizando…" : p.etiqueta}
      </button>
      {abierto && (
        <span data-editando className="surface-card block w-[320px] max-w-full space-y-2.5 p-3 text-[12px]">
          {p.confirmar && <span className="block text-zinc-200">{p.confirmar}</span>}
          {campos.map((c) => (
            <label key={c.clave} className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.06em] text-zinc-400">{c.etiqueta}{c.requerido ? " *" : ""}</span>
              {c.tipo === "largo" ? (
                <textarea rows={3} value={valores[c.clave] ?? ""} onChange={(e) => setValores({ ...valores, [c.clave]: e.target.value })} className="w-full rounded-md border border-white/15 bg-black/20 px-2 py-1.5 text-[12px]" />
              ) : c.tipo === "lista" ? (
                <select value={valores[c.clave] ?? ""} onChange={(e) => setValores({ ...valores, [c.clave]: e.target.value })} className="w-full rounded-md border border-white/15 bg-black/20 px-2 py-1.5 text-[12px]">
                  <option value="">Elige…</option>
                  {(c.opciones ?? []).map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
                </select>
              ) : (
                <input type={c.tipo === "numero" ? "number" : "text"} step={c.tipo === "numero" ? "any" : undefined} value={valores[c.clave] ?? ""} onChange={(e) => setValores({ ...valores, [c.clave]: e.target.value })} className="w-full rounded-md border border-white/15 bg-black/20 px-2 py-1.5 text-[12px]" />
              )}
              {c.ayuda && <span className="mt-0.5 block text-[11px] text-zinc-500">{c.ayuda}</span>}
            </label>
          ))}
          {p.tope_usd != null && <span className="block rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-amber-100">Esto puede costar hasta {usd(p.tope_usd)}. Al confirmar, el sistema empieza a gastar.</span>}
          <span className="flex gap-2">
            <button type="button" disabled={estado === "enviando"} onClick={enviar} className={clase}>{estado === "enviando" ? "Enviando…" : p.tope_usd != null ? `Confirmar (hasta ${usd(p.tope_usd)})` : "Confirmar"}</button>
            <button type="button" onClick={() => { setAbierto(false); setAviso(null) }} className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-zinc-400 hover:bg-white/[0.05]">Cancelar</button>
          </span>
        </span>
      )}
      {aviso && <span role="status" className={`block max-w-[320px] text-[12px] ${aviso.ok ? "text-emerald-300" : "text-rose-300"}`}>{aviso.texto}</span>}
    </span>
  )
}
