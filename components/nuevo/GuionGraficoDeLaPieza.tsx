"use client"
/**
 * 28-nov · GO Lenovo 09:54Z (Emilio aprobó el boceto `2-PROPUESTA-*`) · «GUION GRÁFICO · LA PIEZA» en el visor de la pieza de video terminada.
 * Las mismas escenas que la propuesta aprobada, en el mismo orden, con su nombre, sus segundos y el texto en pantalla, y sus fotos sacadas del video terminado.
 * Con 1 foto por escena se ve igual que el boceto de la propuesta (4 a lo ancho); con más, una fila por escena y cada foto con su segundo.
 */
import { Rotulo } from "@/components/nuevo/EstiloBase"
import type { EscenaDeLaPieza, GuionGraficoDeLaPieza as Guion } from "@/lib/guion-grafico-de-la-pieza"
import { rolLegible, tramo } from "@/lib/propuestas"

const PARTES: Record<number, string[]> = { 2: ["inicio", "final"], 3: ["inicio", "medio", "final"] }
const fmt = (s: number) => (Number.isInteger(s) ? String(s) : s.toLocaleString("es-EC", { maximumFractionDigits: 1 }))
/** la etiqueta de cada foto: con 2 o 3 por escena dice inicio/medio/final y su segundo; con más, solo su segundo */
export const etiquetaDeLaFoto = (n: number, k: number, segundo: number): string => `${PARTES[n]?.[k] ? `${PARTES[n][k]} · ` : ""}${fmt(segundo)} s`

const IMG = "aspect-[9/16] w-full rounded-control border border-linea bg-carbon object-cover"

function Cabeza({ e }: { e: EscenaDeLaPieza }) {
  return (
    <>
      <span className="text-rotulo text-oro">{e.n} · {rolLegible(e.rol) ?? "sin papel"}</span>
      <span className="text-rotulo text-gris">{tramo(e) ?? "sin segundos"}</span>
      <span className="text-rotulo leading-snug text-hueso">{e.texto_en_pantalla ? `«${e.texto_en_pantalla}»` : <span className="text-gris">sin texto en pantalla</span>}</span>
    </>
  )
}

/** una escena sin foto del video (no salió): se dice qué se iba a ver, nunca se inventa un cuadro */
function SinFoto({ e }: { e: EscenaDeLaPieza }) {
  return <div data-cuadro-vacio className="flex aspect-[9/16] w-full items-center justify-center overflow-hidden rounded-control border border-dashed border-linea p-1 text-center text-rotulo leading-tight text-gris">{e.se_ve ?? "Sin foto del video"}</div>
}

export function GuionGraficoDeLaPieza({ g, onVerVideo }: { g: Guion; onVerVideo?: () => void }) {
  const n = g.fotos_por_escena
  const total = g.escenas.reduce((a, e) => a + e.fotos.length, 0)
  return (
    <section data-guion-de-la-pieza data-fotos-por-escena={n} className="w-full max-w-5xl self-stretch">
      {onVerVideo && (
        <p className="mb-3 flex items-center gap-2 text-dato text-gris">
          <button type="button" data-ver-video-terminado onClick={onVerVideo} className="-my-2 inline-flex min-h-11 items-center gap-2 rounded-control font-medio text-oro hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-linea-oro">▶ Ver el video terminado</button>
          {g.segundos != null && <span>· {fmt(g.segundos)} s · 9:16</span>}
        </p>
      )}
      <Rotulo>Guion gráfico · la pieza</Rotulo>
      <p data-resumen-del-guion className="mb-3 mt-1 text-dato text-gris">
        Escena por escena, como el boceto de su propuesta · {g.escenas.length} {g.escenas.length === 1 ? "escena" : "escenas"} · {total} {total === 1 ? "foto" : "fotos"} ({n} por escena{g.segundos != null ? `, pieza de ${fmt(g.segundos)} s` : ""}) · salen del video terminado
      </p>
      {n === 1
        ? (
          <ol data-guion-grafico className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {g.escenas.map((e) => (
              <li key={e.n} data-escena={e.n} className="flex min-w-0 flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- foto del video terminado, del almacén de la oficina */}
                {e.fotos[0] ? <img data-foto-del-video src={e.fotos[0].url} alt={e.se_ve ?? `Escena ${e.n}`} loading="lazy" className={IMG} /> : <SinFoto e={e} />}
                <Cabeza e={e} />
              </li>
            ))}
          </ol>
        )
        : (
          <ol data-guion-grafico className="flex flex-col">
            {g.escenas.map((e) => (
              <li key={e.n} data-escena={e.n} className="grid grid-cols-1 gap-3 border-t border-linea py-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
                <div className="flex min-w-0 flex-col gap-1"><Cabeza e={e} /></div>
                <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(n, 1)}, minmax(0, 1fr))` }}>
                  {e.fotos.length
                    ? e.fotos.map((f, k) => (
                      <li key={f.url} className="relative min-w-0">
                        {/* eslint-disable-next-line @next/next/no-img-element -- foto del video terminado, del almacén de la oficina */}
                        <img data-foto-del-video src={f.url} alt={`${e.se_ve ?? `Escena ${e.n}`} · ${fmt(f.segundo)} s`} loading="lazy" className={IMG} />
                        <span data-etiqueta className="num absolute left-2 top-2 rounded-full bg-velo px-2 py-0.5 text-rotulo text-hueso">{etiquetaDeLaFoto(e.fotos.length === n ? n : 0, k, f.segundo)}</span>
                      </li>
                    ))
                    : <li className="min-w-0"><SinFoto e={e} /></li>}
                </ol>
              </li>
            ))}
          </ol>
        )}
    </section>
  )
}
