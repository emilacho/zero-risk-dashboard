import { redirect } from "next/navigation"
import { exigirAdmin } from "@/lib/admin-guard"
import { PantallaNuevo } from "@/components/nuevo/PantallaNuevo"

export const metadata = { title: "Cliente" }

/** DASHBOARD NUEVO · SPRINT 6.42: la vista financiera de UN cliente, en su propia página (se puede abrir en otra pestaña). */
export default async function NuevoClientePage({ params }: { params: Promise<{ cliente: string }> }) {
  const { cliente } = await params
  const puerta = await exigirAdmin()
  if (!puerta.ok) redirect(puerta.status === 401 ? `/login?next=${encodeURIComponent(`/nuevo/cliente/${cliente}`)}` : "/login?error=forbidden")
  return <PantallaNuevo cliente={cliente} />
}
