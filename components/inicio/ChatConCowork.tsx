"use client"

import { useCallback, useEffect, useState } from "react"

interface Mensaje { id: string; created_at: string; content: string; status: string; response_content: string | null; responded_at: string | null }

const hora = (iso: string) => new Date(iso).toLocaleString("es-EC", { timeZone: "America/Guayaquil", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })

/** El chat con Cowork, plegable al pie del Inicio. Los mensajes quedan guardados; Cowork responde cuando lee su bandeja (no es en vivo). */
export function ChatConCowork({ sinRespuesta }: { sinRespuesta: number | null }) {
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState<Mensaje[] | null>(null)
  const [errorLectura, setErrorLectura] = useState<string | null>(null)
  const [texto, setTexto] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/cowork/messages?status=all&limit=6", { cache: "no-store" })
      const j = (await r.json()) as { ok: boolean; messages?: Mensaje[]; error?: string }
      if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`)
      setMensajes(j.messages ?? [])
      setErrorLectura(null)
    } catch (e) {
      setErrorLectura(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => { if (abierto && mensajes === null) void cargar() }, [abierto, mensajes, cargar])

  async function enviar() {
    const contenido = texto.trim()
    if (!contenido || enviando) return
    setEnviando(true)
    setAviso(null)
    try {
      const r = await fetch("/api/cowork/message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: contenido, sender_user_id: "emilio" }) })
      const j = (await r.json()) as { ok: boolean; error?: string }
      if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`)
      setTexto("")
      setAviso({ ok: true, texto: "Guardado." })
      await cargar()
    } catch (e) {
      setAviso({ ok: false, texto: `No se guardó: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="surface-card p-5">
      <button type="button" onClick={() => setAbierto((x) => !x)} aria-expanded={abierto} className="flex w-full items-center justify-between text-left">
        <span className="font-display text-[16px] font-semibold">Chat con Cowork</span>
        <span className="text-[12px] text-[hsl(var(--muted-foreground))]">
          {sinRespuesta != null && sinRespuesta > 0 ? `${sinRespuesta} sin leer · ` : ""}{abierto ? "Ocultar" : "Abrir"}
        </span>
      </button>
      {abierto && (
        <div className="mt-4 flex flex-col gap-3">
          {errorLectura && <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-[13px] text-rose-200">No pude leer los mensajes: {errorLectura}</p>}
          {mensajes && mensajes.length === 0 && <p className="text-[13px] text-[hsl(var(--muted-foreground))]">Todavía no hay mensajes.</p>}
          {mensajes && [...mensajes].reverse().map((m) => (
            <div key={m.id} className="text-[13px]">
              <p><span className="text-[hsl(var(--muted-foreground))]">{hora(m.created_at)} · tú:</span> {m.content}</p>
              {m.response_content
                ? <p className="mt-1 border-l-2 border-white/15 pl-3"><span className="text-[hsl(var(--muted-foreground))]">Cowork{m.responded_at ? ` · ${hora(m.responded_at)}` : ""}:</span> {m.response_content}</p>
                : <p className="mt-1 text-[12px] text-amber-300">Sin respuesta todavía</p>}
            </div>
          ))}
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") void enviar() }} maxLength={4000} rows={3} placeholder="Escribe un mensaje…" className="w-full rounded-lg border border-white/10 bg-transparent p-3 text-[13px] outline-none focus:border-[hsl(var(--primary))]" />
          <div className="flex items-center justify-between gap-3">
            <p className={`text-[12px] ${aviso ? (aviso.ok ? "text-emerald-300" : "text-rose-300") : "text-[hsl(var(--muted-foreground))]"}`}>{aviso?.texto ?? "No es en vivo."}</p>
            <button type="button" onClick={() => void enviar()} disabled={enviando || texto.trim().length === 0} className="rounded-lg border border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.18)] px-4 py-1.5 text-[13px] font-medium disabled:opacity-40">{enviando ? "Enviando…" : "Enviar"}</button>
          </div>
        </div>
      )}
    </section>
  )
}
