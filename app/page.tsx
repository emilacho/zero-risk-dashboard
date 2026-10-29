import Link from "next/link"
import { redirect } from "next/navigation"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { leerInicio, type Bloque } from "@/lib/inicio-datos"
import { TOPE_DIARIO_USD, cuando, porcentajeDelTope } from "@/lib/inicio"
import { usd, type Semaforo } from "@/lib/oficinas"
import { ChatConCowork } from "@/components/inicio/ChatConCowork"

export const dynamic = "force-dynamic"
export const metadata = { title: "Inicio" }

const LUZ: Record<Semaforo, string> = { verde: "bg-emerald-400", ambar: "bg-amber-400", rojo: "bg-rose-500", gris: "bg-zinc-500" }

function Titulo({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-[hsl(var(--muted-foreground))]">{children}</h2>
}
function NoSePudoLeer({ b }: { b: Extract<Bloque<unknown>, { ok: false }> }) {
  return <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-[13px] text-rose-200">No pude leer esto: {b.error}</p>
}

export default async function InicioPage() {
  const puerta = await exigirAdmin()
  if (!puerta.ok) redirect(puerta.status === 401 ? "/login?next=%2F" : "/login?error=forbidden")
  const ahora = new Date()
  const d = await leerInicio(getServiceRoleClient(), ahora)
  return (
    <main className="mx-auto max-w-[1100px] px-6 pb-16 pl-24 pt-10">
      <h1 className="font-display text-[34px] font-semibold leading-tight tracking-tight">Inicio</h1>

      <section className="mt-6">
        <Titulo>Te necesitan</Titulo>
        {!d.te_necesitan.ok ? <NoSePudoLeer b={d.te_necesitan} /> : d.te_necesitan.valor.length === 0 ? (
          <p className="surface-card p-5 text-[15px]">Todo al día.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {d.te_necesitan.valor.map((p) => (
              <Link key={p.clave} href={p.href} className="surface-card block p-5 transition-colors hover:bg-white/[0.04]">
                <span className="num block text-[44px] font-semibold leading-none">{p.cuantos}</span>
                <span className="mt-2 block text-[14px]">{p.titulo}</span>
                {p.nota && <span className="mt-1 block text-[11px] text-[hsl(var(--muted-foreground))]">{p.nota}</span>}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <Titulo>Estado del sistema</Titulo>
        {!d.estado.ok ? <NoSePudoLeer b={d.estado} /> : (
          <Link href={d.estado.valor.href} className="surface-card flex items-center gap-3 p-4 text-[15px] hover:bg-white/[0.04]">
            <span className={`h-3 w-3 rounded-full ${LUZ[d.estado.valor.semaforo]}`} />
            {d.estado.valor.texto}
          </Link>
        )}
      </section>

      <section className="mt-8">
        <Titulo>Esta semana</Titulo>
        {!d.cifras.ok ? <NoSePudoLeer b={d.cifras} /> : (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="surface-card p-5">
              <span className="num block text-[34px] font-semibold leading-none">{d.cifras.valor.piezas_semana}</span>
              <span className="mt-2 block text-[13px]">piezas entregadas (7 días)</span>
            </div>
            <Link href="/gasto" className="surface-card block p-5 hover:bg-white/[0.04]">
              <span className="num block text-[34px] font-semibold leading-none">{usd(d.cifras.valor.gasto_mes)}</span>
              <span className="mt-2 block text-[13px]">gasto de {d.cifras.valor.mes}</span>
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/10"><span className="block h-full bg-[hsl(var(--primary))]" style={{ width: `${porcentajeDelTope(d.cifras.valor.gasto_hoy)}%` }} /></span>
              <span className="mt-1 block text-[11px] text-[hsl(var(--muted-foreground))]">hoy {usd(d.cifras.valor.gasto_hoy)} de {usd(TOPE_DIARIO_USD)} de tope diario</span>
            </Link>
            <Link href="/clientes" className="surface-card block p-5 hover:bg-white/[0.04]">
              <span className="num block text-[34px] font-semibold leading-none">{d.cifras.valor.clientes_activos}</span>
              <span className="mt-2 block text-[13px]">clientes en servicio</span>
            </Link>
          </div>
        )}
      </section>

      <section className="mt-8">
        <Titulo>Oficinas</Titulo>
        {!d.oficinas.ok ? <NoSePudoLeer b={d.oficinas} /> : (
          <ul className="surface-card divide-y divide-white/5">
            {d.oficinas.valor.map((o) => (
              <li key={o.clave}>
                <Link href={`/oficinas#${o.clave}`} className="flex items-center gap-3 px-4 py-3 text-[13px] hover:bg-white/[0.03]">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${LUZ[o.semaforo]}`} />
                  <span className="w-40 shrink-0 font-medium">{o.nombre}</span>
                  <span className="text-[hsl(var(--muted-foreground))]">{o.estado_texto}</span>
                  <span className="ml-auto text-[11px] text-[hsl(var(--muted-foreground))]">{o.ultima_actividad ? cuando(o.ultima_actividad, ahora) : "sin actividad registrada"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <Titulo>Lo último que pasó</Titulo>
        {!d.hechos.ok ? <NoSePudoLeer b={d.hechos} /> : d.hechos.valor.length === 0 ? (
          <p className="text-[13px] text-[hsl(var(--muted-foreground))]">Todavía no hay hechos para mostrar.</p>
        ) : (
          <ul className="surface-card divide-y divide-white/5">
            {d.hechos.valor.map((h, i) => (
              <li key={i} className="flex items-baseline gap-3 px-4 py-2.5 text-[13px]">
                <span className="w-24 shrink-0 text-[11px] text-[hsl(var(--muted-foreground))]">{cuando(h.cuando, ahora)}</span>
                {h.href ? <Link href={h.href} className="hover:underline">{h.texto}</Link> : <span>{h.texto}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8">
        <ChatConCowork sinRespuesta={d.mensajes_sin_respuesta.ok ? d.mensajes_sin_respuesta.valor : null} />
      </div>
    </main>
  )
}
