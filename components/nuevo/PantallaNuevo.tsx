import { CapaNueva } from "@/components/nuevo/CapaNueva"
import { EscenaViva } from "@/components/nuevo/EscenaViva"
import { BarraDeChat, BarraSuperior, MenuLateral } from "@/components/nuevo/MarcoNuevo"

/**
 * La pantalla completa del dashboard nuevo: marco (barra superior, riel, chat) + la escena. `marketing` la abre ya con el departamento proyectado
 * (para quien entra directo a /nuevo/marketing o recarga). Cubre toda la ventana (incluido el menú del dashboard actual, que no se toca).
 */
export function PantallaNuevo({ marketing = false }: { marketing?: boolean }) {
  return (
    <CapaNueva>
      <main data-seccion="nuevo" className="fixed inset-0 z-[60] overflow-hidden bg-[#141414]">
        <h1 className="sr-only">Zero Risk · las oficinas</h1>
        <BarraSuperior />
        <MenuLateral />
        <div className="absolute inset-x-0 bottom-40 top-14 flex items-center justify-center px-4 sm:px-16">
          <EscenaViva inicial={marketing} />
        </div>
        <BarraDeChat />
      </main>
    </CapaNueva>
  )
}
