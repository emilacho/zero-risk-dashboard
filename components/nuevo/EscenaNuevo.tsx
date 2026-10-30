/**
 * DASHBOARD NUEVO · SPRINT 1: la escena (variante-14, recortada y en versión liviana) con DOS zonas clicables y nada más (firma de Emilio, 30-oct):
 *  · el monolito central → `cerebro` (/oficinas#cerebro)
 *  · las pantallas y el proyector → todas las oficinas (/oficinas)
 * Las demás plataformas no tienen enlace ni resaltado: se irán activando una por una. El SVG de encima usa las mismas coordenadas de la imagen (ver VISTA).
 */
export const VISTA = { x: 150, y: 40, w: 1700, h: 920 } // el recorte de la variante-14 (en las coordenadas de 2000×1125 en que se midieron las zonas)

interface Zona { clave: string; nombre: string; href: string; formas: string[] }

export const ZONAS: Zona[] = [
  {
    clave: "cerebro", nombre: "Cerebro", href: "/oficinas#cerebro",
    formas: ["936,352 1010,306 1084,338 1084,507 1010,552 936,517"],
  },
  {
    clave: "oficinas", nombre: "Todas las oficinas", href: "/oficinas",
    formas: [
      "1228,234 1314,234 1314,354 1228,354", // el proyector
      "1342,258 1396,258 1396,348 1342,348", // la pantalla de arriba a la derecha
      "1096,394 1156,394 1156,504 1096,504", // la pantalla junto al monolito
      "1068,642 1116,642 1116,736 1068,736", // la pantalla suelta de abajo
    ],
  },
]

const ESTILO = `
.nv-zona{cursor:pointer;outline:none}
.nv-zona polygon{fill:rgba(255,140,40,0);stroke:rgba(255,160,50,0);stroke-width:2.5;stroke-linejoin:round;transition:fill .2s ease,stroke .2s ease}
.nv-zona:hover polygon,.nv-zona:focus-visible polygon{fill:rgba(255,140,40,.16);stroke:rgba(255,170,60,.95)}
.nv-zona:hover,.nv-zona:focus-visible{filter:drop-shadow(0 0 10px rgba(255,140,40,.6))}
@media (prefers-reduced-motion:reduce){.nv-zona polygon{transition:none}}
`

export function EscenaNuevo() {
  return (
    <div className="relative mx-auto aspect-[3264/1766]" style={{
      width: "min(100%, 58vw, calc((100dvh - 15rem) * 3264 / 1766))",
      // los bordes se funden con el fondo: la escena no se ve como un cuadro (viñeta radial)
      WebkitMaskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, #000 52%, transparent 100%)", maskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, #000 52%, transparent 100%)",
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/nuevo/escena-2560.jpg" srcSet="/nuevo/escena-1280.jpg 1280w, /nuevo/escena-2560.jpg 2560w" sizes="(max-width: 900px) 100vw, 1400px"
        alt="Las oficinas de Zero Risk" width={2560} height={1385} fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full select-none" draggable={false}
      />
      <svg viewBox={`${VISTA.x} ${VISTA.y} ${VISTA.w} ${VISTA.h}`} className="absolute inset-0 h-full w-full" role="group" aria-label="Zonas de la escena" xmlns="http://www.w3.org/2000/svg">
        <style>{ESTILO}</style>
        {ZONAS.map((z) => (
          // un enlace de SVG: next/link no vive dentro de un <svg>
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a key={z.clave} href={z.href} className="nv-zona" aria-label={z.nombre}>
            {z.formas.map((f, i) => <polygon key={i} points={f} />)}
          </a>
        ))}
      </svg>
    </div>
  )
}
