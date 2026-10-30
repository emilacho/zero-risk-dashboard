"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { DetalleDeLaPieza } from "@/lib/piezas-datos"
import { estadoTrasDecidir } from "@/lib/reflejo"
import type { EstadoPieza } from "@/lib/piezas"
import { resultadoDeJefaturaDePiezaLegible, rolDeLaMesaLegible, tipoDeAporteLegible, tipoDeRevisionLegible, usdES } from "@/lib/lenguaje"
import { COMENTARIO_MINIMO, MOTIVO_MINIMO, ROTULO_DE_ORIGEN } from "@/lib/piezas"
import { botonesDeRevision } from "@/lib/revisiones"
import { AccionBoton } from "@/components/AccionBoton"
import { TOPE_POR_PIEZA_USD } from "@/lib/tablero-acciones"

type Pestana = "lamina" | "equipo" | "jefatura"
type Dialogo = null | "cambios" | "rechazar"

const COLOR_AVISO = { rojo: "border-rose-500/40 bg-rose-500/10 text-rose-200", ambar: "border-amber-500/40 bg-amber-500/10 text-amber-100", info: "border-white/10 bg-white/5" } as const
const ETIQUETA_ESTADO: Record<string, string> = { pendiente: "Pendiente", aprobada: "Aprobada", con_cambios: "Con cambios pedidos", rechazada: "Rechazada", superada: "Superada (la reemplazó otra pieza)", archivada: "Archivada", otro: "Otro" }
const usd = usdES

export function VisorDePieza({ pieza, siguienteId }: { pieza: DetalleDeLaPieza; siguienteId: string | null }) {
  const router = useRouter()
  const [n, setN] = useState(1)
  const [todas, setTodas] = useState(false)
  const [marcadas, setMarcadas] = useState<number[]>([])
  const [zoom, setZoom] = useState(false)
  const [pestana, setPestana] = useState<Pestana>("lamina")
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [comentario, setComentario] = useState("")
  const [casilla, setCasilla] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)

  // lo que dice la pantalla apenas la base contesta «ok», sin esperar a que la lectura nueva llegue
  const [resultado, setResultado] = useState<{ id: string; estado: EstadoPieza } | null>(null)
  const estadoVisto: EstadoPieza = resultado?.id === pieza.id ? resultado.estado : pieza.estado
  const total = pieza.laminas.length
  const lamina = pieza.laminas[n - 1]
  const pendiente = pieza.status === "pending" && pieza.es_pieza && estadoVisto === "pendiente"
  const ir = useCallback((d: number) => { if (total > 0) { setN((x) => ((x - 1 + d + total) % total) + 1); setZoom(false) } }, [total])

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (dialogo || (e.target as HTMLElement)?.tagName === "TEXTAREA") return
      if (e.key === "ArrowRight") ir(1)
      if (e.key === "ArrowLeft") ir(-1)
      if (e.key === "Escape") setZoom(false)
    }
    window.addEventListener("keydown", f)
    return () => window.removeEventListener("keydown", f)
  }, [ir, dialogo])

  const src = (k: number) => `/api/piezas/${pieza.id}/lamina/${k}`
  const marcar = (k: number) => setMarcadas((m) => (m.includes(k) ? m.filter((x) => x !== k) : [...m, k].sort((a, b) => a - b)))

  async function enviar(accion: "aprobar" | "cambios" | "rechazar") {
    setEnviando(true)
    setMensaje(null)
    try {
      const r = await fetch(`/api/piezas/${pieza.id}/decidir`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion, comentario, laminas: marcadas, casilla, estado_visto: pieza.status }) })
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; detalle?: string; error?: string; simulado?: boolean; nota?: string }
      if (r.ok && j.ok) {
        setMensaje({ ok: true, texto: j.simulado ? (j.detalle ?? "Simulado: no se guardó nada") : (j.nota ?? "Listo.") })
        setDialogo(null)
        setComentario("")
        if (!j.simulado) setResultado({ id: pieza.id, estado: estadoTrasDecidir(accion) })
        if (!j.simulado) router.push(siguienteId ? `/piezas?id=${siguienteId}` : "/piezas")
        router.refresh()
      } else {
        // falló (o otra decisión se adelantó): se dice y se vuelve a leer para mostrar lo que de verdad hay en la base
        setMensaje({ ok: false, texto: (j.detalle ?? j.error ?? `No se pudo (${r.status})`) + (r.status === 409 ? " Se actualizó la pantalla." : "") })
        if (r.status === 409) router.refresh()
      }
    } catch {
      setMensaje({ ok: false, texto: "No se pudo contactar al servidor." })
    } finally {
      setEnviando(false)
    }
  }

  const boton = "rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"

  return (
    <div className="flex h-screen min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b-[0.5px] border-white/10 px-5 py-3">
        <h2 className="font-display text-[16px] font-semibold">{pieza.titulo}</h2>
        <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">{ETIQUETA_ESTADO[estadoVisto]}</span>
        <span className="num text-[11px] text-[hsl(var(--muted-foreground))]">{usd(pieza.gasto_usd)}</span>
        <span className="ml-auto flex items-center gap-2">
          {total > 0 && (
            <button onClick={() => setTodas((v) => !v)} className="rounded-full border border-white/10 px-3 py-1 text-[11px] hover:bg-white/5">{todas ? "Ver una lámina" : `Ver las ${total} juntas`}</button>
          )}
        </span>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_340px]">
        <div className="flex min-h-0 flex-col items-center justify-center gap-3 overflow-auto bg-[hsl(var(--background))] p-4">
          {total === 0 && (
            <div className="max-w-md rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
              Sin dibujo.
            </div>
          )}
          {total > 0 && !todas && lamina && (
            <>
              <div className="relative h-[calc(100vh-250px)] min-h-[300px] overflow-hidden rounded-xl border border-white/10 bg-black" style={{ aspectRatio: "1080/1350" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src(n)} alt={`Lámina ${n} de ${total}`} onClick={() => setZoom((z) => !z)} className={`h-full w-full object-contain transition-transform duration-200 ${zoom ? "scale-[1.8] cursor-zoom-out" : "cursor-zoom-in"}`} />
                <span className="num absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-0.5 text-[11px]">{n} / {total}</span>
                <button onClick={() => ir(-1)} aria-label="Lámina anterior" className="absolute left-2 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 text-xl">‹</button>
                <button onClick={() => ir(1)} aria-label="Lámina siguiente" className="absolute right-2 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 text-xl">›</button>
              </div>
              <div className="flex gap-1.5">
                {pieza.laminas.map((l) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={l.n} src={src(l.n)} alt="" onClick={() => { setN(l.n); setZoom(false) }} className={`h-12 w-[38px] cursor-pointer rounded border-2 object-cover ${l.n === n ? "border-[hsl(var(--primary))] opacity-100" : "border-transparent opacity-50"}`} />
                ))}
              </div>
            </>
          )}
          {total > 0 && todas && (
            <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3 self-start">
              {pieza.laminas.map((l) => (
                <div key={l.n} className={`relative overflow-hidden rounded-xl border bg-[hsl(var(--card,0_0%_8%))] ${marcadas.includes(l.n) ? "border-amber-400" : "border-white/10"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src(l.n)} alt={`Lámina ${l.n}`} onClick={() => { setN(l.n); setTodas(false) }} className="block w-full cursor-zoom-in object-cover" style={{ aspectRatio: "1080/1350" }} />
                  <button onClick={() => pendiente && marcar(l.n)} disabled={!pendiente} className={`num absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-[11px] ${marcadas.includes(l.n) ? "bg-amber-400 text-black" : "bg-black/70"}`}>{marcadas.includes(l.n) ? `${l.n} · cambiar` : `${l.n} / ${total}`}</button>
                  {l.glifos_riesgosos && <span className="block border-t border-white/10 px-2 py-1 text-[10px] text-amber-200">⚠ signos que se dibujan como cuadros vacíos</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="flex min-h-0 flex-col border-l-[0.5px] border-white/10">
          <nav className="flex border-b-[0.5px] border-white/10 text-[13px]">
            {([["lamina", "Lámina"], ["equipo", "Equipo"], ["jefatura", "Jefatura"]] as const).map(([k, t]) => (
              <button key={k} onClick={() => setPestana(k)} className={`px-3.5 py-2.5 ${pestana === k ? "text-white shadow-[inset_0_-2px_hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]"}`}>{t}</button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-[13px]">
            {pestana === "lamina" && (
              <>
                {pieza.avisos.map((a, i) => <div key={i} className={`rounded-lg border p-2.5 ${COLOR_AVISO[a.nivel]}`}>{a.nivel === "rojo" ? "⛔ " : "⚠ "}{a.texto}</div>)}
                {lamina && (
                  <>
                    <Bloque titulo={`Lámina ${lamina.n} · ${ROTULO_DE_ORIGEN[lamina.origen]}`}>
                      {[lamina.eyebrow, lamina.titular, lamina.cuerpo, lamina.pie].filter(Boolean).map((t, i) => <p key={i} className={i === 1 ? "font-semibold" : ""}>{t}</p>)}
                      {![lamina.eyebrow, lamina.titular, lamina.cuerpo].some(Boolean) && <p className="text-[hsl(var(--muted-foreground))]">Sin texto guardado.</p>}
                    </Bloque>
                  </>
                )}
                {pieza.pie && <Bloque titulo="Pie de la publicación"><p className="whitespace-pre-wrap">{pieza.pie}</p></Bloque>}
              </>
            )}
            {pestana === "equipo" && (
              pieza.aportes.length === 0
                ? <p className="text-[hsl(var(--muted-foreground))]">Sin aportes.</p>
                : pieza.aportes.map((a) => (
                  <Bloque key={a.n} titulo={`${rolDeLaMesaLegible(a.de)} ${tipoDeAporteLegible(a.tipo)}${a.para ? ` a ${rolDeLaMesaLegible(a.para)}` : ""}`}><p className="whitespace-pre-wrap">{a.texto.slice(0, 700)}</p></Bloque>
                ))
            )}
            {pestana === "jefatura" && (
              <>
                <Bloque titulo="Resultado">{resultadoDeJefaturaDePiezaLegible(pieza.jefatura.resultado)}</Bloque>
                {pieza.jefatura.desacuerdos.length > 0 && <Bloque titulo={`Desacuerdos (${pieza.jefatura.desacuerdos.length})`}><ul className="list-disc space-y-1 pl-4">{pieza.jefatura.desacuerdos.map((d, i) => <li key={i}>{d}</li>)}</ul></Bloque>}
                {pieza.jefatura.opinion_externa && <Bloque titulo="Opinión externa"><p className="whitespace-pre-wrap">{pieza.jefatura.opinion_externa.slice(0, 1400)}</p></Bloque>}
              </>
            )}
          </div>
        </aside>
      </div>

      <footer className="border-t-[0.5px] border-white/10 bg-black/30 px-5 py-3">
        {mensaje && <p className={`mb-2 text-[13px] ${mensaje.ok ? "text-emerald-300" : "text-rose-300"}`}>{mensaje.texto}</p>}
        {!pieza.es_pieza && pieza.status === "pending" && (
          <div className="flex flex-wrap items-start gap-3">
            <span className="basis-full text-[13px] text-[hsl(var(--muted-foreground))]">{tipoDeRevisionLegible(pieza.tipo)}{botonesDeRevision(pieza.tipo).pista ? ` · ${botonesDeRevision(pieza.tipo).pista}` : ""}</span>
            <AccionBoton accion="revision-resolver" datos={{ hitl_id: pieza.id, decision: "aprobar" }} etiqueta={botonesDeRevision(pieza.tipo).aprobar} />
            <AccionBoton accion="revision-resolver" datos={{ hitl_id: pieza.id, decision: "rechazar" }} etiqueta={botonesDeRevision(pieza.tipo).rechazar} variante="peligro" campos={[{ clave: "comentario", etiqueta: "¿Por qué?", tipo: "largo", requerido: true }]} />
          </div>
        )}
        {!pieza.es_pieza && pieza.status !== "pending" && <p className="text-[13px] text-[hsl(var(--muted-foreground))]">{tipoDeRevisionLegible(pieza.tipo)} · ya resuelta.</p>}
        {pieza.es_pieza && !pendiente && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[13px] text-[hsl(var(--muted-foreground))]">{ETIQUETA_ESTADO[estadoVisto]}.</span>
            {pieza.encargo_id && (pieza.estado === "rechazada" || pieza.estado === "otro") && (
              <AccionBoton accion="rehacer-pieza" datos={{ encargo_id: pieza.encargo_id }} etiqueta="Rehacer esta pieza" tope_usd={TOPE_POR_PIEZA_USD} variante="suave" campos={[{ clave: "comentario", etiqueta: "Qué debe cambiar (opcional)", tipo: "largo" }]} />
            )}
          </div>
        )}
        {pendiente && (
          <div className="flex flex-wrap items-center gap-3">
            {pieza.exige_casilla && (
              <label className="flex basis-full items-center gap-2 text-[12px] text-amber-200"><input type="checkbox" checked={casilla} onChange={(e) => setCasilla(e.target.checked)} />Entiendo que la revisión de la jefatura no terminó o tiene desacuerdos abiertos.</label>
            )}
            <button disabled={enviando || (pieza.exige_casilla && !casilla)} onClick={() => enviar("aprobar")} className={`${boton} border-emerald-500 bg-emerald-700/70 hover:bg-emerald-700`}>Aprobar <small className="opacity-80">(no publica todavía)</small></button>
            <button disabled={enviando} onClick={() => { setDialogo("cambios"); setMensaje(null) }} className={`${boton} border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.25)] hover:bg-[hsl(var(--primary)/0.4)]`}>Pedir cambios{marcadas.length > 0 ? ` en ${marcadas.length} lámina${marcadas.length === 1 ? "" : "s"}` : ""}…</button>
            <button disabled={enviando} onClick={() => { setDialogo("rechazar"); setMensaje(null) }} className={`${boton} border-rose-500 bg-rose-900/50 hover:bg-rose-900`}>Rechazar…</button>
          </div>
        )}
      </footer>

      {dialogo && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[hsl(var(--background))] p-5 shadow-2xl">
            <h3 className="font-display text-[16px] font-semibold">{dialogo === "cambios" ? "Pedir cambios" : "Rechazar la pieza"}</h3>
            {dialogo === "cambios" && <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">{marcadas.length > 0 ? `Láminas ${marcadas.join(", ")} · ` : "Toda la pieza · "}vuelve a gastar ≈ {usd(pieza.gasto_usd)}</p>}
            <textarea autoFocus value={comentario} onChange={(e) => setComentario(e.target.value)} rows={5} maxLength={2000} placeholder={dialogo === "cambios" ? "¿Qué quieres distinto?" : "Motivo del rechazo"} className="mt-3 w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm outline-none focus:border-[hsl(var(--primary))]" />
            <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">Mínimo {dialogo === "cambios" ? COMENTARIO_MINIMO : MOTIVO_MINIMO} letras</p>
            {mensaje && !mensaje.ok && <p className="mt-2 text-[13px] text-rose-300">{mensaje.texto}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDialogo(null)} className={`${boton} border-white/10`}>Cancelar</button>
              <button disabled={enviando || comentario.trim().length < (dialogo === "cambios" ? COMENTARIO_MINIMO : MOTIVO_MINIMO)} onClick={() => enviar(dialogo)} className={`${boton} ${dialogo === "cambios" ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.4)]" : "border-rose-500 bg-rose-900"}`}>{enviando ? "Enviando…" : dialogo === "cambios" ? "Confirmar y pedir cambios" : "Confirmar rechazo"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1 text-[11px] uppercase tracking-[0.08em] text-[hsl(var(--muted-foreground))]">{titulo}</h4>
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">{children}</div>
    </div>
  )
}
