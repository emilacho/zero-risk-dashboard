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
 * 17-nov · también IMAGEN (historia, carrusel, foto · contrato `CONTRATO-CC5-a-CC1-CC6-CC7-propuestas-en-imagen.md` §3): el mismo boceto; en lugar del video,
 * la primera lámina en borrador; «Lámina n» / «Pieza» en lugar de «Plano n · segundos»; y el texto de la publicación bajo la idea.
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

/** una propuesta: su borrador en video, sus datos, su guion gráfico y su porqué. Tocarla la marca (no decide nada) */
function Tarjeta({ x, k, total, elegida, alElegir, apagada, imagen = false, clase = null }: { x: PropuestaDeVideo; k: number; total: number; elegida: boolean; alElegir: () => void; apagada: boolean; imagen?: boolean; clase?: ClaseDeImagen | null }) {
  const portada = x.planos.find((p) => p.imagenes.length)?.imagenes[0]
  const pub = x.texto_de_la_publicacion
  const textosPub = textosDeLaPublicacion(pub)
  return (
    <article data-propuesta={x.id} data-elegida={elegida || undefined} className={`flex min-w-0 flex-col gap-4 rounded-tarjeta border bg-grafito-2 p-5 ${elegida ? "border-oro" : "border-linea"}`}>
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Rotulo tono="gris">Propuesta {k + 1} de {total}</Rotulo>
          <h3 className="mt-1 text-titulo font-medio text-hueso"><ConNombres texto={x.nombre} /></h3>
        </div>
        {elegida
          ? <span data-marca-elegida className="whitespace-nowrap text-dato font-medio uppercase tracking-rotulo text-oro">✓ Elegida</span>
          : <button type="button" aria-pressed={false} data-elegir={x.id} disabled={apagada} onClick={alElegir} className={`${BOTON_SECUNDARIO} whitespace-nowrap`}>Elegir esta</button>}
      </header>
      <div className="grid grid-cols-[minmax(0,150px)_1fr] gap-4">
        {/* el borrador en video (animatic): fiel al final en planos, encuadres, duración y textos */}
        {imagen
          // imagen: la primera lámina en borrador (su proporción real: no se recorta), o el cuadro vacío
          ? portada
            // eslint-disable-next-line @next/next/no-img-element -- lámina del almacén de la plataforma, ya en tamaño de borrador
            ? <img data-portada src={portada} alt={`Primera lámina de ${x.nombre}`} className="h-auto w-full self-start rounded-control border border-linea bg-carbon" />
            : <div data-sin-portada className="flex aspect-[4/5] w-full items-center justify-center rounded-control border border-dashed border-linea p-2 text-center text-dato text-gris">El borrador todavía no está<SinDato /></div>
          : x.video_url
          ? <video data-borrador-video src={x.video_url} poster={portada} controls playsInline preload="metadata" className="aspect-[9/16] w-full rounded-control border border-linea bg-carbon object-cover" aria-label={`Borrador en video de ${x.nombre}`} />
          : <div data-sin-video className="flex aspect-[9/16] w-full items-center justify-center rounded-control border border-dashed border-linea p-2 text-center text-dato text-gris">El borrador en video todavía no está<SinDato /></div>}
        <div className="min-w-0 space-y-3 text-left">
          <p data-concepto className="text-cuerpo text-hueso">{x.concepto ? <ConNombres texto={x.concepto} /> : <SinDato />}</p>
          <p data-ficha-tecnica className="flex flex-wrap gap-x-2 text-dato text-gris">
            <span className="font-medio text-hueso">{imagen ? claseLegible(clase, x.planos.length) : x.segundos != null ? `${x.segundos} s` : <SinDato />}</span><span aria-hidden>·</span>
            <span>{x.red ?? <SinDato />}</span><span aria-hidden>·</span><span>{x.objetivo ?? <SinDato />}</span>
          </p>
          <dl data-costo className="grid grid-cols-2 gap-2 text-dato">
            <div><dt className="text-rotulo uppercase tracking-rotulo text-gris">Borrador</dt><dd className="text-hueso [font-variant-numeric:tabular-nums]">{dolares(x.costo.borrador_usd) ?? <SinDato />}</dd></div>
            <div><dt className="text-rotulo uppercase tracking-rotulo text-gris">Final</dt><dd className="text-hueso [font-variant-numeric:tabular-nums]">{dolares(x.costo.final_usd) ?? <SinDato />}</dd></div>
          </dl>
          {imagen && (
            <p data-texto-publicacion className="text-dato text-gris">
              <span className="text-rotulo uppercase tracking-rotulo">Texto de la publicación · </span>
              {textosPub.length
                ? textosPub.map((t) => <span key={t.campo} data-texto={t.campo} className="block text-hueso"><ConNombres texto={t.texto} /></span>)
                : <SinDato />}
              {pub?.hashtags.length ? <span data-hashtags className="block text-gris">{pub.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}</span> : null}
            </p>
          )}
        </div>
      </div>
      <div>
        <Rotulo>{imagen ? "Láminas · borrador" : "Guion gráfico · borrador"}</Rotulo>
        {x.planos.length
          ? <ol data-guion-grafico className="mt-2 flex gap-2 overflow-x-auto pb-1">{x.planos.map((p, i) => (imagen ? <Lamina key={i} p={p} nombre={nombreDeLaLamina(clase, p.n, x.planos.length)} /> : <Plano key={i} p={p} />))}</ol>
          : <p className="mt-1.5 text-dato"><SinDato /></p>}
      </div>
      <p data-por-que className="mt-auto border-t border-linea pt-3 text-dato text-gris"><span className="text-oro">Por qué · </span>{x.por_que ? <ConNombres texto={x.por_que} /> : <SinDato />}</p>
    </article>
  )
}

/** un plano: sus cuadros en borrador (varios si dura más de 3 s), su papel, sus segundos y el texto que irá en pantalla. Sin imagen, el cuadro vacío dice qué se verá */
function Plano({ p }: { p: PlanoDePropuesta }) {
  const cuadros = Math.max(1, p.imagenes.length)
  return (
    <li data-plano={p.n} className="flex shrink-0 flex-col gap-1" style={{ width: `${cuadros * 64 + (cuadros - 1) * 4}px` }}>
      <div className="flex gap-1">
        {p.imagenes.length
          // eslint-disable-next-line @next/next/no-img-element -- cuadros del almacén de la plataforma, ya en tamaño de borrador
          ? p.imagenes.map((src, i) => <img key={i} data-cuadro src={src} alt={p.se_ve ?? ""} loading="lazy" className="aspect-[9/16] w-16 rounded-control border border-linea bg-carbon object-cover" />)
          : <div data-cuadro-vacio className="flex aspect-[9/16] w-16 items-center justify-center overflow-hidden rounded-control border border-dashed border-linea p-1 text-center text-rotulo leading-tight text-gris">{p.se_ve ?? "Sin imagen"}</div>}
      </div>
      <span className="text-rotulo text-oro">{p.n} · {rolLegible(p.rol) ?? <SinDato />}</span>
      <span className="text-rotulo text-gris">{tramo(p) ?? <SinDato />}</span>
      <span className="text-rotulo leading-snug text-hueso">{p.texto_en_pantalla ? `«${p.texto_en_pantalla}»` : <span className="text-gris">sin texto</span>}</span>
    </li>
  )
}

/** 17-nov · una lámina de imagen: su borrador (renderizado con texto, en su proporción), su nombre y papel, si usa foto propia, y su texto. Sin segundos */
function Lamina({ p, nombre }: { p: PlanoDePropuesta; nombre: string }) {
  const src = p.imagenes[0]
  return (
    <li data-lamina={p.n} className="flex w-24 shrink-0 flex-col gap-1">
      {src
        // eslint-disable-next-line @next/next/no-img-element -- lámina del almacén de la plataforma, ya en tamaño de borrador
        ? <img data-cuadro src={src} alt={p.se_ve ?? nombre} loading="lazy" className="h-auto w-24 rounded-control border border-linea bg-carbon" />
        : <div data-cuadro-vacio className="flex aspect-[4/5] w-24 items-center justify-center overflow-hidden rounded-control border border-dashed border-linea p-1 text-center text-rotulo leading-tight text-gris">{p.se_ve ?? "Sin imagen"}</div>}
      <span className="text-rotulo text-oro">{nombre}{rolLegible(p.rol) ? ` · ${rolLegible(p.rol)}` : ""}</span>
      {p.foto_propia === true && <span data-foto-propia className="text-rotulo text-gris">Foto propia</span>}
      <span className="whitespace-pre-line text-rotulo leading-snug text-hueso">{p.texto_en_pantalla ? `«${p.texto_en_pantalla}»` : <span className="text-gris">sin texto</span>}</span>
    </li>
  )
}
