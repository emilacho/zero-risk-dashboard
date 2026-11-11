"use client"
/**
 * EL PANEL DERECHO DEL VISOR DE UNA PIEZA (boceto `2-panel-despues.png` aprobado por Emilio 11-nov 21:54 Zúrich · GO Lenovo 21:55).
 * De lo macro a lo micro: chips de estado y avisos (se tocan para ver el detalle) · 4 recuadros · Tema · Texto (lo que se aprueba y se corrige) ·
 * el bloque de la lámina en las piezas de láminas · plegados cerrados: Revisión · Equipo · Detalle. Sin nombres técnicos ni ids.
 * Solo para piezas (`es_pieza`); las otras revisiones siguen con su barra de siempre.
 */
import { useState, type ReactNode } from "react"
import { Rotulo } from "@/components/nuevo/EstiloBase"
import { ESTADO_DE_PIEZA_LEGIBLE, CARPETA_ARCHIVO, tonoDelEstado } from "@/lib/bandeja"
import type { DetalleDeLaPieza } from "@/lib/piezas-datos"
import type { EstadoPieza, Lamina, VideoDeLaPieza } from "@/lib/piezas"
import { quienLaHizo } from "@/lib/pieza-acompana"
import { nombreDeLaFase } from "@/components/nuevo/PanelPizarron"
import { diaYHora, fechaYHoraEnPalabras, rolDeLaMesaLegible, tipoDeAporteLegible } from "@/lib/lenguaje"
import { chipsDeLosAvisos, cuandoDeLaFila, dondeDeLaFila, mayuscula, resumenDeLaRevision, resumenDelDetalle, resumenDelEquipo, sedeDeLaFila, temaPartido, valorDeLasLaminas, valorDelVideo } from "@/lib/panel-de-la-pieza"

const CHIP = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-dato"
const TONO_DEL_ESTADO = { ambar: "border-linea-oro text-oro", rojo: "border-linea-alarma text-alarma", verde: "border-linea text-hueso", azul: "border-linea text-hueso", neutro: "border-linea text-gris" } as const

/** tocar un chip abre su detalle; tocarlo otra vez (o tocar otro) lo cambia */
export const alternarAviso = (abierto: number | null, i: number): number | null => (abierto === i ? null : i)

function Recuadro({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-tarjeta border border-linea bg-grafito-2 px-3 py-3" data-recuadro={rotulo}>
      <Rotulo tono="gris">{rotulo}</Rotulo>
      <p className="num mt-1 text-cuerpo font-medio text-hueso">{valor}</p>
    </div>
  )
}

function Plegado({ rotulo, resumen, children }: { rotulo: string; resumen: string; children: ReactNode }) {
  return (
    <details className="group border-t border-linea" data-plegado={rotulo}>
      <summary className="flex cursor-pointer list-none items-center justify-between py-3 [&::-webkit-details-marker]:hidden">
        <Rotulo>{rotulo}</Rotulo>
        <span className="text-dato text-gris">{resumen} <span aria-hidden className="inline-block text-oro transition-transform group-open:rotate-90">▸</span></span>
      </summary>
      <div className="space-y-2 pb-3 text-dato text-hueso">{children}</div>
    </details>
  )
}

function Fila({ que, children }: { que: string; children: ReactNode }) {
  return <div><dt className="inline text-gris">{que} · </dt><dd className="inline">{children}</dd></div>
}

export function BarraDeLaPieza({ pieza, estado, video, total, lamina, texto, bloqueDeLaLamina }: {
  pieza: DetalleDeLaPieza
  estado: EstadoPieza
  video: VideoDeLaPieza | null
  total: number
  lamina: Lamina | null
  /** el pie de la publicación con su «Editar» (lo arma el visor) */
  texto: ReactNode
  /** en las piezas de láminas, el bloque «Lámina N» con sus textos que se editan */
  bloqueDeLaLamina: ReactNode
}) {
  const [abierto, setAbierto] = useState<number | null>(null)
  const f = pieza.acompana?.fila ?? null
  const chips = chipsDeLosAvisos(pieza.avisos)
  const tema = temaPartido(f?.tema)
  const equipo = pieza.acompana ? quienLaHizo(pieza.acompana.productores) : []
  const desac = pieza.jefatura.desacuerdos
  const vence = video ? fechaYHoraEnPalabras(video.vence) : null
  const chipAbierto = abierto != null ? chips[abierto] : null
  return (
    <div className="flex flex-col gap-5" data-panel-derecho>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2" data-chips-de-la-pieza>
          <span className={`${CHIP} font-medio ${TONO_DEL_ESTADO[tonoDelEstado(estado)]}`} data-chip="estado">{mayuscula(ESTADO_DE_PIEZA_LEGIBLE[estado])}</span>
          {pieza.archivada && <span className={`${CHIP} border-linea text-gris`} data-chip="archivada">{CARPETA_ARCHIVO}</span>}
          {pieza.recuperada_del_archivo && !pieza.archivada && <span className={`${CHIP} border-linea text-hueso`} data-chip="recuperada">Recuperada del archivo</span>}
          {pieza.version != null && <span className={`${CHIP} border-linea text-gris`} data-chip="version">Versión {pieza.version}</span>}
          {chips.map((c, i) => (
            <button key={i} type="button" data-chip-aviso={c.nivel} aria-expanded={abierto === i} onClick={() => setAbierto((a) => alternarAviso(a, i))} data-nota="estilo-ok: chip de aviso que se despliega, no es un botón de acción"
              className={`${CHIP} ${c.nivel === "rojo" ? "border-linea-alarma text-alarma" : "border-linea-oro text-hueso"}`}>
              {c.corto}<span aria-hidden className={`inline-block text-oro transition-transform ${abierto === i ? "rotate-90" : ""}`}>▸</span>
            </button>
          ))}
        </div>
        {chipAbierto && <p role={chipAbierto.nivel === "rojo" ? "alert" : undefined} data-detalle-del-aviso className={`text-dato ${chipAbierto.nivel === "rojo" ? "text-alarma" : "text-hueso"}`}>{chipAbierto.detalle}</p>}
        {/* lo rojo nunca queda escondido detrás de un chip cerrado: se anuncia aunque no se toque */}
        {chips.some((c) => c.nivel === "rojo") && !chipAbierto && <p role="alert" className="sr-only">{chips.filter((c) => c.nivel === "rojo").map((c) => c.detalle).join(" ")}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Recuadro rotulo="Cuándo" valor={cuandoDeLaFila(f)} />
        <Recuadro rotulo="Dónde" valor={dondeDeLaFila(f)} />
        {video ? <Recuadro rotulo="Video" valor={valorDelVideo(video)} /> : <Recuadro rotulo="Láminas" valor={total > 0 ? valorDeLasLaminas(total, lamina?.ancho, lamina?.alto) : "Sin dibujo"} />}
        <Recuadro rotulo="Sede" valor={sedeDeLaFila(f)} />
      </div>

      {tema && (
        <div data-tema>
          <Rotulo>Tema</Rotulo>
          <p className="mt-1 text-cuerpo font-medio text-hueso">{tema.corto}</p>
          {tema.linea && <p className="mt-0.5 line-clamp-2 text-dato text-gris">{tema.linea}</p>}
        </div>
      )}

      <div data-texto-de-la-pieza>
        <Rotulo>Texto</Rotulo>
        <div className="mt-1 rounded-tarjeta border border-linea bg-grafito-2 px-3 py-3 text-cuerpo text-hueso">{texto}</div>
      </div>

      {bloqueDeLaLamina}

      <div>
        <Plegado rotulo="Revisión" resumen={resumenDeLaRevision(desac.length)}>
          {desac.length > 0 && <ul className="list-disc space-y-1 pl-4">{desac.map((d, i) => <li key={i}>{d}</li>)}</ul>}
          {pieza.jefatura.opinion_externa && <details><summary className="cursor-pointer text-gris">Opinión externa (otro modelo, no vota)</summary><p className="mt-1 whitespace-pre-wrap">{pieza.jefatura.opinion_externa.slice(0, 1400)}</p></details>}
          {desac.length === 0 && !pieza.jefatura.opinion_externa && <p className="italic text-gris">Sin desacuerdos ni opinión externa guardados.</p>}
        </Plegado>
        <Plegado rotulo="Equipo" resumen={resumenDelEquipo(equipo.length, pieza.aportes.length)}>
          {equipo.length > 0 ? <ul className="space-y-1">{equipo.map((q) => <li key={q.agente}>{rolDeLaMesaLegible(q.agente)}{q.que.length ? <span className="text-gris"> · {q.que.join(" · ")}</span> : null}</li>)}</ul> : <p className="italic text-gris">La jefatura no guardó quién hizo cada parte.</p>}
          {pieza.aportes.length > 0 && <ul className="space-y-2 border-t border-linea pt-2">{pieza.aportes.map((a) => <li key={a.n}><p className="text-rotulo text-gris">{rolDeLaMesaLegible(a.de)} {tipoDeAporteLegible(a.tipo)}{a.para ? ` a ${rolDeLaMesaLegible(a.para)}` : ""}</p><p className="whitespace-pre-wrap">{a.texto.slice(0, 600)}</p></li>)}</ul>}
        </Plegado>
        <Plegado rotulo="Detalle" resumen={resumenDelDetalle(video?.vence, pieza.creada)}>
          <dl className="space-y-0.5">
            {video && <Fila que="Archivo">{video.nombre ? `${video.nombre}${video.bytes != null ? ` · ${(video.bytes / 1_000_000).toFixed(1).replace(".", ",")} MB` : ""}` : "Sin archivo guardado."}</Fila>}
            {vence && <Fila que="Vence">{vence} (hora de Ecuador)</Fila>}
            {f?.pilar && <Fila que="Pilar">{mayuscula(f.pilar)}</Fila>}
            {f && <Fila que="Fase">{f.fase ? nombreDeLaFase(f.fase) : "sin fase asignada"}</Fila>}
            <Fila que="Entró a la bandeja">{diaYHora(pieza.creada)}</Fila>
            {pieza.cliente && <Fila que="Cliente">{pieza.cliente}</Fila>}
          </dl>
          {!f && <p className="italic text-gris">Esta pieza no está atada a una fila del calendario.</p>}
          {video?.solo_en_proveedor && video.url_proveedor && <p><a href={video.url_proveedor} target="_blank" rel="noopener noreferrer" className="underline">Bajarlo del proveedor</a>{vence ? ` antes del ${vence} (hora de Ecuador)` : ""}</p>}
        </Plegado>
      </div>
    </div>
  )
}
