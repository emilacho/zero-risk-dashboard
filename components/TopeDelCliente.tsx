"use client"
/**
 * TOPE DE 24 H DEL CLIENTE (30-oct · firma de Emilio «botones sutiles para manipular los topes en tiempo real»).
 * Siempre visible en la ficha: «Tope 24 h: US$ X · gastado hoy US$ Y» con − / + (pasos de 5) y la cifra editable.
 * Aplica al instante: muestra el valor nuevo de inmediato y lo manda por la puerta del tablero (`cliente-tope`); si la plataforma no lo acepta, vuelve al valor anterior y lo dice.
 * El tope puede subir por encima del general: se avisa, no se bloquea. Sin tope propio rige el general.
 */
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { PASO_DEL_TOPE_USD, TOPE_GENERAL_24H_USD, TOPE_MAXIMO_USD, moverTope } from "@/lib/clientes"

const usd = (n: number) => `US$ ${n.toLocaleString("es-EC", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

export function TopeDelCliente(p: { clientId: string; topeInicial: number | null; gastado: number }) {
  const router = useRouter()
  const [propio, setPropio] = useState<number | null>(p.topeInicial)
  const [texto, setTexto] = useState(String(p.topeInicial ?? TOPE_GENERAL_24H_USD))
  const [aviso, setAviso] = useState<{ tono: "ok" | "mal"; texto: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const ultimo = useRef<number | null>(p.topeInicial)
  const vigente = propio ?? TOPE_GENERAL_24H_USD

  async function aplicar(nuevo: number) {
    if (!Number.isFinite(nuevo) || nuevo <= 0 || nuevo > TOPE_MAXIMO_USD) { setAviso({ tono: "mal", texto: `El tope va de 0,01 a ${TOPE_MAXIMO_USD.toLocaleString("es-EC")} dólares.` }); setTexto(String(vigente)); return }
    const anterior = ultimo.current
    setPropio(nuevo); setTexto(String(nuevo)); setEnviando(true); setAviso(null)
    try {
      const r = await fetch("/api/acciones/cliente-tope", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_id: p.clientId, tope_usd: nuevo }) })
      const j = (await r.json().catch(() => ({}))) as { detalle?: string; error?: string }
      if (!r.ok) throw new Error(r.status === 501 ? "La plataforma todavía no tiene esta acción: no se cambió nada." : (j.detalle ?? j.error ?? `no se pudo (${r.status})`))
      ultimo.current = nuevo
      setAviso({ tono: "ok", texto: `Tope fijado en ${usd(nuevo)}.` })
      router.refresh()
    } catch (e) {
      setPropio(anterior); setTexto(String(anterior ?? TOPE_GENERAL_24H_USD))
      setAviso({ tono: "mal", texto: e instanceof Error ? e.message : String(e) })
    } finally { setEnviando(false) }
  }

  const sobre = propio !== null && propio > TOPE_GENERAL_24H_USD
  const boton = "h-7 w-7 rounded-md border border-white/15 text-[15px] leading-none text-zinc-200 hover:bg-white/[0.06] disabled:opacity-40"
  return (
    <div data-tope-cliente className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[hsl(var(--muted-foreground))]">
      <span>Tope 24 h:</span>
      <span className="inline-flex items-center gap-1">
        <button type="button" aria-label={`Bajar el tope ${PASO_DEL_TOPE_USD} dólares`} disabled={enviando || vigente <= 0.01} className={boton} onClick={() => aplicar(moverTope(vigente, -1))}>−</button>
        <label className="inline-flex items-center gap-1 text-zinc-200">
          US$
          <input
            inputMode="decimal" aria-label="Tope de 24 horas en dólares" value={texto} disabled={enviando}
            onChange={(e) => setTexto(e.target.value.replace(",", "."))}
            onBlur={() => { const n = Number(texto); if (n !== vigente) void aplicar(n) }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
            className="num w-16 rounded-md border border-white/15 bg-transparent px-1.5 py-0.5 text-center text-[13px]"
          />
        </label>
        <button type="button" aria-label={`Subir el tope ${PASO_DEL_TOPE_USD} dólares`} disabled={enviando || vigente >= TOPE_MAXIMO_USD} className={boton} onClick={() => aplicar(moverTope(vigente, 1))}>+</button>
      </span>
      <span>· gastado hoy <span className="text-zinc-200">{usd(p.gastado)}</span></span>
      {propio === null && <span>· sin tope propio, rige el general ({usd(TOPE_GENERAL_24H_USD)})</span>}
      {sobre && <span className="text-amber-300">· por encima del general ({usd(TOPE_GENERAL_24H_USD)})</span>}
      {aviso && <span role="status" className={aviso.tono === "ok" ? "text-emerald-300" : "text-rose-300"}>· {aviso.texto}</span>}
    </div>
  )
}
