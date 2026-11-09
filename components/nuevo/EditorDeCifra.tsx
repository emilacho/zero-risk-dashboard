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
import { Aviso, BOTON_PRINCIPAL, BOTON_SECUNDARIO, ROTULO } from "@/components/nuevo/EstiloBase"

export type VerCambio = (firmado: number) => Promise<ResultadoDeContestar>
// estilo base (05-nov): los botones son los de la guía; el principal es el único ámbar, siempre a la derecha
const PRINCIPAL = BOTON_PRINCIPAL
const SECUNDARIO = BOTON_SECUNDARIO

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
    <div className="pointer-events-none sticky -bottom-6 z-10 -mb-6 flex justify-center bg-gradient-to-t from-grafito-2 via-grafito-2 to-transparent pb-6 pt-6">
      <button type="button" data-baja-para-firmar onClick={() => hasta.current?.scrollIntoView({ block: "end", behavior: "smooth" })} className="pointer-events-auto min-h-11 rounded-full border border-linea-oro bg-grafito-2 px-4 text-boton font-medio text-oro">Baja para leer todo y firmar ↓</button>
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

  const volverABoton = <button type="button" data-volver disabled={!!ocupado} onClick={volver} className={SECUNDARIO}>Volver a {textoDeCifra(cifra)}</button>

  return (
    <div data-editor-cifra={cifra.clave} className="mt-5 flex flex-1 flex-col text-center">
      <div className="grid grid-cols-2 gap-3">
        <div data-propuso className="min-w-0 rounded-tarjeta border border-linea bg-grafito px-3 py-4">
          <p className={ROTULO}>Propuso</p>
          <p className="mt-1.5 text-cifra font-medio [font-variant-numeric:tabular-nums] text-hueso">{textoDeCifra(cifra)}</p>
          <p className="mt-1 text-dato text-gris">{cifra.nombre}</p>
        </div>
        <label className="block min-w-0 rounded-tarjeta border border-linea-oro bg-grafito px-3 py-4">
          <span className={`block ${ROTULO}`}>Firmas</span>
          <span className="mt-1.5 flex items-baseline justify-center gap-1.5">
            {cifra.unidad === "US$" && <span className="text-cifra font-medio text-hueso">US$</span>}
            <input data-cifra-firmada aria-label={cifra.nombre} value={escrito} inputMode="decimal" autoFocus disabled={!!ocupado} onChange={(e) => { setEscrito(e.target.value); setProblema(null) }} onKeyDown={(e) => { if (e.key === "Enter" && distinta && !vigente && firmado != null) void calcular(firmado) }}
              className="w-full min-w-0 border-b border-linea-oro bg-transparent text-center text-cifra font-medio [font-variant-numeric:tabular-nums] text-hueso focus:border-oro focus:outline-none" />
            {cifra.unidad && cifra.unidad !== "US$" && <span className="shrink-0 text-dato text-gris">{cifra.unidad}</span>}
          </span>
          <span data-ayuda className="mt-1 block text-dato text-gris">{firmado == null || firmado <= 0 ? "Escribe un número mayor que 0" : distinta ? "Tú la cambiaste: mira cómo queda" : "Cambia la cifra para ver cómo queda"}</span>
        </label>
      </div>
      <div ref={resultado}>
        {problema && (
          <div data-problema role="status">
            <Aviso rotulo="No cuadra">{problema.motivo}</Aviso>
            {problema.alcanzable != null && <button type="button" data-usar-alcanzable onClick={() => usar(problema.alcanzable!)} className={`w-full ${SECUNDARIO}`}>Usar {textoDeCifra({ valor: problema.alcanzable, unidad: cifra.unidad })}</button>}
          </div>
        )}
        {vigente && (
          <div data-asi-queda className="mt-4 rounded-tarjeta border border-linea bg-grafito px-4 py-4 text-left">
            <p className={`mb-2 text-center ${ROTULO}`}>Así queda</p>
            <ul className="space-y-1 text-dato text-hueso">
              {cifrasQueCambian(todas, vigente.cifras).map(({ cifra: c, antes }) => <li key={c.clave} data-cambia={c.clave} className="flex flex-wrap justify-between gap-x-3"><span className="text-gris">{c.nombre}</span><span><s className="mr-2 text-gris">{textoDeCifra({ valor: antes, unidad: c.unidad })}</s>{textoDeCifra(c)}</span></li>)}
            </ul>
            {vigente.alertas.length > 0 && <details data-alertas className="mt-3 border-t border-linea pt-2 text-dato text-gris"><summary className="min-h-11 cursor-pointer content-center text-hueso">{vigente.alertas.length === 1 ? "1 aviso de la oficina" : `${vigente.alertas.length} avisos de la oficina`}</summary><ul className="mt-1.5 space-y-1">{vigente.alertas.map((a) => <li key={a}>{a}</li>)}</ul></details>}
          </div>
        )}
      </div>
      {/* calcular no compromete: va a la mano, justo debajo de las cajas. Firmar sí: va después de todo lo que hay que leer */}
      {!vigente && (
        <div className="mt-6 grid grid-cols-2 gap-3">
          {volverABoton}
          <button type="button" data-ver-cambio disabled={!!ocupado || !distinta} onClick={() => { if (firmado != null) void calcular(firmado) }} className={PRINCIPAL}>{ocupado === "ver" ? "Calculando…" : "Ver cómo queda"}</button>
        </div>
      )}
      {criticos.length > 0 && <div data-criticos><Aviso rotulo="Sigue abierto"><ul className="space-y-1">{criticos.map((c) => <li key={c}>{c}</li>)}</ul></Aviso></div>}
      {alEditar && <p data-al-editar className="mt-3 text-dato text-gris">{alEditar}</p>}
      {vigente && (
        <>
          <BajaParaFirmar hasta={pieDeFirma} />
          <div ref={pieDeFirma} data-pie-de-firma className="mt-auto grid grid-cols-2 gap-3 pt-6">
            {volverABoton}
            <button type="button" data-firmar-cambio disabled={!!ocupado} onClick={() => { setOcupado("firmar"); setProblema(null); void firmar(vigente.firmado).then((r) => { const t = trasFirmar(r); if (t) { setProblema(t.problema); if (!t.quedaLoVisto) setVista(null) } }).finally(() => setOcupado(null)) }} className={PRINCIPAL}>{ocupado === "firmar" ? "Firmando…" : `Firmar ${textoDeCifra({ valor: vigente.firmado, unidad: cifra.unidad })}`}</button>
          </div>
        </>
      )}
    </div>
  )
}
