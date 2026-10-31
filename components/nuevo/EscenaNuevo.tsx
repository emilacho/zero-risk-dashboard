/**
 * DASHBOARD NUEVO · la escena (variante-14, recortada y en versión liviana) con DOS zonas clicables y nada más (firma de Emilio, 30-oct).
 * Sprint 5 (31-oct, CC5): la escena un 30 % más grande (75 % del ancho en vez de 58 %) y con la capa de vida de Spline encima de la foto (`fondo`).
 *  · el monolito central → `cerebro` (/oficinas#cerebro)
 *  · la plataforma de las pantallas y el proyector → «Dept. Marketing» (/nuevo/marketing; sprint 3, 31-oct). Se ilumina en ámbar poco a poco y aparece su rótulo.
 * Las demás plataformas no tienen enlace ni resaltado: se irán activando una por una. El SVG de encima usa las mismas coordenadas de la imagen (ver VISTA).
 */
import type { ReactNode } from "react"
export const VISTA = { x: 150, y: 40, w: 1700, h: 920 } // el recorte de la variante-14 (en las coordenadas de 2000×1125 en que se midieron las zonas)

interface Zona { clave: string; nombre: string; href: string; formas: string[]; rotulo?: { x: number; y: number; texto: string } }

export const ZONAS: Zona[] = [
  {
    clave: "cerebro", nombre: "Cerebro", href: "/oficinas#cerebro",
    formas: ["936,352 1010,306 1084,338 1084,507 1010,552 936,517"],
  },
  {
    clave: "marketing", nombre: "Dept. Marketing", href: "/nuevo/marketing",
    formas: ["1160,358 1226,250 1316,214 1404,240 1468,338 1470,374 1310,462"], // la plataforma de arriba a la derecha con el proyector y su pantalla
    rotulo: { x: 1316, y: 188, texto: "Dept. Marketing" },
  },
]

/** de dónde sale la proyección del departamento (el centro de su plataforma, en % de la escena) */
export const ORIGEN_MARKETING = { x: ((1316 - VISTA.x) / VISTA.w) * 100, y: ((350 - VISTA.y) / VISTA.h) * 100 }

const ESTILO_ESCENA = `
.nv-escena{width:min(100%,75vw,calc((100dvh - 15rem) * 3264 / 1766));background:#000;box-shadow:0 0 140px 100px #000}
@media (max-width:900px){.nv-escena{width:min(100%,calc((100dvh - 15rem) * 3264 / 1766))}}
`

const ESTILO = `
.nv-zona{cursor:pointer;outline:none;transition:filter .45s ease}
.nv-zona polygon{fill:rgba(255,140,40,0);stroke:rgba(255,160,50,0);stroke-width:2.5;stroke-linejoin:round;transition:fill .45s ease,stroke .45s ease}
.nv-zona:hover polygon,.nv-zona:focus-visible polygon{fill:rgba(255,140,40,.16);stroke:rgba(255,170,60,.95)}
.nv-zona:hover,.nv-zona:focus-visible{filter:drop-shadow(0 0 10px rgba(255,140,40,.6))}
.nv-rotulo{opacity:0;transform:translateY(5px);transition:opacity .45s ease,transform .45s ease;pointer-events:none}
.nv-zona:hover .nv-rotulo,.nv-zona:focus-visible .nv-rotulo{opacity:1;transform:translateY(0)}
@media (prefers-reduced-motion:reduce){.nv-zona,.nv-zona polygon,.nv-rotulo{transition:none}}
`

/** `fondo` va ENTRE la foto y las zonas clicables (la capa de vida de Spline, sprint 5): nunca tapa el hover ni los clics */
export function EscenaNuevo({ alAbrirMarketing, fondo, children }: { alAbrirMarketing?: () => void; fondo?: ReactNode; children?: ReactNode }) {
  return (
    <>
      <style>{ESTILO_ESCENA}</style>
      {/* SIN viñeta (5.2, Emilio: «iguala la iluminación a la de la foto original»): la máscara radial de antes mezclaba más de la mitad de la foto
          con el gris de la página (anillo medio al 91 % de brillo, bordes al 223 %). La foto se muestra tal cual; el negro de alrededor lo pone .nv-escena. */}
      <div className="nv-escena relative mx-auto aspect-[3264/1766]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {/* [transform:translateZ(0)] en la foto: con un lienzo WebGL encima (la capa de vida) Chrome la redibuja con otro filtro y se ve distinta;
            en su propia capa de composición queda píxel-idéntica a la foto sola (medido 31-oct: 0 píxeles cambiados). No es decorativo: no quitar. */}
        <img
          src="/nuevo/escena-2560.jpg" srcSet="/nuevo/escena-1280.jpg 1280w, /nuevo/escena-2560.jpg 2560w" sizes="(max-width: 900px) 100vw, 1400px"
          alt="Las oficinas de Zero Risk" width={2560} height={1385} fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full select-none [transform:translateZ(0)]" draggable={false}
        />
        {fondo}
        <svg viewBox={`${VISTA.x} ${VISTA.y} ${VISTA.w} ${VISTA.h}`} className="absolute inset-0 h-full w-full" role="group" aria-label="Zonas de la escena" xmlns="http://www.w3.org/2000/svg">
          <style>{ESTILO}</style>
          {ZONAS.map((z) => (
            // un enlace de SVG: next/link no vive dentro de un <svg>
            // eslint-disable-next-line @next/next/no-html-link-for-pages
            <a key={z.clave} href={z.href} className="nv-zona" data-zona={z.clave} aria-label={z.nombre}
              onClick={z.clave === "marketing" && alAbrirMarketing ? (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); alAbrirMarketing() } : undefined}>
              {z.formas.map((f, i) => <polygon key={i} points={f} />)}
              {z.rotulo && (
                <text className="nv-rotulo" x={z.rotulo.x} y={z.rotulo.y} textAnchor="middle" fill="#ffb347" fontSize="26" fontWeight="300" letterSpacing="5"
                  fontFamily="system-ui, Arial, sans-serif">{z.rotulo.texto}</text>
              )}
            </a>
          ))}
        </svg>
        {children}
      </div>
    </>
  )
}
