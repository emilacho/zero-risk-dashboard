"use client"

/**
 * CAMBIAR UNA CIFRA ANTES DE FIRMAR (05-nov · boceto 2 aprobado por Emilio · encargo `2026-11-05-ENCARGO-LENOVO-a-CC3-CC5-editar-cifras-antes-de-firmar.md`).
 * «Propuso X · firmas Y». No se firma sin ver cómo queda: cambiar el presupuesto mueve la meta y al revés, y por eso es una cifra a la vez.
 * Calcular se pide con el botón, no a cada tecla: cada cálculo deja una fila en el rastro de la plataforma.
 * Firmar va al final de lo que hay que leer, nunca fijo encima: para llegar al botón se pasa por el resultado y por lo que sigue abierto (CC6 · #283).
 */
import { useEffect, useRef, useState, type RefObject } from "react"
import { cifrasQueCambian, leerNumero, numeroParaEscribir, textoDeCifra, type CifraDeFirma } from "@/lib/direccion-decisiones"
import type { ResultadoDeContestar } from "@/lib/decisiones-contestar"

export type VerCambio = (firmado: number) => Promise<ResultadoDeContestar>
const BOTON = "rounded-[10px] border px-5 py-2.5 text-[14px] transition focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400 disabled:opacity-50"
const PRINCIPAL = `${BOTON} border-[rgba(232,115,26,.75)] bg-[rgba(232,115,26,.2)] font-medium text-white hover:bg-[rgba(232,115,26,.3)]`
const SECUNDARIO = `${BOTON} border-white/15 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.07]`

/** mientras el botón de firmar no está a la vista, una indicación fija lleva hasta él: el botón no se ve sin haber pasado por lo que se firma */
export function BajaParaFirmar({ hasta }: { hasta: RefObject<HTMLElement | null> }) {
  const [llego, setLlego] = useState(false)
  useEffect(() => {
    const el = hasta.current
    if (!el || typeof IntersectionObserver === "undefined") return
    const o = new IntersectionObserver(([e]) => setLlego(e.isIntersecting), { threshold: 0.9 })
    o.observe(el)
    return () => o.disconnect()
  }, [hasta])
  if (llego) return null
  return (
    <div className="pointer-events-none sticky -bottom-5 z-10 -mb-5 flex justify-center bg-gradient-to-t from-[#130f0e] via-[#130f0e] to-transparent pb-5 pt-6 sm:-bottom-7 sm:-mb-7 sm:pb-7">
      <button type="button" data-baja-para-firmar onClick={() => hasta.current?.scrollIntoView({ block: "end", behavior: "smooth" })} className="pointer-events-auto rounded-full border border-[rgba(232,115,26,.6)] bg-[#2a1a10] px-4 py-2 text-[13.5px] text-white">Baja para leer todo y firmar ↓</button>
    </div>
  )
}

type Vista = { firmado: number; cifras: CifraDeFirma[]; alertas: string[] }
/** lo que se ve es lo que se firma: si la cifra escrita ya no es la que se calculó, hay que volver a verla */
export function estadoDelEditor(escrito: string, propuesto: number, vista: Vista | null) {
  const firmado = leerNumero(escrito)
  return { firmado, distinta: firmado != null && firmado > 0 && firmado !== propuesto, vigente: vista && vista.firmado === firmado ? vista : null }
}

/** qué queda en pantalla si la firma no salió: su motivo, en el mismo lugar que el del cálculo. Si la plataforma la rechazó, lo calculado ya no vale: hay que volver a verlo */
export function trasFirmar(r: ResultadoDeContestar | null): { problema: { motivo: string; alcanzable: number | null }; quedaLoVisto: boolean } | null {
  if (r?.sale) return null
  return { problema: { motivo: r?.motivo ?? r?.texto ?? "No se pudo firmar: actualiza y prueba de nuevo.", alcanzable: r?.alcanzable ?? null }, quedaLoVisto: r?.ok === true }
}

export function EditorDeCifra({ cifra, todas, alEditar, criticos = [], ver, firmar, volver }: { cifra: CifraDeFirma; todas: CifraDeFirma[]; alEditar: string | null; criticos?: string[]; ver: VerCambio; firmar: (firmado: number) => Promise<ResultadoDeContestar | null>; volver: () => void }) {
  const [escrito, setEscrito] = useState(numeroParaEscribir(cifra.valor))
  const [vista, setVista] = useState<Vista | null>(null)
  const [problema, setProblema] = useState<{ motivo: string; alcanzable: number | null } | null>(null)
  const [ocupado, setOcupado] = useState<"ver" | "firmar" | null>(null)
  const { firmado, distinta, vigente } = estadoDelEditor(escrito, cifra.valor, vista)

  const calcular = async (n: number) => {
    setOcupado("ver"); setProblema(null); setVista(null)
    try {
      const r = await ver(n)
      if (r.ok && r.recalculo) setVista({ firmado: n, cifras: r.recalculo.cifras, alertas: r.recalculo.alertas })
      else setProblema({ motivo: r.motivo ?? r.texto, alcanzable: r.alcanzable ?? null })
    } finally { setOcupado(null) }
  }
  // el resultado sube a la vista: es lo primero que hay que leer
  const resultado = useRef<HTMLDivElement>(null)
  const pieDeFirma = useRef<HTMLDivElement>(null)
  useEffect(() => { if (vigente || problema) resultado.current?.scrollIntoView({ block: "center", behavior: "smooth" }) }, [vigente, problema])
  const usar = (n: number) => { setEscrito(numeroParaEscribir(n)); void calcular(n) }

  const volverABoton = <button type="button" data-volver disabled={!!ocupado} onClick={volver} className={`${SECUNDARIO} w-full sm:w-auto`}>Volver a {textoDeCifra(cifra)}</button>

  return (
    <div data-editor-cifra={cifra.clave} className="mt-4 flex flex-1 flex-col">
      <div className="grid grid-cols-2 gap-2.5">
        <div data-propuso className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 sm:px-4">
          <p className="text-[11px] uppercase tracking-[0.1em] text-zinc-500">Lo que propuso la oficina</p>
          <p className="mt-1.5 text-[19px] font-light leading-tight text-white sm:text-[28px]">{textoDeCifra(cifra)}</p>
          <p className="mt-1 text-[12.5px] leading-snug text-zinc-400">{cifra.nombre}</p>
        </div>
        <label className="block min-w-0 rounded-xl border border-[rgba(232,115,26,.6)] bg-[rgba(232,115,26,.05)] px-3 py-3 sm:px-4">
          <span className="block text-[11px] uppercase tracking-[0.1em] text-zinc-400">Lo que vas a firmar</span>
          <span className="mt-1.5 flex items-baseline gap-1.5 sm:gap-2">
            {cifra.unidad === "US$" && <span className="text-[19px] font-light leading-tight text-white sm:text-[28px]">US$</span>}
            <input data-cifra-firmada aria-label={cifra.nombre} value={escrito} inputMode="decimal" autoFocus disabled={!!ocupado} onChange={(e) => { setEscrito(e.target.value); setProblema(null) }} onKeyDown={(e) => { if (e.key === "Enter" && distinta && !vigente && firmado != null) void calcular(firmado) }}
              className="w-full min-w-0 border-b border-white/20 bg-transparent text-[19px] font-light leading-tight text-white focus:border-[rgba(232,115,26,.8)] focus:outline-none sm:text-[28px]" />
            {cifra.unidad && cifra.unidad !== "US$" && <span className="shrink-0 text-[12.5px] text-zinc-300 sm:text-[15px]">{cifra.unidad}</span>}
          </span>
          <span data-ayuda className="mt-1 block text-[12.5px] leading-snug text-zinc-400">{firmado == null || firmado <= 0 ? "Escribe un número mayor que 0" : distinta ? "Tú la cambiaste: mira cómo queda" : "Cambia la cifra para ver cómo queda"}</span>
        </label>
      </div>
      <div ref={resultado}>
        {problema && (
          <div data-problema role="status" className="mt-3 rounded-[10px] border border-[rgba(255,90,54,.35)] bg-[rgba(255,90,54,.06)] px-3.5 py-2.5 text-[13.5px] leading-snug text-rose-100">
            {problema.motivo}
            {problema.alcanzable != null && <button type="button" data-usar-alcanzable onClick={() => usar(problema.alcanzable!)} className="mt-2 block text-[13.5px] text-white underline underline-offset-2">Usar {textoDeCifra({ valor: problema.alcanzable, unidad: cifra.unidad })}</button>}
          </div>
        )}
        {vigente && (
          <div data-asi-queda className="mt-3 rounded-[10px] border border-white/10 bg-white/[0.02] px-3.5 py-2.5">
            <p className="mb-1.5 text-[11px] uppercase tracking-[0.1em] text-zinc-500">Así queda todo</p>
            <ul className="space-y-1 text-[13.5px] text-zinc-200">
              {cifrasQueCambian(todas, vigente.cifras).map(({ cifra: c, antes }) => <li key={c.clave} data-cambia={c.clave} className="flex flex-wrap justify-between gap-x-3"><span className="text-zinc-400">{c.nombre}</span><span><s className="mr-2 text-zinc-500">{textoDeCifra({ valor: antes, unidad: c.unidad })}</s>{textoDeCifra(c)}</span></li>)}
            </ul>
            {vigente.alertas.length > 0 && <details data-alertas className="mt-2 border-t border-white/10 pt-2 text-[12.5px] leading-snug text-zinc-400"><summary className="cursor-pointer text-zinc-300">{vigente.alertas.length === 1 ? "1 aviso de la oficina" : `${vigente.alertas.length} avisos de la oficina`}</summary><ul className="mt-1.5 space-y-1">{vigente.alertas.map((a) => <li key={a}>{a}</li>)}</ul></details>}
          </div>
        )}
      </div>
      {/* calcular no compromete: va a la mano, justo debajo de las cajas. Firmar sí: va después de todo lo que hay que leer */}
      {!vigente && (
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button type="button" data-ver-cambio disabled={!!ocupado || !distinta} onClick={() => { if (firmado != null) void calcular(firmado) }} className={`${PRINCIPAL} w-full sm:w-auto`}>{ocupado === "ver" ? "Calculando…" : "Ver cómo queda"}</button>
          {volverABoton}
        </div>
      )}
      {criticos.length > 0 && <div data-criticos className="mt-3 rounded-[10px] border border-[rgba(232,115,26,.3)] bg-[rgba(232,115,26,.05)] px-3.5 py-2.5"><p className="mb-1 text-[11px] uppercase tracking-[0.1em] text-orange-200/80">Sigue abierto</p><ul className="space-y-1 text-[13.5px] leading-snug text-zinc-200">{criticos.map((c) => <li key={c}>{c}</li>)}</ul></div>}
      {alEditar && <p data-al-editar className="mt-3 text-[13px] leading-snug text-zinc-400">{alEditar}</p>}
      {vigente && (
        <>
          <BajaParaFirmar hasta={pieDeFirma} />
          <div ref={pieDeFirma} data-pie-de-firma className="mt-auto flex flex-wrap items-center gap-2.5 pt-4">
            <button type="button" data-firmar-cambio disabled={!!ocupado} onClick={() => { setOcupado("firmar"); setProblema(null); void firmar(vigente.firmado).then((r) => { const t = trasFirmar(r); if (t) { setProblema(t.problema); if (!t.quedaLoVisto) setVista(null) } }).finally(() => setOcupado(null)) }} className={`${PRINCIPAL} w-full sm:w-auto`}>{ocupado === "firmar" ? "Firmando…" : `Firmar ${textoDeCifra({ valor: vigente.firmado, unidad: cifra.unidad })}`}</button>
            {volverABoton}
          </div>
        </>
      )}
    </div>
  )
}
