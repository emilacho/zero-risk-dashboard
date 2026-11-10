"use client"
/**
 * LA ANTENA (CC4 · 04-nov · Emilio eligió la opción 3 con animación sutil, 15:19Z): la parabólica de la plataforma de arriba a la izquierda avisa las alertas del departamento.
 * Sin alertas: las dos lucecitas de la foto se APAGAN (regla de Emilio 09-nov, ver `LucesApagadas`) y no hay número. Con alguna: la luz de la punta mayor respira en rojo con un aura suave, CENTRADA en la lucecita de la foto (505,257 medido en la foto de 2560 px),
 * y el borde de la plataforma queda COMO EN LA FOTO (su línea naranja de siempre): solo un tramo corto de luz roja viaja por dentro de esa línea, en sentido del reloj. Al tocarla se abre un panel con la lista (mismo marco que los demás).
 * Luces pequeñas y realistas sobre la foto: nada de formas planas.
 */
import { useEffect } from "react"
import { createPortal } from "react-dom"
import { ANTENA, BORDE_DE_LA_ANTENA, esNuevaEnLaAntena, nuevasDeLaAntena, type AlertaDeLaAntena } from "@/lib/escena-alertas"
import { BotonRevisar } from "@/components/nuevo/BotonRevisar"
import { ConNombres } from "@/components/nuevo/FichaDeDecision"
import type { PanelDelMarco } from "@/lib/buscador"
import { haceCuanto } from "@/lib/direccion-decisiones"
/** «Hace 9 horas», como en la imagen aprobada (CC6 #296) */
const conMayuscula = (s: string) => s.charAt(0).toLocaleUpperCase("es") + s.slice(1)
import { PanelBase } from "@/components/nuevo/EstiloBase"

export const CSS_DE_LA_ANTENA = `
@keyframes nvAntPulso{0%,100%{opacity:.5;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}
@keyframes nvAntCorre{from{stroke-dashoffset:0}to{stroke-dashoffset:-100}}
.nv-antena .nv-antena-pulso{animation:nvAntPulso 2.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.nv-antena .nv-antena-corre{animation:nvAntCorre 4.2s linear infinite}
@media (prefers-reduced-motion:reduce){.nv-antena .nv-antena-pulso,.nv-antena .nv-antena-corre{animation:none}}`
// la animación vive en la hoja (NO inline): un estilo inline le ganaría a «reducir movimiento» (CC3 04-nov)

/**
 * 09-nov (regla de Emilio): la luz de la antena SOLO se prende cuando hay una alerta. La foto trae encendidas sus dos lucecitas
 * (las puntas, medidas en marketing-2560: 505,257 y 369,342, con brillo de ~18 px) y un brillo cálido en el centro del plato (446,338); se apagan SIEMPRE dibujando encima una bombilla
 * apagada (gris oscuro) con un velo oscuro que se desvanece. Con alertas, solo la punta mayor se prende, en rojo, encima.
 */
export const LUCES_DE_LA_FOTO = [
  { clave: "mayor", ...ANTENA.punta2, r: 20, fondo: "#070605" },
  { clave: "menor", ...ANTENA.punta1, r: 15, fondo: "#070605" },
  { clave: "plato", x: 446, y: 338, r: 9, fondo: "#423f3c" }, // dentro del plato el fondo es gris, no negro
] as const
export function LucesApagadas() {
  return (
    <g data-luces-apagadas aria-hidden style={{ pointerEvents: "none" }}>
      <defs>
        {LUCES_DE_LA_FOTO.map((l) => (
          <radialGradient key={l.clave} id={`nvAntApaga-${l.clave}`} cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor={l.fondo} /><stop offset=".55" stopColor={l.fondo} stopOpacity=".92" /><stop offset="1" stopColor={l.fondo} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      {LUCES_DE_LA_FOTO.map((l) => (
        <g key={l.clave} data-luz-apagada={l.clave}>
          <circle cx={l.x} cy={l.y} r={l.r} fill={`url(#nvAntApaga-${l.clave})`} />
          <circle cx={l.x} cy={l.y} r={3.2} fill="#24221f" />
        </g>
      ))}
    </g>
  )
}

export function AntenaDeAlertas({ alertas, onAbrir }: { alertas: AlertaDeLaAntena[] | undefined; onAbrir: () => void }) {
  if (!alertas?.length) return <LucesApagadas />
  const { punta2 } = ANTENA
  const abrir = (e: { stopPropagation: () => void }) => { e.stopPropagation(); onAbrir() }
  return (
    <g className="nv-antena" data-alertas={alertas.length}>
      <LucesApagadas />
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

export function PanelDeLasAlertas(p: PropsDeLaLista) {
  const { onCerrar } = p
  useEffect(() => escucharEsc(window, onCerrar), [onCerrar])
  return enElCuerpo(ListaDeLasAlertas(p))
}

/**
 * 09-nov (CORRECCIÓN de Lenovo, Emilio en producción): la lista va al <body>, como los demás paneles. Dentro de la escena heredaba
 * `.nv-av{pointer-events:none}`: la ✕ no cerraba y el clic en un aviso caía en la mesa de abajo (abría el plantel de Estrategia).
 * Sin documento (servidor y pruebas sin navegador) se dibuja en el lugar.
 */
export function enElCuerpo(lista: ReturnType<typeof ListaDeLasAlertas>) {
  return typeof document === "undefined" ? lista : createPortal(lista, document.body)
}

/** lo que se dibuja (sin ganchos de React: se puede probar el clic llamándola) */
interface PropsDeLaLista {
  alertas: AlertaDeLaAntena[] | undefined; onAbrir: (a: AlertaDeLaAntena) => void; onCerrar: () => void; ahora?: number
  /** 10-nov · las decisiones que marcaste en esta visita (clave → cuándo), para que el número baje sin esperar la próxima lectura */
  revisadasAqui?: Record<string, string>
  /** «✓ Revisar» guardó: la escena lo anota y la antena deja de contarla */
  alRevisar?: (clave: string, en: string) => void
  fetchImpl?: typeof fetch
}
export function ListaDeLasAlertas({ alertas, onAbrir, onCerrar, ahora, revisadasAqui = {}, alRevisar, fetchImpl }: PropsDeLaLista) {
  const lista = alertas ?? []
  // 10-nov (Lenovo 23:46Z): el número cuenta solo las Nuevas; las revisadas siguen en la lista con su sello hasta que se resuelven
  const nuevas = nuevasDeLaAntena(lista, revisadasAqui).length
  return (
    // 09-nov · boceto aprobado: cabecera de una línea (ALERTAS + el número en un recuadro chico), sin «Dept. Marketing» ni el recuadro grande;
    // el aviso es lo principal y el panel se ensancha lo justo para que su texto quepa en una línea (hasta 720 px)
    <PanelBase titulo="Alertas" id="alertas-antena-titulo" seccion="alertas-antena" onCerrar={onCerrar} etiquetaCerrar="Cerrar las alertas" ancho="max-w-[min(720px,100%)] sm:w-auto sm:min-w-[540px]"
      junto={<span data-numero aria-label={nuevas === 1 ? "1 aviso nuevo" : `${nuevas} avisos nuevos`} className={`inline-flex h-6 min-w-9 items-center justify-center rounded-control border px-2 text-cuerpo leading-none font-medio tabular-nums ${nuevas ? "border-linea-alarma text-alarma" : "border-linea text-gris"}`}>{nuevas}</span>}>
      <div data-panel-alertas className="mt-2 flex flex-col">
        {lista.length === 0 && <p data-todo-en-orden className="border-t border-linea py-4 text-center text-cuerpo text-gris">Todo en orden</p>}
        <ul>
          {lista.map((a) => {
            const lugar = a.abre ? NOMBRE_DEL_LUGAR[a.abre] ?? null : null
            const nueva = esNuevaEnLaAntena(a, revisadasAqui)
            return (
              <li key={a.clave} data-alerta={a.tipo} data-nueva={nueva || undefined} className="flex items-start gap-3 border-t border-linea">
                <button type="button" disabled={!a.abre} onClick={() => onAbrir(a)} className="grid min-h-11 min-w-0 flex-1 grid-cols-[20px_1fr_auto] items-center gap-3 py-5 text-left hover:text-hueso disabled:cursor-default">
                  {/* Nueva: punto rojo; Revisada: círculo hueco (boceto aprobado) */}
                  <span aria-hidden className={`h-2 w-2 rounded-full ${nueva ? "bg-alarma" : "border border-gris"}`} />
                  <span className="min-w-0">
                    {a.tipo === "decision" && <span data-rotulo className="block text-dato uppercase tracking-widest text-oro">Decisión</span>}
                    {/* los nombres propios (Campaña de Marketing, Plan de Marketing…) con su línea dorada, como en la ficha (§4.10) */}
                    <span className="block text-titulo text-hueso"><ConNombres texto={a.texto} /></span>
                    <span data-cuando className="mt-1 block text-cuerpo text-gris">{a.cliente ? `${a.cliente} · ` : ""}{a.cliente ? haceCuanto(a.cuando, ahora) : conMayuscula(haceCuanto(a.cuando, ahora))}{lugar ? ` · abre ${lugar}` : ""}</span>
                  </span>
                  {a.abre && <span aria-hidden className="text-titulo text-gris">›</span>}
                </button>
                {/* 10-nov · «✓ Revisar», la MISMA pieza que el panel de Decisiones (CC4 #316): solo para avisar que ya lo viste; no decide nada */}
                {a.revisar && (
                  <span data-fila-revisar className="shrink-0 pt-4">
                    <BotonRevisar key={a.revisar.clave} clave={a.revisar.clave} fetchImpl={fetchImpl}
                      revisadaEn={revisadasAqui[a.revisar.clave] ?? (a.revisar.estado === "revisada" ? a.revisar.revisada_en ?? a.revisar.clave : null)}
                      alRevisar={alRevisar} />
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </PanelBase>
  )
}
