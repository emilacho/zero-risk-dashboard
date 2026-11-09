"use client"
/**
 * LA ANTENA (CC4 · 04-nov · Emilio eligió la opción 3 con animación sutil, 15:19Z): la parabólica de la plataforma de arriba a la izquierda avisa las alertas del departamento.
 * Sin alertas: no se dibuja nada (la antena de la foto queda quieta como está). Con alguna: la luz de la punta mayor respira en rojo con un aura suave, CENTRADA en la lucecita de la foto (505,257 medido en la foto de 2560 px),
 * y el borde de la plataforma queda COMO EN LA FOTO (su línea naranja de siempre): solo un tramo corto de luz roja viaja por dentro de esa línea, en sentido del reloj. Al tocarla se abre un panel con la lista (mismo marco que los demás).
 * Luces pequeñas y realistas sobre la foto: nada de formas planas.
 */
import { useEffect } from "react"
import { ANTENA, BORDE_DE_LA_ANTENA, type AlertaDeLaAntena } from "@/lib/escena-alertas"
import type { PanelDelMarco } from "@/lib/buscador"
import { haceCuanto } from "@/lib/direccion-decisiones"
import { PanelBase } from "@/components/nuevo/EstiloBase"

export const CSS_DE_LA_ANTENA = `
@keyframes nvAntPulso{0%,100%{opacity:.5;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}
@keyframes nvAntCorre{from{stroke-dashoffset:0}to{stroke-dashoffset:-100}}
.nv-antena .nv-antena-pulso{animation:nvAntPulso 2.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.nv-antena .nv-antena-corre{animation:nvAntCorre 4.2s linear infinite}
@media (prefers-reduced-motion:reduce){.nv-antena .nv-antena-pulso,.nv-antena .nv-antena-corre{animation:none}}`
// la animación vive en la hoja (NO inline): un estilo inline le ganaría a «reducir movimiento» (CC3 04-nov)

export function AntenaDeAlertas({ alertas, onAbrir }: { alertas: AlertaDeLaAntena[] | undefined; onAbrir: () => void }) {
  if (!alertas?.length) return null
  const { punta2 } = ANTENA
  const abrir = (e: { stopPropagation: () => void }) => { e.stopPropagation(); onAbrir() }
  return (
    <g className="nv-antena" data-alertas={alertas.length}>
      <style>{CSS_DE_LA_ANTENA}</style>
      <defs>
        <radialGradient id="nvAntRojo" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff1ee" /><stop offset=".18" stopColor="#ff5a4a" /><stop offset=".55" stopColor="#d81a10" stopOpacity=".55" /><stop offset="1" stopColor="#d81a10" stopOpacity="0" />
        </radialGradient>
        <filter id="nvAntDifumina"><feGaussianBlur stdDeviation="1.6" /></filter>
      </defs>
      {/* el borde NO se enciende: la línea naranja de la foto queda como está y solo un tramo corto de luz roja viaja por dentro de ella (mismo trazo que la línea) */}
      <g filter="url(#nvAntDifumina)" fill="none" strokeLinejoin="round" strokeLinecap="round">
        <path className="nv-antena-corre" d={BORDE_DE_LA_ANTENA} pathLength={100} stroke="#ff3b2a" strokeWidth={2.6} strokeDasharray="5 95" />
      </g>
      {/* 06-nov (Emilio 01:51 local): el número de avisos va SOLO, en rojo, sin círculo ni fondo (el fondo de la foto ya es negro), arriba a la derecha de la luz */}
      <text data-numero-antena x={punta2.x + 30} y={punta2.y - 26} className="fill-alarma font-medio" fontSize={40} aria-hidden style={{ fontVariantNumeric: "tabular-nums" }}>{alertas.length}</text>
      {/* la luz de la punta mayor: aura suave que respira, sin círculo plano */}
      <g className="nv-antena-pulso">
        <circle cx={punta2.x} cy={punta2.y} r={28} fill="url(#nvAntRojo)" />
        <circle cx={punta2.x} cy={punta2.y} r={4} fill="#fff4f0" />
      </g>
      <ellipse cx={ANTENA.plato.x} cy={ANTENA.plato.y} rx={ANTENA.plato.rx + 14} ry={ANTENA.plato.ry + 14} fill="rgba(0,0,0,0)" role="button" tabIndex={0}
        aria-label={`${alertas.length === 1 ? "1 alerta" : `${alertas.length} alertas`} del departamento. Ver la lista`} style={{ cursor: "pointer", pointerEvents: "auto", outline: "none" }}
        onClick={abrir} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(e) } }} />
    </g>
  )
}

/** a dónde lleva cada aviso, en palabras del menú */
const NOMBRE_DEL_LUGAR: Partial<Record<PanelDelMarco, string>> = { envivo: "En vivo", observabilidad: "Observabilidad", decisiones: "Decisiones", riesgos: "Riesgos", piezas: "Piezas", aplicaciones: "Centro de campaña", organizacion: "Organización" }

/**
 * LA LISTA DE LA ANTENA EN ESTILO BASE (boceto aprobado por Emilio 06-nov 01:51 local): se abre encima y sigues en Dept. Marketing.
 * Título ALERTAS en oro con la ✕, «Dept. Marketing», un recuadro con el número en rojo y cada aviso con su punto rojo, cuándo pasó y qué abre.
 */
/** tocar un aviso (CC6 06-nov, prueba del clic): si tiene lugar, cierra la lista y abre ese lugar; sin lugar no hace nada */
export function alTocarElAviso(a: AlertaDeLaAntena, h: { cerrar: () => void; abrir: (panel: PanelDelMarco) => void }): boolean {
  if (!a.abre) return false
  h.cerrar(); h.abrir(a.abre)
  return true
}

/** Esc cierra SOLO la lista (en captura, sin que llegue a la oficina); devuelve cómo soltarlo al cerrar */
export function escucharEsc(w: Pick<Window, "addEventListener" | "removeEventListener">, onCerrar: () => void): () => void {
  const tecla = (e: KeyboardEvent) => { if (e.key !== "Escape") return; e.stopPropagation(); e.preventDefault(); onCerrar() }
  w.addEventListener("keydown", tecla as EventListener, true)
  return () => w.removeEventListener("keydown", tecla as EventListener, true)
}

export function PanelDeLasAlertas(p: { alertas: AlertaDeLaAntena[] | undefined; onAbrir: (a: AlertaDeLaAntena) => void; onCerrar: () => void; ahora?: number }) {
  const { onCerrar } = p
  useEffect(() => escucharEsc(window, onCerrar), [onCerrar])
  return ListaDeLasAlertas(p)
}

/** lo que se dibuja (sin ganchos de React: se puede probar el clic llamándola) */
export function ListaDeLasAlertas({ alertas, onAbrir, onCerrar, ahora }: { alertas: AlertaDeLaAntena[] | undefined; onAbrir: (a: AlertaDeLaAntena) => void; onCerrar: () => void; ahora?: number }) {
  const lista = alertas ?? []
  return (
    // 09-nov · boceto aprobado: cabecera de una línea (ALERTAS + el número en un recuadro chico), sin «Dept. Marketing» ni el recuadro grande;
    // el aviso es lo principal y el panel se ensancha lo justo para que su texto quepa en una línea (hasta 640 px)
    <PanelBase titulo="Alertas" id="alertas-antena-titulo" seccion="alertas-antena" onCerrar={onCerrar} etiquetaCerrar="Cerrar las alertas" ancho="max-w-[min(720px,100%)] sm:w-auto sm:min-w-[540px]"
      junto={<span data-numero aria-label={lista.length === 1 ? "1 aviso abierto" : `${lista.length} avisos abiertos`} className={`inline-flex h-6 min-w-6 items-center justify-center rounded-control border px-1.5 text-dato font-medio tabular-nums ${lista.length ? "border-linea-alarma text-alarma" : "border-linea text-gris"}`}>{lista.length}</span>}>
      <div data-panel-alertas className="mt-2 flex flex-col">
        {lista.length === 0 && <p data-todo-en-orden className="border-t border-linea py-4 text-center text-cuerpo text-gris">Todo en orden</p>}
        <ul>
          {lista.map((a) => {
            const lugar = a.abre ? NOMBRE_DEL_LUGAR[a.abre] ?? null : null
            return (
              <li key={a.clave} data-alerta={a.tipo} className="border-t border-linea">
                <button type="button" disabled={!a.abre} onClick={() => onAbrir(a)} className="grid min-h-11 w-full grid-cols-[20px_1fr_auto] items-center gap-3 py-5 text-left hover:text-hueso disabled:cursor-default">
                  <span aria-hidden className="h-2 w-2 rounded-full bg-alarma" />
                  <span className="min-w-0">
                    <span className="block text-titulo text-hueso">{a.texto}</span>
                    <span data-cuando className="mt-1 block text-cuerpo text-gris">{haceCuanto(a.cuando, ahora)}{lugar ? ` · abre ${lugar}` : ""}</span>
                  </span>
                  {a.abre && <span aria-hidden className="text-titulo text-gris">›</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </PanelBase>
  )
}
