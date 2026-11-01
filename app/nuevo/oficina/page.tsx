import { redirect } from "next/navigation"
import { exigirAdmin } from "@/lib/admin-guard"
import { PantallaNuevo } from "@/components/nuevo/PantallaNuevo"

export const metadata = { title: "Tu oficina" }

/** DASHBOARD NUEVO · SPRINT 6.12: la misma pantalla con TU OFICINA (el centro de comando) ya proyectada desde el monolito (entrada directa o recarga). */
export default async function NuevoOficinaPage() {
  const puerta = await exigirAdmin()
  if (!puerta.ok) redirect(puerta.status === 401 ? "/login?next=%2Fnuevo%2Foficina" : "/login?error=forbidden")
  return <PantallaNuevo oficina />
}
