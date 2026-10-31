import { redirect } from "next/navigation"
import { exigirAdmin } from "@/lib/admin-guard"
import { PantallaNuevo } from "@/components/nuevo/PantallaNuevo"

export const metadata = { title: "Dept. Marketing" }

/** DASHBOARD NUEVO · SPRINT 3: la misma pantalla con el departamento de marketing ya proyectado (entrada directa o recarga). */
export default async function NuevoMarketingPage() {
  const puerta = await exigirAdmin()
  if (!puerta.ok) redirect(puerta.status === 401 ? "/login?next=%2Fnuevo%2Fmarketing" : "/login?error=forbidden")
  return <PantallaNuevo marketing />
}
