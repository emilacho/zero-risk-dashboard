import { CapaNueva } from "@/components/nuevo/CapaNueva"
import { EscenaViva } from "@/components/nuevo/EscenaViva"
import { BarraDeChat, BarraSuperior, MenuLateral } from "@/components/nuevo/MarcoNuevo"

/**
 * La pantalla completa del dashboard nuevo: marco (barra superior, riel, chat) + la escena. `marketing` la abre ya con el departamento proyectado
 * (para quien entra directo a /nuevo/marketing o recarga). Cubre toda la ventana (incluido el menú del dashboard actual, que no se toca).
 * 5.8 (31-oct): el fondo es NEGRO puro, igual que las esquinas de las fotos (0-2 de 255), para que no se vean los bordes de las imágenes.
 */
export function PantallaNuevo({ marketing = false, cerebro = false }: { marketing?: boolean; cerebro?: boolean }) {
  return (
    <CapaNueva>
      <main data-seccion="nuevo" className="fixed inset-0 z-[60] overflow-hidden bg-black">
        <h1 className="sr-only">Zero Risk · las oficinas</h1>
        <BarraSuperior />
        <MenuLateral />
        <div className="absolute inset-x-0 bottom-40 top-14 flex items-center justify-center px-4 sm:px-16">
          <EscenaViva inicial={marketing} cerebroInicial={cerebro} />
        </div>
        <BarraDeChat />
      </main>
    </CapaNueva>
  )
}
