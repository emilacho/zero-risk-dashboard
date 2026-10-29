import Link from "next/link"
import { redirect } from "next/navigation"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { listarClientes } from "@/lib/clientes-datos"
import { etiquetaDelCliente, type ResumenDeCliente } from "@/lib/clientes"
import { estadoDeCampanaLegible } from "@/lib/lenguaje"
import { usdES as usd } from "@/lib/lenguaje"

export const dynamic = "force-dynamic"
export const metadata = { title: "Clientes" }

export default async function ClientesPage() {
  const puerta = await exigirAdmin()
  if (!puerta.ok) redirect(puerta.status === 401 ? "/login?next=%2Fclientes" : "/login?error=forbidden")
  let error: string | null = null
  let clientes: ResumenDeCliente[] = []
  try {
    clientes = await listarClientes(getServiceRoleClient())
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }
  return (
    <main data-seccion="clientes" className="mx-auto max-w-[1200px] px-6 pb-16 pl-24 pt-10">
      <h1 className="font-display text-[34px] font-semibold leading-tight tracking-tight">Clientes</h1>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Una ficha por cliente: sus piezas, su plan, su gasto, su cerebro y su manual. El gasto es el mismo de la pantalla Gasto, de los últimos 30 días.</p>
      {error && <p className="mt-6 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-[13px] text-rose-200">No pude leer los clientes: {error}</p>}
      <div className="surface-card mt-6">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-white/[0.03] text-[11px] uppercase tracking-[0.06em] text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2 text-right">Piezas por aprobar</th>
              <th className="px-4 py-2 text-right">Gasto 30 d</th>
              <th className="px-4 py-2 text-right">Fichas del cerebro</th>
              <th className="px-4 py-2">Campaña</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                <td className="px-4 py-2.5">
                  <Link href={`/clientes/${c.id}`} className="font-medium hover:underline">{c.nombre}</Link>
                  {c.rubro && <span className="block text-[11px] text-[hsl(var(--muted-foreground))]">{c.rubro}</span>}
                </td>
                <td className="px-4 py-2.5">{etiquetaDelCliente(c.estado)}</td>
                <td className={`num px-4 py-2.5 text-right ${c.piezas_por_aprobar > 0 ? "text-amber-300" : ""}`}>{c.piezas_por_aprobar}</td>
                <td className="num px-4 py-2.5 text-right">{usd(c.gasto_30d)}</td>
                <td className="num px-4 py-2.5 text-right">{c.trozos_del_cerebro}</td>
                <td className="px-4 py-2.5">{c.campana ? estadoDeCampanaLegible(c.campana) : "sin campaña"}</td>
              </tr>
            ))}
            {clientes.length === 0 && !error && (
              <tr><td colSpan={6} className="px-4 py-6 text-[hsl(var(--muted-foreground))]">No hay clientes activos.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
