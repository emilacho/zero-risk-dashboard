import { redirect } from "next/navigation"
import { exigirAdmin } from "@/lib/admin-guard"
import { PantallaNuevo } from "@/components/nuevo/PantallaNuevo"

export const metadata = { title: "Cerebro" }

/** DASHBOARD NUEVO · SPRINT 6.9: la misma pantalla con el Cerebro ya abierto sobre la sala principal (entrada directa o recarga). */
export default async function NuevoCerebroPage() {
  const puerta = await exigirAdmin()
  if (!puerta.ok) redirect(puerta.status === 401 ? "/login?next=%2Fnuevo%2Fcerebro" : "/login?error=forbidden")
  return <PantallaNuevo cerebro />
}
