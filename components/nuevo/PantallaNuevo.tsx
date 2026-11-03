import { preload } from "react-dom"
import { CapaNueva } from "@/components/nuevo/CapaNueva"
import { EscenaViva } from "@/components/nuevo/EscenaViva"
import { PanelCliente } from "@/components/nuevo/PanelCliente"
import { BarraDeChat, BarraSuperior, MenuLateral } from "@/components/nuevo/MarcoNuevo"

/**
 * La pantalla completa del dashboard nuevo: marco (barra superior, riel, chat) + la escena. `marketing` la abre ya con el departamento proyectado
 * (para quien entra directo a /nuevo/marketing o recarga); `oficina` (6.12) igual con tu oficina (/nuevo/oficina). Cubre toda la ventana (incluido el menú del dashboard actual, que no se toca).
 * 5.8 (31-oct): el fondo es NEGRO puro, igual que las esquinas de las fotos (0-2 de 255), para que no se vean los bordes de las imágenes.
 */
/** 6.42 · `cliente` (slug) abre encima la vista financiera de ese cliente (/nuevo/cliente/<cliente>) */
export function PantallaNuevo({ marketing = false, cerebro = false, oficina = false, cliente }: { marketing?: boolean; cerebro?: boolean; oficina?: boolean; cliente?: string }) {
  // 01-nov · carga lenta: la pantalla se pinta en el navegador (CapaNueva), así que las fotos no estaban en el HTML y se pedían DESPUÉS de bajar y arrancar todo el JavaScript.
  // Con estas pistas van en la cabecera del HTML y se bajan a la vez que el JavaScript (la del departamento primero si se entra directo a él).
  const depto = marketing ? "marketing" : oficina ? "oficina" : null
  if (depto) preload(`/nuevo/${depto}-2560.webp`, { as: "image", imageSrcSet: `/nuevo/${depto}-1280.webp 1280w, /nuevo/${depto}-2560.webp 2560w`, imageSizes: "(max-width: 900px) 100vw, 1800px", fetchPriority: "high" })
  preload("/nuevo/escena-2560.webp", { as: "image", imageSrcSet: "/nuevo/escena-1280.webp 1280w, /nuevo/escena-2560.webp 2560w", imageSizes: "(max-width: 900px) 100vw, 1400px", fetchPriority: depto ? "low" : "high" })
  return (
    <>
    {/* el marcador va en el HTML del servidor (la pantalla de verdad se pinta en el navegador): se ve mientras bajan el JavaScript y las fotos, y la pantalla lo tapa al aparecer */}
    {/* 03-nov · nunca negro: la foto de la escena (la misma que ya se está bajando, 28–111 kB) y el esqueleto del marco aparecen con el primer HTML; la pantalla de verdad los tapa al llegar */}
    <div data-cargando aria-hidden className="pointer-events-none fixed inset-0 z-[59] bg-black">
      <div data-esqueleto-barra className="absolute inset-x-0 top-0 flex h-14 items-center gap-3 border-b border-white/5 px-4"><span className="h-3 w-24 animate-pulse rounded bg-white/10" /><span className="h-3 w-16 animate-pulse rounded bg-white/5" /><span className="h-3 w-16 animate-pulse rounded bg-white/5" /></div>
      <div className="absolute inset-x-0 bottom-40 top-14 flex items-center justify-center px-4 sm:px-16">
        <img data-foto-de-carga alt="" src={`/nuevo/${depto ?? "escena"}-1280.webp`} srcSet={`/nuevo/${depto ?? "escena"}-1280.webp 1280w, /nuevo/${depto ?? "escena"}-2560.webp 2560w`} sizes="(max-width: 900px) 100vw, 1800px" fetchPriority="high" className="max-h-full max-w-full object-contain opacity-80" />
      </div>
      <div data-esqueleto-chat className="absolute inset-x-0 bottom-0 flex h-40 items-end justify-center px-4 pb-6"><p className="animate-pulse text-[12px] uppercase tracking-[0.3em] text-zinc-500">Preparando la oficina…</p></div>
    </div>
    <CapaNueva>
      <main data-seccion="nuevo" className="fixed inset-0 z-[60] overflow-hidden bg-black">
        <h1 className="sr-only">Zero Risk · las oficinas</h1>
        <BarraSuperior />
        <MenuLateral />
        <div className="absolute inset-x-0 bottom-40 top-14 flex items-center justify-center px-4 sm:px-16">
          <EscenaViva inicial={marketing ? "marketing" : oficina ? "oficina" : false} cerebroInicial={cerebro} />
        </div>
        {cliente && <PanelCliente slug={cliente} />}
        <BarraDeChat />
      </main>
    </CapaNueva>
    </>
  )
}
