import { redirect } from "next/navigation"
import { exigirAdmin } from "@/lib/admin-guard"
import { PantallaNuevo } from "@/components/nuevo/PantallaNuevo"

export const metadata = { title: "Nuevo" }

/** DASHBOARD NUEVO · la escena como primer plano, con el marco de la referencia. Nada más en la página. */
export default async function NuevoPage() {
  const puerta = await exigirAdmin()
  if (!puerta.ok) redirect(puerta.status === 401 ? "/login?next=%2Fnuevo" : "/login?error=forbidden")
  return <PantallaNuevo />
}
