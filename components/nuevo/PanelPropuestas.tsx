"use client"

import { useState } from "react"
import { Acciones, Aviso, BOTON_PRINCIPAL, BOTON_SECUNDARIO, PanelBase, Rotulo } from "@/components/nuevo/EstiloBase"
import { ConNombres, SinDato } from "@/components/nuevo/FichaDeDecision"
import { NOMBRE_DEL_VERBO, NOMBRE_MIENTRAS_SALE } from "@/lib/ficha-de-decision"
import type { Decision } from "@/lib/direccion-decisiones"
import { TOPE_OBSERVACIONES, claseLegible, contestarPropuestas, dolares, nombreDeLaLamina, rolLegible, textosDeLaPublicacion, tramo, type ClaseDeImagen, type PlanoDePropuesta, type PropuestaDeVideo, type Propuestas, type ResultadoDePropuestas } from "@/lib/propuestas"

/**
 * PROPUESTAS (Sprint 2 · boceto aprobado por Emilio 16-nov 22:23 · `raw/evidencia/2026-11-16-sprint2-tarjeta-propuestas/`).
 * Se abre encima de Decisiones, en el mismo lugar. Las N propuestas lado a lado; cada una con su borrador en video (decisión 22:23: «con 4 imágenes no puedo
 * descifrar la calidad»), su costo (borrador y final · «costo visible sí»), su guion gráfico en borrador (un cuadro por plano, varios si el plano dura más de 3 s)
 * y su porqué. «Elegir esta» solo marca; los únicos botones de decisión son «Aprobar» y «Pedir cambios» (vocabulario fijo de la ficha).
 * Aprobar fabrica la elegida en máxima calidad y lo demás corre solo; Pedir cambios devuelve las observaciones a la mesa, que vuelve a presentar.
 * Lo que no viene es guion rojo: nada se inventa.
 * 17-nov · también IMAGEN (historia, carrusel, foto · contrato `CONTRATO-CC5-a-CC1-CC6-CC7-propuestas-en-imagen.md` §3): la misma tarjeta; «Lámina n» / «Pieza»
 * en lugar de «Plano n · segundos», y el texto de la publicación completo bajo la línea de información.
 * 17-nov · GO Lenovo «volver al boceto» (Emilio: «se ven más imágenes»): vuelve la forma de `2-visor.png`, sin la vista previa grande arriba; el guion con 4 cuadros
 * grandes a lo ancho y flechas si hay más; costo y borrador en video en una línea bajo el guion.
 */
export function PanelPropuestas({ decision, onCerrar, fetchImpl = fetch, elegidaInicial = null, observandoInicial = false, textoInicial = "" }: {
  decision: Decision & { propuestas: Propuestas }
  /** al cerrar, Decisiones se vuelve a leer (lo decidido sale de la lista) */
  onCerrar: () => void
  fetchImpl?: typeof fetch
  /** para pruebas e imágenes */
  elegidaInicial?: string | null
  observandoInicial?: boolean
  textoInicial?: string
}) {
  const p = decision.propuestas
  const [elegida, setElegida] = useState<string | null>(elegidaInicial ?? (p.lista.length === 1 ? p.lista[0].id : null))
  const [observando, setObservando] = useState(observandoInicial)
  const [texto, setTexto] = useState(textoInicial)
  const [enviando, setEnviando] = useState<"aprobar" | "pedir_cambios" | null>(null)
  const [resultado, setResultado] = useState<ResultadoDePropuestas | null>(null)
  const sinVueltas = p.quedan_vueltas === 0
  const laElegida = p.lista.find((x) => x.id === elegida) ?? null

  const mandar = async (v: "aprobar" | "pedir_cambios") => {
    setEnviando(v); setResultado(null)
    try {
      const r = v === "aprobar"
        ? await contestarPropuestas("propuestas-aprobar", { encargo_id: p.encargo_id, ronda: p.ronda, propuesta_id: elegida! }, fetchImpl)
        : await contestarPropuestas("propuestas-cambios", { encargo_id: p.encargo_id, ronda: p.ronda, observaciones: texto.trim() }, fetchImpl)
      setResultado(r)
    } finally { setEnviando(null) }
  }

  const subtitulo = [decision.cliente, `ronda ${p.ronda}`, "en borrador", p.quedan_vueltas != null && !sinVueltas ? `${p.quedan_vueltas === 1 ? "queda 1 ronda" : `quedan ${p.quedan_vueltas} rondas`} de cambios` : null].filter(Boolean).join(" · ")

  // ya se contestó: se dice qué pasa ahora, y «Volver» regresa a Decisiones (que se vuelve a leer)
  if (resultado?.ok) return (
    <PanelBase titulo="Propuestas" id="propuestas-titulo" seccion="propuestas" onCerrar={onCerrar} etiquetaCerrar="Cerrar las propuestas">
      <div data-contestada={resultado.estado} role="status" className="text-center">
        <Rotulo>{resultado.estado === "aprobada" ? "Aprobada" : "Cambios pedidos"}</Rotulo>
        <p className="mt-2 text-cuerpo text-hueso">{resultado.estado === "aprobada"
          ? <>Aprobaste «{laElegida?.nombre}». La producción sigue sola, en máxima calidad.</>
          : "Tus observaciones van a la mesa. Cuando vuelva a presentar las propuestas, la decisión aparece de nuevo."}</p>
        <Acciones><button type="button" data-volver onClick={onCerrar} className={BOTON_SECUNDARIO}>Volver</button></Acciones>
      </div>
    </PanelBase>
  )

  return (
    <PanelBase titulo="Propuestas" id="propuestas-titulo" seccion="propuestas" onCerrar={onCerrar} etiquetaCerrar="Cerrar las propuestas" ancho="max-w-[min(1320px,100%)]">
      <p data-subtitulo className="mb-5 text-center text-dato text-gris">{subtitulo}</p>
      <div data-lista-de-propuestas aria-label="Las propuestas" className="grid gap-4 lg:grid-cols-[repeat(auto-fit,minmax(340px,1fr))]">
        {p.lista.map((x, k) => <Tarjeta key={x.id} x={x} k={k} total={p.lista.length} elegida={x.id === elegida} alElegir={() => setElegida(x.id)} apagada={!!enviando} imagen={p.familia === "imagen"} clase={p.clase} />)}
      </div>
      {p.avisos.length > 0 && (
        <details data-avisos className="mx-auto mt-4 w-full max-w-[720px] text-dato text-gris">
          <summary className="cursor-pointer text-center">Notas de la mesa ({p.avisos.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-left">{p.avisos.map((a, i) => <li key={i}><ConNombres texto={a} /></li>)}</ul>
        </details>
      )}
      <footer data-pie className="mx-auto mt-5 w-full max-w-[720px]">
        {observando && (
          <label className="mb-3 block">
            <Rotulo className="text-center">Observaciones para la mesa</Rotulo>
            <textarea data-observaciones value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={TOPE_OBSERVACIONES} rows={3} disabled={!!enviando} autoFocus
              placeholder="Qué debe cambiar la mesa (de una propuesta o de todas)…"
              className="mt-2 block w-full resize-y rounded-control border border-linea bg-carbon px-4 py-3 text-cuerpo text-hueso placeholder:text-gris focus:border-linea-oro focus:outline-none" />
          </label>
        )}
        <p data-que-pasa className="mb-1 text-center text-dato text-gris">{observando
          ? "Pedir cambios devuelve tus observaciones a la mesa: corrige el borrador y vuelve a presentar las propuestas."
          : laElegida
            ? <>Aprobar fabrica <span className="text-hueso">«{laElegida.nombre}»</span> en máxima calidad y el resto corre solo.{sinVueltas ? "" : " Pedir cambios devuelve tus observaciones a la mesa."}</>
            : "Elige una propuesta para aprobarla."}</p>
        {sinVueltas && <p data-sin-vueltas className="text-center text-dato text-gris">Ya no quedan rondas de cambios: elige una y apruébala.</p>}
        <Acciones>
          {observando && <button type="button" data-volver disabled={!!enviando} onClick={() => setObservando(false)} className={`${BOTON_SECUNDARIO} whitespace-nowrap`}>Volver</button>}
          {!sinVueltas && (
            <button type="button" data-verbo="pedir_cambios" data-tablero-accion="propuestas-cambios" disabled={!!enviando || (observando && !texto.trim())} aria-busy={enviando === "pedir_cambios" || undefined}
              onClick={() => (observando ? void mandar("pedir_cambios") : setObservando(true))} className={`${BOTON_SECUNDARIO} whitespace-nowrap`}>
              {enviando === "pedir_cambios" ? NOMBRE_MIENTRAS_SALE.pedir_cambios : NOMBRE_DEL_VERBO.pedir_cambios}
            </button>
          )}
          {!observando && (
            <button type="button" data-verbo="aprobar" data-tablero-accion="propuestas-aprobar" disabled={!!enviando || !laElegida} aria-busy={enviando === "aprobar" || undefined}
              onClick={() => void mandar("aprobar")} className={`${BOTON_PRINCIPAL} whitespace-nowrap`}>
              {enviando === "aprobar" ? NOMBRE_MIENTRAS_SALE.aprobar : NOMBRE_DEL_VERBO.aprobar}
            </button>
          )}
        </Acciones>
        {resultado && !resultado.ok && (
          <div data-no-salio role="status">
            <Aviso rotulo="No salió">{resultado.motivo}</Aviso>
            {resultado.recargar && <Acciones><button type="button" data-volver-a-decisiones onClick={onCerrar} className={BOTON_SECUNDARIO}>Volver a Decisiones</button></Acciones>}
          </div>
        )}
      </footer>
    </PanelBase>
  )
}

/** cuántos cuadros del guion caben a lo ancho (boceto aprobado `2-visor.png`: 4 grandes, del mismo tamaño) */
export const CUADROS_A_LO_ANCHO = 4

/** 17-nov (GO Lenovo «volver al boceto») · cada cuadro del guion es una celda: un plano de video que dura más de 3 s da varios cuadros, que se leen como ese plano */
type Celda = { p: PlanoDePropuesta; src: string | null; i: number; de: number }
export function celdasDelGuion(planos: PlanoDePropuesta[]): Celda[] {
  return planos.flatMap<Celda>((p) => (p.imagenes.length ? p.imagenes.map((src, i) => ({ p, src, i, de: p.imagenes.length })) : [{ p, src: null, i: 0, de: 1 }]))
}

/** dónde empieza la ventana de 4 al pasar con la flecha: nunca más allá del final (la última ventana muestra los 4 últimos) ni antes del principio */
export function ventanaSiguiente(desde: number, hay: number): number {
  return Math.max(0, Math.min(desde + CUADROS_A_LO_ANCHO, hay - CUADROS_A_LO_ANCHO))
}
export function ventanaAnterior(desde: number): number {
  return Math.max(0, desde - CUADROS_A_LO_ANCHO)
}

/** proporción de la lámina: la historia es vertical; carrusel y foto, 4:5. El video, 9:16 */
const PROPORCION: Record<string, string> = { kit: "aspect-[9/16]", carrusel: "aspect-[4/5]", post_img: "aspect-[4/5]" }

/** una propuesta (boceto aprobado `2-visor.png`, GO Lenovo 17-nov): título, idea, línea de datos, el guion con las imágenes grandes (4 a lo ancho, flechas si hay
 *  más), debajo la línea de información (costo y el borrador en video) y el porqué. Tocarla la marca (no decide nada) */
function Tarjeta({ x, k, total, elegida, alElegir, apagada, imagen = false, clase = null }: { x: PropuestaDeVideo; k: number; total: number; elegida: boolean; alElegir: () => void; apagada: boolean; imagen?: boolean; clase?: ClaseDeImagen | null }) {
  const [verVideo, setVerVideo] = useState(false)
  const pub = x.texto_de_la_publicacion
  const textosPub = textosDeLaPublicacion(pub)
  const portada = x.planos.find((p) => p.imagenes.length)?.imagenes[0]
  return (
    <article data-propuesta={x.id} data-elegida={elegida || undefined} className={`flex min-w-0 flex-col gap-3.5 rounded-tarjeta border bg-grafito-2 p-5 ${elegida ? "border-oro" : "border-linea"}`}>
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Rotulo tono="gris">Propuesta {k + 1} de {total}</Rotulo>
          <h3 className="mt-1 text-titulo font-medio text-hueso"><ConNombres texto={x.nombre} /></h3>
        </div>
        {elegida
          ? <span data-marca-elegida className="whitespace-nowrap text-dato font-medio uppercase tracking-rotulo text-oro">✓ Elegida</span>
          : <button type="button" aria-pressed={false} data-elegir={x.id} disabled={apagada} onClick={alElegir} className={`${BOTON_SECUNDARIO} whitespace-nowrap`}>Elegir esta</button>}
      </header>
      <p data-concepto className="text-cuerpo text-hueso">{x.concepto ? <ConNombres texto={x.concepto} /> : <SinDato />}</p>
      <p data-ficha-tecnica className="flex flex-wrap gap-x-2 text-dato text-gris">
        <span className="font-medio text-hueso">{imagen ? claseLegible(clase, x.planos.length) : x.segundos != null ? `${x.segundos} s` : <SinDato />}</span><span aria-hidden>·</span>
        <span>{x.red ?? <SinDato />}</span><span aria-hidden>·</span><span>{x.objetivo ?? <SinDato />}</span>
      </p>
      {verVideo && x.video_url
        ? (
          <div data-ver-video>
            <Rotulo>Borrador en video</Rotulo>
            <video data-borrador-video src={x.video_url} poster={portada} controls autoPlay playsInline preload="metadata" className="mx-auto mt-2 block aspect-[9/16] max-h-[420px] rounded-control border border-linea bg-carbon object-cover" aria-label={`Borrador en video de ${x.nombre}`} />
          </div>
        )
        : <Guion x={x} imagen={imagen} clase={clase} />}
      <p data-costo className="flex flex-wrap items-center gap-x-2 gap-y-1 text-dato text-gris">
        <span>Borrador <span className="text-hueso [font-variant-numeric:tabular-nums]">{dolares(x.costo.borrador_usd) ?? <SinDato />}</span></span><span aria-hidden>·</span>
        <span>Final <span className="text-hueso [font-variant-numeric:tabular-nums]">{dolares(x.costo.final_usd) ?? <SinDato />}</span></span>
        {!imagen && <span aria-hidden>·</span>}
        {!imagen && (x.video_url
          ? <button type="button" data-boton-video aria-pressed={verVideo} onClick={() => setVerVideo((v) => !v)} className="-my-3 min-h-11 rounded-control text-dato text-oro hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-linea-oro">{verVideo ? "‹ Volver al guion" : "Ver el video ›"}</button>
          : <span data-sin-video>Video <SinDato /></span>)}
      </p>
      {imagen && (
        <div data-texto-publicacion className="text-dato text-gris">
          <Rotulo tono="gris">Texto de la publicación</Rotulo>
          {textosPub.length
            ? textosPub.map((t) => <span key={t.campo} data-texto={t.campo} className="mt-1 block whitespace-pre-line text-hueso"><ConNombres texto={t.texto} /></span>)
            : <span className="mt-1 block"><SinDato /></span>}
          {pub?.hashtags.length ? <span data-hashtags className="mt-1 block text-gris">{pub.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}</span> : null}
        </div>
      )}
      <p data-por-que className="mt-auto border-t border-linea pt-3 text-dato text-gris"><span className="text-oro">Por qué · </span>{x.por_que ? <ConNombres texto={x.por_que} /> : <SinDato />}</p>
    </article>
  )
}

/** el guion: 4 cuadros grandes a lo ancho, del mismo tamaño. Con más de 4, flechas junto al rótulo para pasar a los siguientes (y volver); la flecha no elige nada */
function Guion({ x, imagen, clase }: { x: PropuestaDeVideo; imagen: boolean; clase: ClaseDeImagen | null }) {
  const celdas = celdasDelGuion(x.planos)
  const [desde, setDesde] = useState(0)
  const hay = celdas.length
  const hasta = Math.min(desde + CUADROS_A_LO_ANCHO, hay)
  const antes = desde > 0
  const despues = hasta < hay
  const proporcion = imagen ? (PROPORCION[clase ?? ""] ?? "aspect-[4/5]") : "aspect-[9/16]"
  // las flechas van en la fila del rótulo, a la derecha: nunca encima de una imagen (CC7, `RESPUESTA-CC7-a-CC1-CC5-texto-de-la-publicacion-y-boceto.md` punto 1)
  const flecha = "flex h-11 w-11 items-center justify-center rounded-full border border-linea-oro text-titulo leading-none text-oro hover:bg-grafito focus-visible:outline focus-visible:outline-1 focus-visible:outline-oro"
  return (
    <div>
      <div className="flex min-h-11 items-center justify-between gap-2">
        <Rotulo>{imagen ? "Láminas · borrador" : "Guion gráfico · borrador"}</Rotulo>
        {hay > CUADROS_A_LO_ANCHO && (
          <div data-paso className="flex items-center gap-2">
            {antes && <button type="button" data-flecha="antes" aria-label={`Ver las imágenes anteriores de ${x.nombre}`} onClick={() => setDesde(ventanaAnterior(desde))} className={flecha}>‹</button>}
            <span data-cuantos className="text-rotulo text-gris [font-variant-numeric:tabular-nums]">{desde + 1}–{hasta} de {hay}</span>
            {despues && <button type="button" data-flecha="despues" aria-label={`Ver las imágenes siguientes de ${x.nombre}`} onClick={() => setDesde(ventanaSiguiente(desde, hay))} className={flecha}>›</button>}
          </div>
        )}
      </div>
      {hay
        ? (
          <div className="mt-1">
            <ol data-guion-grafico className="grid grid-cols-4 gap-2">
              {celdas.slice(desde, hasta).map((c) => (imagen
                ? <Lamina key={`${c.p.n}-${c.i}`} c={c} nombre={nombreDeLaLamina(clase, c.p.n, x.planos.length)} proporcion={proporcion} />
                : <Cuadro key={`${c.p.n}-${c.i}`} c={c} />))}
            </ol>
          </div>
        )
        : <p className="mt-1.5 text-dato"><SinDato /></p>}
    </div>
  )
}

/** un cuadro del guion de video: su imagen en borrador, su plano y papel, sus segundos y el texto que irá en pantalla. Sin imagen, el cuadro vacío dice qué se verá.
 *  Un plano de varios cuadros lleva su nombre en cada uno; los segundos y el texto van en el primero y los demás dicen «sigue el plano» */
function Cuadro({ c }: { c: Celda }) {
  const { p } = c
  return (
    <li data-plano={p.n} data-cuadro-n={c.i + 1} className="flex min-w-0 flex-col gap-1">
      {c.src
        // eslint-disable-next-line @next/next/no-img-element -- cuadros del almacén de la plataforma, ya en tamaño de borrador
        ? <img data-cuadro src={c.src} alt={p.se_ve ?? ""} loading="lazy" className="aspect-[9/16] w-full rounded-control border border-linea bg-carbon object-cover" />
        : <div data-cuadro-vacio className="flex aspect-[9/16] w-full items-center justify-center overflow-hidden rounded-control border border-dashed border-linea p-1 text-center text-rotulo leading-tight text-gris">{p.se_ve ?? "Sin imagen"}</div>}
      <span className="text-rotulo text-oro">{p.n} · {rolLegible(p.rol) ?? <SinDato />}</span>
      {c.i > 0 ? <span data-continua className="text-rotulo text-gris">sigue el plano</span> : <>
        <span className="text-rotulo text-gris">{tramo(p) ?? <SinDato />}</span>
        <span className="text-rotulo leading-snug text-hueso">{p.texto_en_pantalla ? `«${p.texto_en_pantalla}»` : <span className="text-gris">sin texto</span>}</span>
      </>}
    </li>
  )
}

/** 26-nov · de dónde salió la foto propia («Imagen de tu web», «Cuadro de tu video», «Foto propia»): con el origen a la vista, aprobar la pieza es aprobar usarla tal cual */
export const rotuloDeLaFotoPropia = (origen: string | null | undefined): string => {
  const o = (origen ?? "").trim()
  return o && o !== "imagen generada" ? o.charAt(0).toUpperCase() + o.slice(1) : "Foto propia"
}

/** 17-nov · una lámina de imagen: su borrador entero (con su texto: no se recorta), su nombre y papel, si usa foto propia, y su texto. Sin segundos */
function Lamina({ c, nombre, proporcion }: { c: Celda; nombre: string; proporcion: string }) {
  const { p } = c
  return (
    <li data-lamina={p.n} className="flex min-w-0 flex-col gap-1">
      {c.src
        // eslint-disable-next-line @next/next/no-img-element -- lámina del almacén de la plataforma, ya en tamaño de borrador
        ? <img data-cuadro src={c.src} alt={p.se_ve ?? nombre} loading="lazy" className={`${proporcion} w-full rounded-control border border-linea bg-carbon object-contain`} />
        : <div data-cuadro-vacio className={`flex ${proporcion} w-full items-center justify-center overflow-hidden rounded-control border border-dashed border-linea p-1 text-center text-rotulo leading-tight text-gris`}>{p.se_ve ?? "Sin imagen"}</div>}
      <span className="text-rotulo text-oro">{nombre}{rolLegible(p.rol) ? ` · ${rolLegible(p.rol)}` : ""}</span>
      {p.foto_propia === true && <span data-foto-propia className="text-rotulo text-gris">{rotuloDeLaFotoPropia(p.origen_de_la_foto)}</span>}
      <span className="whitespace-pre-line text-rotulo leading-snug text-hueso">{p.texto_en_pantalla ? `«${p.texto_en_pantalla}»` : <span className="text-gris">sin texto</span>}</span>
    </li>
  )
}
