import { redirect } from "next/navigation"
import { exigirAdmin } from "@/lib/admin-guard"
import { MapaIsometrico } from "@/components/nuevo/MapaIsometrico"

export const metadata = { title: "Nuevo" }

/** DASHBOARD NUEVO · PASO 1: solo el primer plano con las oficinas. Nada más en la página. */
export default async function NuevoPage() {
  const puerta = await exigirAdmin()
  if (!puerta.ok) redirect(puerta.status === 401 ? "/login?next=%2Fnuevo" : "/login?error=forbidden")
  return (
    <main data-seccion="nuevo" className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_50%_45%,#1d1d21_0%,#0c0c0e_70%)] py-8 pl-[68px] pr-2 sm:px-8 sm:pl-24">
      <h1 className="sr-only">Zero Risk · las oficinas</h1>
      <MapaIsometrico />
    </main>
  )
}
