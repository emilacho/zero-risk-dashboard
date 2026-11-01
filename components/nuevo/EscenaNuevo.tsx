/**
 * DASHBOARD NUEVO · la escena (variante-14, recortada y en versión liviana) con DOS zonas clicables y nada más (firma de Emilio, 30-oct).
 * Sprint 5 (31-oct, CC5): la escena un 30 % más grande (75 % del ancho en vez de 58 %) y con la capa de vida de Spline encima de la foto (`fondo`).
 *  · el monolito central → `oficina`: 6.12 (Emilio, 1-nov: «el monolito central va a ser la oficina del humano; al darle clic, igual que el Dept. Marketing, se expande
 *    la oficina») se expande como el departamento (/nuevo/oficina) con la imagen del centro de comando. Entre 6.9 y 6.12 abría el explorador del Cerebro directo
 *    (/nuevo/cerebro); el Cerebro tendrá su PROPIA estructura en la sala (Emilio, 1-nov); mientras, queda su dirección directa /nuevo/cerebro.
 *  · la plataforma de las pantallas y el proyector → «Dept. Marketing» (/nuevo/marketing; sprint 3, 31-oct). Se ilumina en ámbar poco a poco y aparece su rótulo.
 * Las demás plataformas no tienen enlace ni resaltado: se irán activando una por una. El SVG de encima usa las mismas coordenadas de la imagen (ver VISTA).
 */
import type { ReactNode } from "react"
export const VISTA = { x: 150, y: 40, w: 1700, h: 920 } // el recorte de la variante-14 (en las coordenadas de 2000×1125 en que se midieron las zonas)

interface Zona { clave: string; nombre: string; href: string; formas: string[]; superficie?: string; rotulo?: { x: number; y: number; texto: string } }

/**
 * 5.4 (Emilio, 31-oct: «no hiciste que se ilumine la estructura entera»): la versión ENCENDIDA de una plataforma no se pinta en el navegador;
 * la generó el mismo generador de la foto (edición de la foto original sin máscara, «cambia solo la luz de esa plataforma»), y aquí se guarda
 * solo el recorte de esa zona con borde difuminado (alfa) en `public/nuevo/`. Al pasar el ratón, el recorte aparece encima de la foto en su
 * lugar exacto (caja en píxeles de la foto 2560×1385) y la estructura entera se ve iluminada: losa, lados, borde, objetos y el derrame al piso.
 * Fuera de la caja la foto no cambia. Medido: desplazamiento 0,2 px entre la foto y la versión encendida.
 */
export const ENCENDIDOS: { zona: string; src: string; caja: { x: number; y: number; w: number; h: number } }[] = [
  { zona: "marketing", src: "/nuevo/marketing-encendido.webp", caja: { x: 1454, y: 195, w: 600, h: 507 } },
]
const FOTO = { w: 2560, h: 1385 }
const pct = (v: number, total: number) => `${((v / total) * 100).toFixed(4)}%`

export const ZONAS: Zona[] = [
  {
    clave: "oficina", nombre: "Tu oficina", href: "/nuevo/oficina",
    formas: ["936,352 1010,306 1084,338 1084,507 1010,552 936,517"],
    superficie: "936,352 1010,306 1084,338 1084,507 1010,552 936,517", // el monolito mismo
    rotulo: { x: 1010, y: 284, texto: "TU OFICINA" },
  },
  {
    clave: "marketing", nombre: "Dept. Marketing", href: "/nuevo/marketing",
    formas: ["1160,358 1226,250 1316,214 1404,240 1468,338 1470,374 1310,462"], // la plataforma de arriba a la derecha con el proyector y su pantalla (zona del ratón)
    // sin `superficie` pintada: su versión encendida es una imagen real (ENCENDIDOS · 5.4)
    rotulo: { x: 1316, y: 188, texto: "DEPT. MARKETING" },
  },
]

/** de dónde sale la proyección del departamento (el centro de su plataforma, en % de la escena) */
export const ORIGEN_MARKETING = { x: ((1316 - VISTA.x) / VISTA.w) * 100, y: ((350 - VISTA.y) / VISTA.h) * 100 }

const ESTILO_ESCENA = `
.nv-escena{width:min(100%,75vw,calc((100dvh - 15rem) * 3264 / 1766));background:#000;-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 8%,#000 92%,transparent 100%);mask-image:linear-gradient(to bottom,transparent 0,#000 8%,#000 92%,transparent 100%)}
.nv-encendido{opacity:0;transition:opacity .45s ease}
.nv-escena:has(.nv-zona[data-zona="marketing"]:hover) .nv-encendido[data-encendido="marketing"],.nv-escena:has(.nv-zona[data-zona="marketing"]:focus-visible) .nv-encendido[data-encendido="marketing"]{opacity:1}
@media (prefers-reduced-motion:reduce){.nv-encendido{transition:none}}
@media (max-width:900px){.nv-escena{width:min(100%,calc((100dvh - 15rem) * 3264 / 1766))}}
`

/* 5.3 (Emilio, 31-oct): al pasar el ratón NO hay campo naranja ni línea dura alrededor; lo único que se ilumina es la SUPERFICIE de la plataforma
   (`superficie`), con una luz suave recortada a esa cara (clipPath + desenfoque hacia adentro) que se funde con la foto (mix-blend-mode: screen).
   Las `formas` siguen siendo la zona del ratón, invisibles. */
const ESTILO = `
.nv-zona{cursor:pointer;outline:none}
.nv-zona polygon{fill:rgba(255,140,40,0);stroke:none;transition:fill .45s ease}
.nv-zona polygon.nv-luz{fill:url(#nv-luz-grad);opacity:0;mix-blend-mode:screen;pointer-events:none;transition:opacity .45s ease}
.nv-zona:hover polygon.nv-luz,.nv-zona:focus-visible polygon.nv-luz{opacity:1}
.nv-rotulo{opacity:0;transform:translateY(5px);transition:opacity .45s ease,transform .45s ease;pointer-events:none}
.nv-zona:hover .nv-rotulo,.nv-zona:focus-visible .nv-rotulo{opacity:1;transform:translateY(0)}
@media (prefers-reduced-motion:reduce){.nv-zona polygon,.nv-rotulo{transition:none}}
`

/** `fondo` va ENTRE la foto y las zonas clicables (la capa de vida de Spline, sprint 5): nunca tapa el hover ni los clics */
export function EscenaNuevo({ alAbrirMarketing, alAbrirOficina, fondo, children }: { alAbrirMarketing?: () => void; alAbrirOficina?: () => void; fondo?: ReactNode; children?: ReactNode }) {
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
        {ENCENDIDOS.map((e) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={e.zona} src={e.src} alt="" aria-hidden="true" data-encendido={e.zona} decoding="async" draggable={false}
            className="nv-encendido pointer-events-none absolute select-none [transform:translateZ(0)]"
            style={{ left: pct(e.caja.x, FOTO.w), top: pct(e.caja.y, FOTO.h), width: pct(e.caja.w, FOTO.w), height: pct(e.caja.h, FOTO.h) }} />
        ))}
        {fondo}
        <svg viewBox={`${VISTA.x} ${VISTA.y} ${VISTA.w} ${VISTA.h}`} className="absolute inset-0 h-full w-full" role="group" aria-label="Zonas de la escena" xmlns="http://www.w3.org/2000/svg">
          <style>{ESTILO}</style>
          <defs>
            <radialGradient id="nv-luz-grad" cx="50%" cy="50%" r="62%">
              <stop offset="0%" stopColor="rgba(255,178,86,0.6)" /><stop offset="55%" stopColor="rgba(255,152,52,0.32)" /><stop offset="100%" stopColor="rgba(255,140,40,0.1)" />
            </radialGradient>
            <filter id="nv-luz-suave" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="6" /></filter>
            {ZONAS.filter((z) => z.superficie).map((z) => <clipPath key={z.clave} id={`nv-sup-${z.clave}`}><polygon points={z.superficie} /></clipPath>)}
          </defs>
          {ZONAS.map((z) => {
            const abrir = z.clave === "marketing" ? alAbrirMarketing : z.clave === "oficina" ? alAbrirOficina : undefined
            return (
            // un enlace de SVG: next/link no vive dentro de un <svg>
            // eslint-disable-next-line @next/next/no-html-link-for-pages
            <a key={z.clave} href={z.href} className="nv-zona" data-zona={z.clave} aria-label={z.nombre}
              onClick={abrir ? (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); abrir() } : undefined}>
              {z.formas.map((f, i) => <polygon key={i} points={f} />)}
              {z.superficie && <g clipPath={`url(#nv-sup-${z.clave})`}><polygon className="nv-luz" points={z.superficie} filter="url(#nv-luz-suave)" /></g>}
              {z.rotulo && (
                // 5.5 (Emilio, 31-oct): el rótulo con las MISMAS letras que la marca «ZERO RISK» de la barra: mayúsculas, contorno ámbar sin relleno,
                // peso 500, mismo espaciado proporcional (3,4/16 em) y mismo grosor de trazo proporcional (0,9/16 em)
                <text className="nv-rotulo" x={z.rotulo.x} y={z.rotulo.y} textAnchor="middle" fill="none" stroke="#e8731a" strokeWidth={26 * 0.9 / 16} fontSize="26" fontWeight="500"
                  letterSpacing={26 * 3.4 / 16} fontFamily="system-ui, Arial, sans-serif">{z.rotulo.texto}</text>
              )}
            </a>
            )
          })}
        </svg>
        {children}
      </div>
    </>
  )
}
