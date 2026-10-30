import { redirect } from "next/navigation"
import { exigirAdmin } from "@/lib/admin-guard"
import { CapaNueva } from "@/components/nuevo/CapaNueva"
import { EscenaNuevo } from "@/components/nuevo/EscenaNuevo"
import { BarraDeChat, BarraSuperior, MenuLateral } from "@/components/nuevo/MarcoNuevo"

export const metadata = { title: "Nuevo" }

/**
 * DASHBOARD NUEVO · SPRINT 1 (30-oct): la escena como primer plano, con el marco de la referencia (barra superior, menú lateral, chat).
 * Cubre toda la ventana (incluido el menú del dashboard actual, que no se toca). Nada más en la página.
 */
export default async function NuevoPage() {
  const puerta = await exigirAdmin()
  if (!puerta.ok) redirect(puerta.status === 401 ? "/login?next=%2Fnuevo" : "/login?error=forbidden")
  return (
    <CapaNueva>
      <main data-seccion="nuevo" className="fixed inset-0 z-[60] overflow-hidden bg-[#141414]">
        <h1 className="sr-only">Zero Risk · las oficinas</h1>
        <BarraSuperior />
        <MenuLateral />
        <div className="absolute inset-x-0 bottom-40 top-14 flex items-center justify-center px-4 sm:px-16">
          <EscenaNuevo />
        </div>
        <BarraDeChat />
      </main>
    </CapaNueva>
  )
}
