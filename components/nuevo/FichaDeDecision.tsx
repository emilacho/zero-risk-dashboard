"use client"

import { useState, type ReactNode } from "react"
import { Acciones, BOTON_PRINCIPAL, BOTON_SECUNDARIO, Pares, Rotulo } from "@/components/nuevo/EstiloBase"
import { NOMBRE_DEL_VERBO, NOMBRE_MIENTRAS_SALE, NOMBRE_DE_LA_PANTALLA, conNombresPropios, nombrePropioO, revisarFicha, type FichaDeDecision as Ficha, type Pantalla, type Verbo } from "@/lib/ficha-de-decision"
import { TOPE_MOTIVO, TOPE_RESPUESTA, cifraEnRecuadro, cifrasDelFrente, decisivoCorto, haceCuanto, type CifraDeFirma } from "@/lib/direccion-decisiones"

/**
 * EL DIBUJANTE ÚNICO DE LA FICHA DE DECISIÓN (GO Lenovo 09-nov · boceto v7 aprobado por Emilio).
 * Siempre los mismos bloques y en el mismo orden: cuenta y departamento → qué se decide → Propuesta → Decisivo → Uso y Desbloquea → Espera y Vence →
 * acciones o «Ir al …». Lo que no tiene dato muestra un guion rojo; ningún bloque se esconde. No lee tipo, fuente ni origen: solo la ficha.
 */
export const SIN_DATO = "—"
/** el guion rojo: el dato no vino (no se inventa) */
export const SinDato = () => <span data-sin-dato aria-label="Sin dato" className="text-alarma">{SIN_DATO}</span>
/** un texto con los nombres propios del sistema en su mayúscula y con la línea dorada sutil (regla del estilo base, Emilio 09-nov) */
export function ConNombres({ texto }: { texto: string }) {
  return <>{conNombresPropios(texto).map((p, k) => (p.propio ? <span key={k} data-nombre-propio className="underline decoration-linea-oro decoration-1 underline-offset-4">{p.texto}</span> : <span key={k}>{p.texto}</span>))}</>
}
const fecha = (iso: string | null | undefined) => { if (!iso) return null; const t = new Date(iso); return Number.isNaN(t.getTime()) ? null : t.toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" }) }
/** v7: «Decisivo» con contenido va entre dos líneas rojas finas (sin dato, la línea de siempre) */
const Bloque = ({ nombre, children, linea = true, alarma = false }: { nombre: string; children: ReactNode; linea?: boolean; alarma?: boolean }) => <div data-bloque={nombre} data-alarma={alarma || undefined} className={`${alarma ? "border-y border-linea-alarma" : linea ? "border-t border-linea" : ""} py-5`}>{children}</div>

export function FichaDeDecision({ ficha, enviando, alVerbo, alIr, alCifra, estado, ahora, textoInicial = "", nota, abiertoInicial = false }: {
  ficha: Ficha
  /** para pruebas e imágenes: el texto entero ya abierto */
  abiertoInicial?: boolean
  /** T2 · tocar una cifra que se puede cambiar (el panel abre el editor de siempre). Sin esta función, ninguna cifra se toca */
  alCifra?: (clave: string) => void
  /** el verbo que está saliendo (los botones se apagan mientras tanto) */
  enviando: Verbo | null
  /** tocar un verbo: el panel lo contesta por la puerta del servidor (el texto o el motivo, si la acción lo pide) */
  alVerbo: (v: Verbo, t: { texto?: string; motivo?: string }) => void
  /** el enlace del pie: abre la pantalla dueña */
  alIr: (p: Pantalla) => void
  /** lo que pasó al contestar (p. ej. «No salió» o «Sin guardar»): va en la línea de estado de arriba o bajo los botones */
  estado?: { arriba?: ReactNode; abajo?: ReactNode }
  ahora?: number
  /** lo que ya escribiste la vez que no salió */
  textoInicial?: string
  /** una línea gris bajo la cuenta (p. ej. «está en pausa por tu decisión»); no es un bloque */
  nota?: ReactNode
}) {
  const [texto, setTexto] = useState(textoInicial)
  const [motivo, setMotivo] = useState("")
  const [descartando, setDescartando] = useState(false)
  const [abierto, setAbierto] = useState(abiertoInicial)
  const r = revisarFicha(ficha)
  if (!r.ok) return (
    <article data-ficha={ficha.id} data-mal-armada className="rounded-tarjeta border border-linea-alarma bg-grafito-2 p-6 text-center">
      <Rotulo tono="alarma">Mal armada</Rotulo>
      <p className="mt-1.5 text-cuerpo text-hueso">Esta decisión llegó mal armada: {r.motivo}. La oficina tiene que corregirla.</p>
    </article>
  )
  const { acciones } = r
  const pideTexto = acciones.find((a) => a.pide?.que === "texto")
  const pideMotivo = acciones.find((a) => a.verbo === "descartar" && a.pide?.que === "motivo")
  const p = ficha.propuesta, cifras = p?.cifras ?? []
  // al frente, las dos que se deciden (las que se pueden cambiar, o las dos primeras); las demás, al abrir
  const { frente, detalle: demas } = cifrasDelFrente(cifras)
  // v9 (Emilio): al pasar el cursor el recuadro entero se ilumina; al tocarlo se cambia la cifra. Solo si la cifra se puede cambiar y el panel sabe cambiarla
  const recuadro = (c: CifraDeFirma, marca: Record<string, string>) => {
    const x = cifraEnRecuadro(c)
    const cuerpo = <><span data-numero-de-cifra className="block whitespace-nowrap text-numero font-normal [font-variant-numeric:tabular-nums] text-hueso">{x.numero}</span><span className="mt-1 block text-rotulo uppercase tracking-rotulo text-gris">{x.rotulo}</span>{c.nota && <span className="mt-1 block text-dato text-gris">{c.nota}</span>}</>
    return c.editable && alCifra
      ? <button key={c.clave} type="button" {...marca} data-cambiar={c.clave} disabled={!!enviando} onClick={() => alCifra(c.clave)} aria-label={`Cambiar ${c.nombre}`} className="zr-apagable zr-luz-del-pizarron block w-full rounded-tarjeta border border-linea bg-grafito px-2 py-4 text-center focus-visible:outline focus-visible:outline-1 focus-visible:outline-oro">{cuerpo}</button>
      : <div key={c.clave} {...marca} className="rounded-tarjeta border border-linea bg-grafito px-2 py-4 text-center">{cuerpo}</div>
  }
  const decisivo = ficha.decisivo ?? []
  // lo que tiene corto se lee corto al frente; tocar el bloque abre el largo. Sin corto, el largo se ve entero (nunca se recorta)
  const hayLargo = demas.length > 0 || decisivo.some((x) => x.corto !== x.largo) ||(!!ficha.uso?.corto && ficha.uso.corto !== ficha.uso.largo) || (!!ficha.desbloquea?.corto && ficha.desbloquea.corto !== ficha.desbloquea.largo)
  const corto = (x?: { corto?: string; largo: string }) => (x ? <ConNombres texto={abierto ? x.largo : (x.corto ?? x.largo)} /> : <SinDato />)
  const donde = ficha.donde_se_hace ? NOMBRE_DE_LA_PANTALLA[ficha.donde_se_hace.pantalla] : null
  const verbo = (v: Verbo) => {
    if (v === "descartar" && pideMotivo && !descartando) { setDescartando(true); return }
    alVerbo(v, { ...(v === pideTexto?.verbo ? { texto } : {}), ...(v === "descartar" ? { motivo } : {}) })
  }
  const falta = (v: Verbo) => { const a = acciones.find((x) => x.verbo === v); return !!a?.pide?.obligatorio && a.pide.que === "texto" && !texto.trim() }
  const contexto = (hijos: ReactNode) => (hayLargo
    ? <button type="button" data-abre-el-largo aria-expanded={abierto} onClick={() => setAbierto((x) => !x)} aria-label={abierto ? "Cerrar el texto entero" : "Leer el texto entero"} className="block w-full rounded-control text-center focus-visible:outline focus-visible:outline-1 focus-visible:outline-oro">{hijos}</button>
    : hijos)
  return (
    <article data-ficha={ficha.id} data-decision={ficha.id} className="flex flex-col rounded-tarjeta border border-linea bg-grafito-2 px-6 pb-6 pt-6 text-center">
      {(ficha.detiene || estado?.arriba) && (
        <p data-estado className="mb-4 flex flex-wrap items-center justify-center gap-x-3 text-dato font-medio uppercase tracking-rotulo text-alarma">
          {ficha.detiene && <span data-detiene className="inline-flex items-center gap-1.5"><span aria-hidden className="h-[7px] w-[7px] rounded-full bg-alarma" />Detiene {ficha.detiene.que}</span>}
          {estado?.arriba}
        </p>
      )}
      <Bloque nombre="quien" linea={false}>
        <Pares valor="text-cuerpo font-medio" pares={[
          { rotulo: "Cuenta", valor: ficha.cuenta ? <span data-cuenta>{ficha.cuenta.nombre}</span> : <SinDato /> },
          { rotulo: "Departamento", valor: ficha.departamento.nombre ? <span data-departamento>{nombrePropioO(ficha.departamento.nombre)}</span> : <SinDato /> },
        ]} />
        {nota && <p data-nota className="mt-3 text-dato text-gris">{nota}</p>}
      </Bloque>
      <div data-bloque="que" className="pb-5 pt-4">
        <Rotulo>Qué se decide</Rotulo>
        <h3 data-que-se-decide className="mt-1.5 text-cuerpo font-medio text-hueso"><ConNombres texto={ficha.que_se_decide} /></h3>
      </div>
      <Bloque nombre="propuesta">
        <Rotulo>Propuesta</Rotulo>
        {cifras.length ? (<>
          <div className={`mt-3 grid gap-3 ${frente.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {frente.map((c) => recuadro(c, { "data-cifra": c.clave }))}
          </div>
          {/* T2 · las demás cifras no se pierden: se ven al abrir el texto entero (tocando Decisivo o Uso), dentro de la misma Propuesta */}
          {abierto && demas.length > 0 && <div data-demas-cifras className="mt-3 grid grid-cols-2 gap-3">{demas.map((c) => recuadro(c, { "data-cifra-del-detalle": c.clave }))}</div>}
        </>) : p?.supuesto ? (
          <div data-supuesto-recuadro className="mt-3 rounded-tarjeta border border-linea bg-grafito px-3 py-4 text-center">
            <span data-supuesto className={`block ${p.supuesto.length <= 24 ? "whitespace-nowrap text-numero font-normal [font-variant-numeric:tabular-nums]" : "text-cuerpo"} text-hueso`}><ConNombres texto={p.supuesto} /></span>
            <span className="mt-1 block text-rotulo uppercase tracking-rotulo text-gris">Supuesto</span>
          </div>
        ) : <p className="mt-1.5 text-cuerpo"><SinDato /></p>}
      </Bloque>
      <Bloque nombre="decisivo" alarma={decisivo.length > 0}>
        {contexto(<>
          <Rotulo tono="alarma">Decisivo</Rotulo>
          {decisivo.length
            ? <ul className="mt-1.5 space-y-1.5 text-cuerpo font-medio text-hueso">{decisivo.map((x, k) => {
              // v7: cerrado, la frase y debajo su porqué en gris (si el corto es la frase del propio texto); abierto, el texto entero
              const partes = decisivoCorto(x.largo), porque = !abierto && partes.frase === x.corto ? partes.porque : null
              return <li key={k} data-decisivo><ConNombres texto={abierto ? x.largo : x.corto} />{porque && <span data-porque className="block font-normal text-gris"><ConNombres texto={porque} /></span>}</li>
            })}</ul>
            : <p className="mt-1.5 text-cuerpo"><SinDato /></p>}
        </>)}
      </Bloque>
      <Bloque nombre="uso">
        {contexto(<Pares valor="text-cuerpo" pares={[
          { rotulo: "Uso", valor: <span data-uso>{corto(ficha.uso)}</span> },
          { rotulo: "Desbloquea", valor: <span data-desbloquea>{corto(ficha.desbloquea)}</span> },
        ]} />)}
      </Bloque>
      <Bloque nombre="espera">
        <Pares valor="text-cuerpo" pares={[
          { rotulo: "Espera", valor: ficha.espera.desde ? <span data-espera>{haceCuanto(ficha.espera.desde, ahora)}</span> : <SinDato />, dato: fecha(ficha.espera.desde) ?? undefined },
          { rotulo: "Vence", valor: <span data-vence>{ficha.espera.vence && fecha(ficha.espera.vence) ? fecha(ficha.espera.vence) : ficha.espera.sin_limite ? "Sin fecha límite" : <SinDato />}</span> },
        ]} />
      </Bloque>
      {pideTexto && (
        <label className="block text-left">
          <span className="sr-only">Tu respuesta</span>
          <textarea data-respuesta value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={TOPE_RESPUESTA} rows={3} placeholder="Escribe tu respuesta…" disabled={!!enviando}
            className="block w-full resize-y rounded-control border border-linea bg-carbon px-4 py-3 text-cuerpo text-hueso placeholder:text-gris focus:border-linea-oro focus:outline-none" />
        </label>
      )}
      {descartando && (
        <input data-motivo value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={TOPE_MOTIVO} placeholder={pideMotivo?.pide?.obligatorio ? "Por qué (obligatorio)" : "Por qué (opcional)"} aria-label="Por qué descartas"
          className="mt-3 min-h-11 w-full rounded-control border border-linea bg-carbon px-4 text-cuerpo text-hueso placeholder:text-gris focus:border-linea-oro focus:outline-none" />
      )}
      <footer data-pie>
        {acciones.length > 0 ? (
          <Acciones>
            {/* CC6 #310 menor 2: mientras descartas solo quedan «Volver» y «Descartar» (como la tarjeta vieja); «Volver» cancela sin descartar */}
            {descartando && <button type="button" data-volver disabled={!!enviando} onClick={() => { setDescartando(false); setMotivo("") }} className={`${BOTON_SECUNDARIO} whitespace-nowrap`}>Volver</button>}
            {acciones.filter((a) => !descartando || a.verbo === "descartar").map((a) => (
              <button key={a.verbo} type="button" data-verbo={a.verbo} disabled={!!enviando || falta(a.verbo) || (descartando && a.verbo === "descartar" && !!a.pide?.obligatorio && !motivo.trim())} aria-busy={enviando === a.verbo || undefined}
                onClick={() => verbo(a.verbo)} className={`${a.principal ? BOTON_PRINCIPAL : BOTON_SECUNDARIO} whitespace-nowrap`}>{enviando === a.verbo ? NOMBRE_MIENTRAS_SALE[a.verbo] : NOMBRE_DEL_VERBO[a.verbo]}</button>
            ))}
          </Acciones>
        ) : (
          <p data-solo-avisa className="mt-1 rounded-control border border-dashed border-linea px-4 py-3 text-dato text-gris">Esta ficha solo avisa: no hay nada que decidir aquí.</p>
        )}
        {estado?.abajo}
        {donde && (
          <button type="button" data-ir={ficha.donde_se_hace!.pantalla} onClick={() => alIr(ficha.donde_se_hace!.pantalla)} className="mx-auto mt-4 block min-h-11 rounded-control px-3 text-dato text-oro focus-visible:outline focus-visible:outline-1 focus-visible:outline-oro">
            {donde.ir} {donde.propio ? <span data-nombre-propio className="underline decoration-linea-oro decoration-1 underline-offset-4">{donde.nombre}</span> : donde.nombre} →
          </button>
        )}
      </footer>
    </article>
  )
}
