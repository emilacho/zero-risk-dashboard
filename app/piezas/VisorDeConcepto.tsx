"use client"
/**
 * LA TARJETA «GRAN IDEA» (T4 · 31-oct): lo que Emilio ve UNA vez por campaña antes del calendario: la frase paraguas, por qué funciona, cómo se ve (fotos citadas),
 * cómo suena, un bloque por capítulo, el RESUMEN del banco (conteo por red y capítulo + 3 ejemplos por capítulo), el banco completo plegado, los caminos descartados,
 * el costo, cuántas vueltas de cambios quedan y el brief de campaña en solo lectura. Dos botones: Aprobar / Pedir cambios (nota + a qué apunta).
 * Cuando `/nuevo` reemplace la bandeja, este componente migra tal cual (lee los mismos datos).
 */
import { useState } from "react"
import { useRouter } from "next/navigation"
import type { DetalleDelConcepto, EstadoDelConcepto } from "@/lib/concepto-datos"
import { VUELTAS_MAXIMAS_DE_CAMBIOS } from "@/lib/concepto-datos"
import { NOTA_MINIMA, type ApuntaA } from "@/lib/concepto-decision"
import { usdES } from "@/lib/lenguaje"

const ETIQUETA_ESTADO: Record<EstadoDelConcepto, string> = { pendiente: "Por aprobar", aprobada: "Aprobada", con_cambios: "Con cambios pedidos", rechazada: "Rechazada", otro: "Otro estado" }
const boton = "rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"

export function VisorDeConcepto({ concepto }: { concepto: DetalleDelConcepto }) {
  const router = useRouter()
  const [dialogo, setDialogo] = useState(false)
  const [nota, setNota] = useState("")
  const [apunta, setApunta] = useState<ApuntaA>("concepto")
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null)
  const [estadoVisto, setEstadoVisto] = useState<EstadoDelConcepto>(concepto.estado)
  const pendiente = concepto.status === "pending" && estadoVisto === "pendiente"
  const capitulos = concepto.capitulos
  const nombreDelCapitulo = (clave: string) => capitulos.find((c) => c.clave === clave)?.nombre ?? clave

  async function enviar(accion: "aprobar" | "cambios") {
    setEnviando(true)
    setMensaje(null)
    try {
      const r = await fetch(`/api/piezas/${concepto.hitl_id}/gran-idea`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion, nota: nota.trim() || undefined, ...(accion === "cambios" ? { apunta_a: apunta } : {}), estado_visto: concepto.status }),
      })
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; detalle?: string; error?: string; nota?: string }
      if (r.ok && j.ok) {
        setMensaje({ ok: true, texto: j.nota ?? "Listo." })
        setDialogo(false)
        setEstadoVisto(accion === "aprobar" ? "aprobada" : "con_cambios")
        router.refresh()
      } else {
        setMensaje({ ok: false, texto: (j.detalle ?? j.error ?? `No se pudo (${r.status})`) + (r.status === 409 ? " Se actualizó la pantalla." : "") })
        if (r.status === 409) router.refresh()
      }
    } catch {
      setMensaje({ ok: false, texto: "No se pudo contactar al servidor." })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex h-screen min-h-0 flex-col" data-tarjeta="gran-idea">
      <header className="flex flex-wrap items-center gap-2 border-b-[0.5px] border-white/10 px-5 py-3">
        <h2 className="font-display text-[16px] font-semibold">Gran idea{concepto.gran_idea ? ` · ${concepto.gran_idea.nombre}` : ""}{concepto.cliente ? ` · ${concepto.cliente}` : ""}</h2>
        <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">{ETIQUETA_ESTADO[estadoVisto]}</span>
        {concepto.version != null && <span className="num text-[11px] text-[hsl(var(--muted-foreground))]">versión {concepto.version}</span>}
        <span className="num text-[11px] text-[hsl(var(--muted-foreground))]">{usdES(concepto.costo_usd)}</span>
        {concepto.seco && <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] text-amber-100">ensayo en seco</span>}
        {concepto.vueltas_restantes != null && (
          <span className="ml-auto text-[11px] text-[hsl(var(--muted-foreground))]">{concepto.vueltas_restantes === 0 ? "No quedan vueltas de cambios: la siguiente va a revisión humana" : `${concepto.vueltas_restantes} de ${VUELTAS_MAXIMAS_DE_CAMBIOS} vueltas de cambios disponibles`}</span>
        )}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_380px]">
        <div className="min-h-0 space-y-4 overflow-y-auto p-5 text-[13px]">
          {concepto.sin_concepto && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2.5 text-rose-200">⛔ {concepto.sin_concepto}</div>}
          {concepto.avisos.map((a, i) => <div key={i} className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-amber-100">⚠ {a}</div>)}

          {concepto.gran_idea && (
            <section>
              <p className="font-display text-[22px] font-semibold leading-tight">{concepto.gran_idea.nombre}</p>
              {concepto.gran_idea.frase ? <p className="mt-1 text-[15px] text-white/90">{concepto.gran_idea.frase}</p> : <p className="mt-1 text-[12px] text-amber-200">La gran idea no trae frase paraguas (solo nombre).</p>}
            </section>
          )}
          {concepto.por_que_funciona && <Bloque titulo="Por qué funciona"><p className="whitespace-pre-wrap">{concepto.por_que_funciona}</p></Bloque>}
          {concepto.como_se_ve && (
            <Bloque titulo="Cómo se ve">
              <p className="whitespace-pre-wrap">{concepto.como_se_ve}</p>
              {concepto.fotos_citadas.length > 0 && <p className="mt-2 text-[12px] text-[hsl(var(--muted-foreground))]">Fotos propias citadas: {concepto.fotos_citadas.join(" · ")}</p>}
            </Bloque>
          )}
          {concepto.como_suena && <Bloque titulo="Cómo suena"><p className="whitespace-pre-wrap">{concepto.como_suena}</p></Bloque>}

          {capitulos.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-[11px] uppercase tracking-[0.08em] text-[hsl(var(--muted-foreground))]">Capítulos ({capitulos.length}, uno por fase)</h3>
              {capitulos.map((c) => (
                <div key={c.clave} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <p className="font-semibold">Capítulo {c.clave} · {c.nombre}{c.fase ? <span className="ml-2 text-[11px] font-normal text-[hsl(var(--muted-foreground))]">fase {c.fase}</span> : <span className="ml-2 text-[11px] font-normal text-amber-200">sin fase que lo cite</span>}</p>
                  {c.que_cuenta && <p className="mt-1">{c.que_cuenta}</p>}
                  {c.objetivo_cita && <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">Objetivo de la fase: {c.objetivo_cita}</p>}
                  {c.como_se_ve && <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">Cómo se ve aquí: {c.como_se_ve}</p>}
                  {c.series.length > 0 && <ul className="mt-1 list-disc pl-4 text-[12px]">{c.series.map((s) => <li key={s.id || s.nombre}>Serie «{s.nombre}»{s.que_cuenta ? `: ${s.que_cuenta}` : ""}{s.redes.length ? ` (${s.redes.join(", ")})` : ""}</li>)}</ul>}
                  <p className="num mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{concepto.resumen.por_capitulo[c.clave] ?? 0} ideas en el banco</p>
                </div>
              ))}
            </section>
          )}

          <Bloque titulo={`Resumen del banco · ${concepto.resumen.total} ideas`}>
            {concepto.resumen.total === 0 && <p className="text-amber-200">El banco está vacío.</p>}
            {concepto.resumen.total > 0 && (
              <p className="text-[12px] text-[hsl(var(--muted-foreground))]">
                Por red: {Object.entries(concepto.resumen.por_red).map(([r, n]) => `${r} ${n}`).join(" · ")}
              </p>
            )}
            {concepto.resumen.parcial.length > 0 && (
              <p className="mt-1 text-[12px] text-amber-200">Banco parcial: {concepto.resumen.parcial.map((p) => `faltan ${p.faltan} de ${p.esperadas} (${p.red} · capítulo ${p.capitulo})`).join(" · ")}. La mesa entregó lo que hay.</p>
            )}
            {Object.entries(concepto.resumen.ejemplos).map(([cap, ejemplos]) => (
              <div key={cap} className="mt-2">
                <p className="text-[11px] uppercase tracking-[0.06em] text-[hsl(var(--muted-foreground))]">Capítulo {nombreDelCapitulo(cap)} · {concepto.resumen.por_capitulo[cap] ?? 0} ideas · ejemplos</p>
                <ul className="mt-1 space-y-1">{ejemplos.map((e) => <li key={e.id}><span className="num text-[11px] text-[hsl(var(--muted-foreground))]">{e.id}</span> {e.idea} <span className="text-[hsl(var(--muted-foreground))]">· mensaje: {e.mensaje} · gancho: {e.gancho}</span></li>)}</ul>
              </div>
            ))}
          </Bloque>

          {concepto.banco.length > 0 && (
            <details className="rounded-lg border border-white/10">
              <summary className="cursor-pointer px-3 py-2 text-[12px] text-[hsl(var(--muted-foreground))] hover:text-white">Banco completo ({concepto.banco.length} ideas; se hojea, no se aprueba una por una)</summary>
              <ul className="max-h-[50vh] space-y-1 overflow-y-auto px-3 pb-3 text-[12px]">
                {concepto.banco.map((i) => <li key={i.id}><span className="num text-[11px] text-[hsl(var(--muted-foreground))]">{i.id}</span> · {i.red} · {i.formato} · {i.idea} <span className="text-[hsl(var(--muted-foreground))]">· mensaje: {i.mensaje} · gancho: {i.gancho} · protagonista: {i.protagonista}{i.serie ? ` · serie: ${i.serie}` : ""}{i.foto ? ` · foto: ${i.foto}` : ""}</span></li>)}
              </ul>
            </details>
          )}

          {concepto.caminos_descartados && <Bloque titulo="Caminos descartados y por qué"><p className="whitespace-pre-wrap">{concepto.caminos_descartados}</p></Bloque>}
          {concepto.devolucion_del_brief && <Bloque titulo="La dirección creativa devolvió el brief una vez"><p className="whitespace-pre-wrap">{concepto.devolucion_del_brief}</p></Bloque>}
          {concepto.nota_de_emilio && <Bloque titulo={concepto.aprobacion === "cambios" ? `Tu nota (cambios al ${concepto.apunta_a ?? "concepto"})` : "Tu nota"}><p className="whitespace-pre-wrap">{concepto.nota_de_emilio}</p></Bloque>}
        </div>

        <aside className="flex min-h-0 flex-col border-l-[0.5px] border-white/10">
          <div className="border-b-[0.5px] border-white/10 px-3.5 py-2.5 text-[13px]">Brief de campaña (solo lectura)</div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 text-[12px]">
            {concepto.brief
              ? <>
                  <p className="mb-2 text-[11px] text-[hsl(var(--muted-foreground))]">versión {concepto.brief.version} · {concepto.brief.estado}</p>
                  <pre className="whitespace-pre-wrap font-sans">{concepto.brief.texto_md}</pre>
                </>
              : <p className="text-[hsl(var(--muted-foreground))]">La cadena no tiene guardado el brief de esta campaña.</p>}
          </div>
        </aside>
      </div>

      <footer className="border-t-[0.5px] border-white/10 bg-black/30 px-5 py-3">
        {mensaje && <p className={`mb-2 text-[13px] ${mensaje.ok ? "text-emerald-300" : "text-rose-300"}`}>{mensaje.texto}</p>}
        {!pendiente && <p className="text-[13px] text-[hsl(var(--muted-foreground))]">{ETIQUETA_ESTADO[estadoVisto]}.{concepto.decidido_en ? ` Decidida el ${concepto.decidido_en.slice(0, 10)}.` : ""}</p>}
        {pendiente && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="basis-full text-[12px] text-[hsl(var(--muted-foreground))]">Apruebas la gran idea y el brief de la campaña; con eso la cadena arma el calendario de la primera tanda.</span>
            <button disabled={enviando || !!concepto.sin_concepto} onClick={() => enviar("aprobar")} className={`${boton} border-emerald-500 bg-emerald-700/70 hover:bg-emerald-700`}>Aprobar la gran idea</button>
            <button disabled={enviando || !!concepto.sin_concepto} onClick={() => { setDialogo(true); setMensaje(null) }} className={`${boton} border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.25)] hover:bg-[hsl(var(--primary)/0.4)]`}>Pedir cambios…</button>
          </div>
        )}
      </footer>

      {dialogo && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[hsl(var(--background))] p-5 shadow-2xl">
            <h3 className="font-display text-[16px] font-semibold">Pedir cambios a la gran idea</h3>
            <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">{concepto.vueltas_restantes != null ? `Quedan ${concepto.vueltas_restantes} de ${VUELTAS_MAXIMAS_DE_CAMBIOS} vueltas en esta campaña. ` : ""}Di a qué apuntan los cambios.</p>
            <div className="mt-3 space-y-1.5 text-[13px]">
              <label className="flex items-start gap-2"><input type="radio" name="apunta" checked={apunta === "concepto"} onChange={() => setApunta("concepto")} /><span><b>Al concepto</b> · la mesa de creativos hace otra ronda con tu nota (el brief se queda).</span></label>
              <label className="flex items-start gap-2"><input type="radio" name="apunta" checked={apunta === "brief"} onChange={() => setApunta("brief")} /><span><b>Al brief</b> · se escribe un brief nuevo y, sobre él, otra gran idea (es el camino largo).</span></label>
            </div>
            <textarea autoFocus value={nota} onChange={(e) => setNota(e.target.value)} rows={5} maxLength={2000} placeholder="¿Qué quieres distinto?" className="mt-3 w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm outline-none focus:border-[hsl(var(--primary))]" />
            <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">Mínimo {NOTA_MINIMA} letras</p>
            {mensaje && !mensaje.ok && <p className="mt-2 text-[13px] text-rose-300">{mensaje.texto}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDialogo(false)} className={`${boton} border-white/10`}>Cancelar</button>
              <button disabled={enviando || nota.trim().length < NOTA_MINIMA} onClick={() => enviar("cambios")} className={`${boton} border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.4)]`}>{enviando ? "Enviando…" : "Confirmar y pedir cambios"}</button>
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
