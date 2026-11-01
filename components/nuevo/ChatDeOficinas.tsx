"use client"

/**
 * EL CUADRO DE CHAT DE /nuevo («Habla con tus oficinas…») · 01-nov · ahora CONVERSA.
 * Usa lo que ya existía del dashboard viejo: el mismo servidor de mensajes (`/api/cowork/prompt`, flujo en vivo), la misma libreta de conversaciones
 * (`cowork_messages`) y las mismas sesiones del navegador (`lib/cowork-session`). El diseño del cuadro no cambia; la conversación se abre ENCIMA y el cuadro sigue siempre visible.
 * Micrófono: escucha y habla con el navegador (Web Speech, sin costo). Tocarlo abre la conversación por voz; tocarlo de nuevo la corta.
 * La herramienta del asistente nunca actúa sola: propone un PEDIDO y solo queda anotado si Emilio toca el botón.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { usePathname } from "next/navigation"
import { Globe, Microphone, MicrophoneSlash, PaperPlaneTilt, Paperclip, X } from "@phosphor-icons/react"
import { getOrCreateSessionId } from "@/lib/cowork-session"
import { leerEventos, leerPedido, textoParaVoz, type PedidoPropuesto } from "@/lib/chat-oficinas"

const AMBAR = "#e8731a"
const CANAL = "nuevo"

interface Mensaje {
  rol: "user" | "assistant"
  texto: string
  pedido?: PedidoPropuesto
  pedidoEstado?: "anotado" | "error"
  error?: boolean
}

/** lo mínimo del reconocimiento de voz del navegador (no está en los tipos estándar) */
interface Reconocimiento {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type FabricaReconocimiento = new () => Reconocimiento

function fabricaDeVoz(): FabricaReconocimiento | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as { SpeechRecognition?: FabricaReconocimiento; webkitSpeechRecognition?: FabricaReconocimiento }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function ChatDeOficinas() {
  const pagina = usePathname()
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [texto, setTexto] = useState("")
  const [abierto, setAbierto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [vozActiva, setVozActiva] = useState(false)
  const [escuchando, setEscuchando] = useState(false)
  const [hablando, setHablando] = useState(false)
  const [vozNoDisponible, setVozNoDisponible] = useState(false)
  const sesion = useRef<string>("")
  const abortar = useRef<AbortController | null>(null)
  const reconocedor = useRef<Reconocimiento | null>(null)
  const vozRef = useRef(false)
  const enviandoRef = useRef(false)
  const fondo = useRef<HTMLDivElement | null>(null)
  /* `escuchar` vive entre renders: llama siempre al `enviar` más reciente (con la conversación al día) */
  const enviarRef = useRef<((t: string, porVoz?: boolean) => Promise<void>) | null>(null)

  /* la conversación anterior de esta misma sesión (si el navegador ya la tenía) */
  useEffect(() => {
    sesion.current = getOrCreateSessionId(CANAL)
    setVozNoDisponible(!fabricaDeVoz() || typeof window.speechSynthesis === "undefined")
    let vivo = true
    void (async () => {
      try {
        const r = await fetch(`/api/cowork/prompt-history?session_id=${encodeURIComponent(sesion.current)}&limit=20`)
        if (!r.ok) return
        const j = (await r.json()) as { turns?: Array<{ role: "user" | "assistant"; content: string }> }
        if (vivo && j.turns?.length) setMensajes(j.turns.map((t) => ({ rol: t.role, texto: t.content })))
      } catch {
        /* sin historia, la conversación empieza en blanco */
      }
    })()
    return () => { vivo = false }
  }, [])

  useEffect(() => { fondo.current?.scrollIntoView({ block: "end" }) }, [mensajes, abierto])

  const hablar = useCallback((frase: string, alTerminar?: () => void) => {
    const s = typeof window !== "undefined" ? window.speechSynthesis : undefined
    const dicho = textoParaVoz(frase)
    if (!s || !dicho) { alTerminar?.(); return }
    s.cancel()
    const u = new SpeechSynthesisUtterance(dicho)
    u.lang = "es-EC"
    const voces = s.getVoices().filter((v) => /^es/i.test(v.lang))
    const v = voces.find((x) => /es-EC/i.test(x.lang)) ?? voces.find((x) => /es-(MX|US|419)/i.test(x.lang)) ?? voces[0]
    if (v) u.voice = v
    u.onstart = () => setHablando(true)
    u.onend = () => { setHablando(false); alTerminar?.() }
    u.onerror = () => { setHablando(false); alTerminar?.() }
    s.speak(u)
  }, [])

  const escuchar = useCallback(() => {
    const Fabrica = fabricaDeVoz()
    if (!Fabrica || !vozRef.current || enviandoRef.current) return
    const r = new Fabrica()
    r.lang = "es-EC"
    r.interimResults = false
    r.continuous = false
    let dicho = ""
    r.onresult = (e) => {
      for (let i = 0; i < e.results.length; i++) if (e.results[i].isFinal) dicho += e.results[i][0].transcript + " "
    }
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") { vozRef.current = false; setVozActiva(false); setVozNoDisponible(true) }
    }
    r.onend = () => {
      setEscuchando(false)
      reconocedor.current = null
      const frase = dicho.trim()
      if (!vozRef.current) return
      if (frase) void enviarRef.current?.(frase, true)
      else window.setTimeout(() => { if (vozRef.current && !enviandoRef.current) escuchar() }, 300)
    }
    reconocedor.current = r
    try { r.start(); setEscuchando(true) } catch { setEscuchando(false) }
  }, [])

  const enviar = useCallback(async (crudo: string, porVoz = false) => {
    const mensaje = crudo.trim()
    if (!mensaje || enviandoRef.current) return
    enviandoRef.current = true
    setEnviando(true)
    setAbierto(true)
    const previos = mensajes.filter((m) => !m.error).slice(-12).map((m) => ({ role: m.rol, content: m.texto }))
    setMensajes((m) => [...m, { rol: "user", texto: mensaje }, { rol: "assistant", texto: "" }])
    setTexto("")
    const ctl = new AbortController()
    abortar.current = ctl
    let respuesta = ""
    let pedido: PedidoPropuesto | undefined
    let fallo = ""
    try {
      const r = await fetch("/api/cowork/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: mensaje, session_id: sesion.current, history: previos, context: { channel: CANAL, page: pagina ?? "/nuevo", surface_state: { voz: porVoz } } }),
        signal: ctl.signal,
      })
      if (!r.body) throw new Error("sin_respuesta")
      const lector = r.body.getReader()
      const dec = new TextDecoder()
      let pendiente = ""
      for (;;) {
        const { done, value } = await lector.read()
        if (done) break
        pendiente += dec.decode(value, { stream: true })
        const { eventos, resto } = leerEventos(pendiente)
        pendiente = resto
        for (const ev of eventos) {
          if (ev.event === "text" && typeof ev.data.value === "string") {
            respuesta += ev.data.value
            const parcial = respuesta
            setMensajes((m) => { const c = m.slice(); c[c.length - 1] = { rol: "assistant", texto: parcial }; return c })
          } else if (ev.event === "tool_use" && ev.data.name === "proponer_pedido") {
            pedido = leerPedido(ev.data.input as Record<string, unknown> | undefined) ?? pedido
          } else if (ev.event === "error") {
            fallo = String(ev.data.message ?? "error")
          }
        }
      }
    } catch (e) {
      if ((e as { name?: string })?.name !== "AbortError") fallo = "sin_conexion"
    }
    const texto = respuesta || (fallo ? (fallo === "unauthenticated" ? "Tu sesión venció: vuelve a entrar para conversar." : "No pude responder ahora. Inténtalo de nuevo en un momento.") : "")
    setMensajes((m) => { const c = m.slice(); c[c.length - 1] = { rol: "assistant", texto, pedido, error: !respuesta && !!fallo }; return c })
    enviandoRef.current = false
    setEnviando(false)
    abortar.current = null
    if (vozRef.current && porVoz) hablar(texto, () => { if (vozRef.current) escuchar() })
    else if (vozRef.current) escuchar()
  }, [mensajes, pagina, hablar, escuchar])

  enviarRef.current = enviar

  const apagarVoz = useCallback(() => {
    vozRef.current = false
    setVozActiva(false)
    setEscuchando(false)
    setHablando(false)
    try { reconocedor.current?.abort() } catch { /* ya estaba parado */ }
    reconocedor.current = null
    if (typeof window !== "undefined") window.speechSynthesis?.cancel()
  }, [])

  const alternarVoz = () => {
    if (vozNoDisponible) return
    if (vozRef.current) { apagarVoz(); return }
    vozRef.current = true
    setVozActiva(true)
    setAbierto(true)
    hablar("Hola, te escucho.", () => { if (vozRef.current) escuchar() })
  }

  useEffect(() => () => { apagarVoz(); abortar.current?.abort() }, [apagarVoz])

  const alEnviar = (e: FormEvent) => { e.preventDefault(); void enviar(texto) }
  const alTeclear = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(texto) } }

  const anotarPedido = async (i: number) => {
    const p = mensajes[i]?.pedido
    if (!p) return
    let ok = false
    try {
      const r = await fetch("/api/cowork/pedido", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...p, session_id: sesion.current }) })
      ok = r.ok
    } catch { ok = false }
    setMensajes((m) => m.map((x, j) => (j === i ? { ...x, pedidoEstado: ok ? "anotado" : "error" } : x)))
  }

  return (
    <div data-chat-de-oficinas aria-label="Chat con tus oficinas"
      className="absolute bottom-6 left-1/2 z-10 w-[min(610px,calc(100vw-7rem))] -translate-x-1/2">
      {abierto && (
        <section data-chat-conversacion aria-label="Conversación" aria-live="polite"
          className="absolute bottom-full left-0 right-0 mb-2 flex max-h-[min(46vh,420px)] flex-col rounded-xl border bg-[#1b1b1d]/95 backdrop-blur" style={{ borderColor: "rgba(232,115,26,.55)" }}>
          <div className="flex items-center justify-between px-4 pt-2.5 text-[12px] text-zinc-400">
            <span>{vozActiva ? (hablando ? "Hablando…" : escuchando ? "Te escucho…" : "Conversación por voz") : "Conversación"}</span>
            <button type="button" aria-label="Cerrar la conversación" onClick={() => setAbierto(false)} className="rounded p-1 text-zinc-300 hover:bg-white/[0.07] hover:text-white"><X size={14} /></button>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 text-[14px] leading-relaxed">
            {mensajes.length === 0 && <p className="text-zinc-500">Pregúntame por tus oficinas o pídeme algo: lo que haya que construir queda como pedido.</p>}
            {mensajes.map((m, i) => (
              <div key={i} className={m.rol === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[88%] whitespace-pre-wrap rounded-lg px-3 py-2 ${m.rol === "user" ? "bg-white/[0.08] text-zinc-100" : m.error ? "text-amber-300" : "text-zinc-200"}`}>
                  {m.texto || (enviando && i === mensajes.length - 1 ? <span className="text-zinc-500">…</span> : null)}
                  {m.pedido && (
                    <div className="mt-2 rounded-md border border-white/10 p-2 text-[13px]">
                      <p className="font-medium text-zinc-100">{m.pedido.titulo}</p>
                      <p className="mt-0.5 text-zinc-400">{m.pedido.detalle}</p>
                      {m.pedidoEstado === "anotado" ? <p className="mt-1.5 text-emerald-400">Anotado como pedido para Lenovo.</p> : (
                        <button type="button" onClick={() => void anotarPedido(i)} className="mt-1.5 rounded-md px-2.5 py-1 text-[12px] text-white" style={{ backgroundColor: AMBAR }}>Dejar como pedido</button>
                      )}
                      {m.pedidoEstado === "error" && <p className="mt-1 text-amber-300">No se pudo anotar. Inténtalo otra vez.</p>}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={fondo} />
          </div>
        </section>
      )}
      <form onSubmit={alEnviar} className="rounded-xl border p-[7px]" style={{ borderColor: "rgba(232,115,26,.55)" }}>
        <div className="rounded-lg bg-[#1b1b1d] px-4 py-3.5">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={alTeclear} onFocus={() => mensajes.length > 0 && setAbierto(true)}
            rows={1} maxLength={8000} placeholder="Habla con tus oficinas…" aria-label="Escribe tu mensaje"
            className="block max-h-24 w-full resize-none bg-transparent text-[14px] text-zinc-100 outline-none placeholder:text-zinc-400" />
          <div className="mt-4 flex items-center gap-3 text-zinc-300">
            <span aria-hidden="true" title="Adjuntar archivos: todavía no" className="opacity-60"><Paperclip size={17} /></span>
            <span aria-hidden="true" className="opacity-60"><Globe size={17} /></span>
            <button type="button" onClick={alternarVoz} disabled={vozNoDisponible} aria-pressed={vozActiva}
              aria-label={vozNoDisponible ? "La voz no está disponible en este navegador" : vozActiva ? "Cortar la conversación por voz" : "Hablar por voz"}
              title={vozNoDisponible ? "La voz no está disponible en este navegador" : vozActiva ? "Cortar la conversación por voz" : "Hablar por voz"}
              className={`ml-auto flex h-10 w-10 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${vozActiva ? "text-white" : "border-white/15 text-zinc-300 hover:bg-white/[0.07]"}`}
              style={vozActiva ? { backgroundColor: escuchando ? "#b45309" : AMBAR, borderColor: AMBAR } : undefined}>
              {vozNoDisponible ? <MicrophoneSlash size={18} /> : <Microphone size={18} weight={vozActiva ? "fill" : "regular"} />}
            </button>
            <button type="submit" disabled={enviando || !texto.trim()} aria-label="Enviar"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-white disabled:opacity-50" style={{ backgroundColor: AMBAR }}>
              <PaperPlaneTilt size={18} weight="regular" />
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
