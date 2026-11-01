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
import { Globe, Microphone, MicrophoneSlash, PaperPlaneTilt, Paperclip } from "@phosphor-icons/react"
import { getOrCreateSessionId } from "@/lib/cowork-session"
import { TextoMarkdown } from "@/components/nuevo/TextoMarkdown"
import { causaDelFallo, leerEventos, leerPedido, textoParaVoz, type PedidoPropuesto } from "@/lib/chat-oficinas"

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

  useEffect(() => { fondo.current?.scrollIntoView({ block: "nearest" }) }, [mensajes])

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
    const previos = mensajes.filter((m) => !m.error).slice(-12).map((m) => ({ role: m.rol, content: m.texto }))
    setMensajes((m) => [...m, { rol: "user", texto: mensaje }, { rol: "assistant", texto: "" }])
    setTexto("")
    const ctl = new AbortController()
    abortar.current = ctl
    let respuesta = ""
    let pedido: PedidoPropuesto | undefined
    let fallo: Record<string, unknown> | null = null
    try {
      const r = await fetch("/api/cowork/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: mensaje, session_id: sesion.current, history: previos, context: { channel: CANAL, page: pagina ?? "/nuevo", surface_state: { voz: porVoz } } }),
        signal: ctl.signal,
      })
      // un fallo del servidor que no viene como flujo de eventos (500 de Vercel, 404…) se dice con su código en vez de quedar mudo
      if (!r.ok && !(r.headers.get("content-type") ?? "").includes("text/event-stream")) fallo = { http: r.status }
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
            fallo = { ...ev.data }
          }
        }
      }
    } catch (e) {
      const nombre = (e as { name?: string })?.name
      // «Failed to fetch» (TypeError) es no llegar al servidor; cualquier otra excepción es un fallo propio del navegador y se dice
      if (nombre !== "AbortError" && !fallo) fallo = nombre === "TypeError" ? { message: "sin_conexion" } : { message: `fallo del navegador: ${String((e as Error)?.message ?? e).slice(0, 80)}` }
    }
    const texto = respuesta || (fallo ? causaDelFallo(fallo) : "")
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
      {/* LAS RESPUESTAS VAN AL LADO del cuadro, en el espacio libre del fondo negro (encargo de Emilio 01-nov): solo texto blanco, sin ventana, sin borde, sin panel ni globo; no tapa la escena.
          Mide lo que queda libre a la derecha del cuadro y no más; las respuestas largas se ven completas desplazándose DENTRO de esa zona. En ventanas angostas, donde no hay lado, ocupa el mismo ancho justo encima del cuadro. */}
      {mensajes.length > 0 && (
        <div data-chat-respuestas aria-label="Respuestas" aria-live="polite" tabIndex={0}
          className="absolute bottom-[calc(100%+0.5rem)] left-0 right-0 max-h-[min(34vh,260px)] overflow-y-auto pr-1 text-[14px] leading-relaxed text-white outline-none min-[1100px]:bottom-0 min-[1100px]:left-full min-[1100px]:right-auto min-[1100px]:mb-0 min-[1100px]:ml-5 min-[1100px]:h-[min(55vh,26rem)] min-[1100px]:max-h-none min-[1100px]:w-[calc((100vw-min(610px,100vw-7rem))/2-2.5rem)]">
          {vozActiva && <p className="mb-1 text-[12px] text-white/60">{hablando ? "Hablando…" : escuchando ? "Te escucho…" : "Conversación por voz"}</p>}
          {mensajes.map((m, i) => m.rol === "user" ? null : (
            <div key={i} className="mb-3">
              {m.texto ? <TextoMarkdown texto={m.texto} /> : (enviando && i === mensajes.length - 1 ? <span className="text-white/50">…</span> : null)}
              {m.pedido && (
                <div className="mt-2 text-[13px]">
                  <p className="font-medium">{m.pedido.titulo}</p>
                  <p className="mt-0.5 text-white/70">{m.pedido.detalle}</p>
                  {m.pedidoEstado === "anotado" ? <p className="mt-1.5 text-white/70">Anotado como pedido para Lenovo.</p> : (
                    <button type="button" onClick={() => void anotarPedido(i)} className="mt-1.5 text-[13px] text-white underline underline-offset-2" style={{ textDecorationColor: AMBAR }}>Dejar como pedido</button>
                  )}
                  {m.pedidoEstado === "error" && <p className="mt-1 text-white/70">No se pudo anotar. Inténtalo otra vez.</p>}
                </div>
              )}
            </div>
          ))}
          <div ref={fondo} />
        </div>
      )}
      <form onSubmit={alEnviar} className="rounded-xl border p-[7px]" style={{ borderColor: "rgba(232,115,26,.55)" }}>
        <div className="rounded-lg bg-[#1b1b1d] px-4 py-3.5">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={alTeclear}
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
