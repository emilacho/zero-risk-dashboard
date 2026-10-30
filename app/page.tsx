import Link from "next/link"
import { redirect } from "next/navigation"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { leerInicio, type Bloque } from "@/lib/inicio-datos"
import { cuando } from "@/lib/inicio"
import { usd, type Semaforo } from "@/lib/oficinas"
import { TrabajoEnVivo } from "@/components/inicio/TrabajoEnVivo"
import { ActividadChart } from "@/components/inicio/ActividadChart"
import { Barras, Tendencia } from "@/components/inicio/MiniGrafica"

export const dynamic = "force-dynamic"
export const metadata = { title: "Inicio" }

const LUZ: Record<Semaforo, string> = { verde: "bg-emerald-400", ambar: "bg-amber-400", rojo: "bg-rose-500", gris: "bg-zinc-500" }

function Titulo({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-[12px] font-medium uppercase tracking-[0.08em] text-[hsl(var(--muted-foreground))]">{children}</h2>
}
function NoSePudoLeer({ b }: { b: Extract<Bloque<unknown>, { ok: false }> }) {
  return <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-[13px] text-rose-200">No pude leer esto: {b.error}</p>
}

/**
 * INICIO con el diseño del tablero de Paperclip (MIT · ver THIRD_PARTY.md), adaptado a los datos y nombres de Zero Risk.
 * Orden de Paperclip: empleados en vivo → aviso → cuatro cifras → tres gráficas → dos listas.
 * Nada inventado: cada bloque sale de una lectura que ya existía; lo que Paperclip tiene y nosotros no, no se agrega.
 */
export default async function InicioPage() {
  const puerta = await exigirAdmin()
  if (!puerta.ok) redirect(puerta.status === 401 ? "/login?next=%2F" : "/login?error=forbidden")
  const ahora = new Date()
  const d = await leerInicio(getServiceRoleClient(), ahora)
  const ofi = d.oficinas.ok ? d.oficinas.valor : []
  const alDia = ofi.filter((o) => o.semaforo === "verde").length
  const conAviso = ofi.filter((o) => o.semaforo === "ambar" || o.semaforo === "rojo").length
  const apagadas = ofi.filter((o) => o.semaforo === "gris").length
  const pendientes = d.te_necesitan.ok ? d.te_necesitan.valor.reduce((n, p) => n + p.cuantos, 0) : null
  const estado = d.estado.ok ? d.estado.valor : null
  return (
    <main data-seccion="inicio" className="mx-auto max-w-[1180px] px-6 pb-16 pl-24 pt-8">
      <h1 className="font-display text-[13px] font-medium uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">Inicio</h1>

      {/* 1 · EMPLEADOS · lo que están haciendo ahora (Paperclip: Agents) */}
      <section className="mt-5">
        <Titulo>Empleados · lo que están haciendo ahora</Titulo>
        {!d.trabajo.ok ? <NoSePudoLeer b={d.trabajo} /> : <TrabajoEnVivo inicial={d.trabajo.valor} />}
      </section>

      {/* 2 · AVISO · solo si algo no está bien (Paperclip: budget incidents) */}
      {estado && estado.semaforo !== "verde" && (
        <Link href={estado.href} data-hue={estado.semaforo === "rojo" ? "rose" : estado.semaforo === "ambar" ? "amber" : "violet"} className="surface-card mt-6 flex items-center gap-3 px-4 py-3 text-[14px]">
          <span className={`h-2.5 w-2.5 rounded-full ${LUZ[estado.semaforo]}`} />
          <span className="flex-1">{estado.texto}</span>
          <span className="text-[12px] underline underline-offset-2">Ver</span>
        </Link>
      )}

      {/* 3 · CUATRO CIFRAS (Paperclip: Agents Enabled · Tasks In Progress · Month Spend · Pending Approvals) */}
      <section className="mt-8 grid grid-cols-2 gap-2 xl:grid-cols-4">
        <Link href="/clientes" data-hue="sky" className="surface-card block p-5">
          <span className="num cifra-seccion block text-[34px] font-semibold leading-none">{d.cifras.ok ? d.cifras.valor.clientes_activos : "–"}</span>
          <span className="mt-2 block text-[13px] font-medium">Clientes en servicio</span>
          <span className="mt-1 block text-[11px] text-[hsl(var(--muted-foreground))]">las fichas de práctica no cuentan</span>
        </Link>
        <Link href="/oficinas" data-hue="violet" className="surface-card block p-5">
          <span className="num cifra-seccion block text-[34px] font-semibold leading-none">{alDia}<span className="text-[18px] text-[hsl(var(--muted-foreground))]"> de {ofi.length}</span></span>
          <span className="mt-2 block text-[13px] font-medium">Oficinas al día</span>
          <span className="mt-1 block text-[11px] text-[hsl(var(--muted-foreground))]">{conAviso} con aviso · {apagadas} apagadas</span>
        </Link>
        <Link href="/gasto" data-hue="lime" className="surface-card block p-5">
          <span className="num cifra-seccion block text-[34px] font-semibold leading-none">{d.cifras.ok ? usd(d.cifras.valor.gasto_mes) : "–"}</span>
          <span className="mt-2 block text-[13px] font-medium">Gasto de {d.cifras.ok ? d.cifras.valor.mes : "este mes"}</span>
          <span className="mt-1 block text-[11px] text-[hsl(var(--muted-foreground))]">hoy {d.cifras.ok ? usd(d.cifras.valor.gasto_hoy) : "–"}</span>
        </Link>
        <Link href={d.te_necesitan.ok && d.te_necesitan.valor[0] ? d.te_necesitan.valor[0].href : "/piezas"} data-hue="amber" className="surface-card block p-5">
          <span className="num cifra-seccion block text-[34px] font-semibold leading-none">{pendientes ?? "–"}</span>
          <span className="mt-2 block text-[13px] font-medium">Te necesitan</span>
          <span className="mt-1 block text-[11px] text-[hsl(var(--muted-foreground))]">piezas, revisiones y preguntas por responder</span>
        </Link>
      </section>

      {/* 3b · lo que hay por aprobar, con su dibujo (la bandeja) */}
      {d.te_necesitan.ok && d.te_necesitan.valor.length > 0 && (
        <section className="mt-3">
          <div className="grid gap-3 sm:grid-cols-3">
            {d.te_necesitan.valor.map((p) => (
              <Link key={p.clave} href={p.href} data-hue={p.clave === "piezas" ? "amber" : p.clave === "preguntas" ? "rose" : "violet"} className="surface-card flex items-baseline gap-3 px-4 py-3">
                <span className="num cifra-seccion text-[26px] font-semibold leading-none">{p.cuantos}</span>
                <span className="text-[13px]">{p.titulo}</span>
              </Link>
            ))}
          </div>
          {d.miniaturas.ok && d.miniaturas.valor.length > 0 && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {d.miniaturas.valor.map((m) => (
                <Link key={m.id} href={`/piezas?id=${m.id}`} data-hue="amber" className="surface-card flex items-center gap-3 p-3">
                  {m.tiene_dibujo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/piezas/${m.id}/lamina/1`} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-md border border-white/10 object-cover" />
                  ) : (
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-white/10 text-[10px] text-[hsl(var(--muted-foreground))]">sin dibujo</span>
                  )}
                  <span className="min-w-0 text-[12px] leading-snug">{m.titulo}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 4 · TRES GRÁFICAS (Paperclip: Run Activity · Tasks by Status · Success Rate) */}
      <section className="mt-8 grid gap-4 lg:grid-cols-3">
        <div data-hue="emerald" className="surface-card p-4">
          <h3 className="text-[12px] font-medium">Actividad de los empleados</h3>
          <p className="mb-3 text-[10px] text-[hsl(var(--muted-foreground))]">Últimos 14 días</p>
          {!d.actividad.ok ? <NoSePudoLeer b={d.actividad} /> : <ActividadChart dias={d.actividad.valor} />}
        </div>
        <div data-hue="teal" className="surface-card p-4">
          <h3 className="text-[12px] font-medium">Piezas entregadas</h3>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Últimas 6 semanas{d.cifras.ok ? ` · ${d.cifras.valor.piezas_semana} esta semana` : ""}</p>
          {!d.cifras.ok ? <NoSePudoLeer b={d.cifras} /> : <Barras etiqueta="Piezas entregadas por semana, últimas 6 semanas" items={d.cifras.valor.semanas.map((x) => ({ etiqueta: "semana del " + x.etiqueta, valor: x.piezas }))} />}
        </div>
        <Link href="/gasto" data-hue="lime" className="surface-card block p-4">
          <h3 className="text-[12px] font-medium">Gasto diario</h3>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Últimos 30 días</p>
          {!d.cifras.ok ? <NoSePudoLeer b={d.cifras} /> : <Tendencia etiqueta="Gasto diario de los últimos 30 días" valores={d.cifras.valor.gasto_30d} />}
        </Link>
      </section>

      {/* 5 · DOS LISTAS (Paperclip: Recent Activity · Recent Tasks) */}
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <Titulo>Lo último que pasó</Titulo>
          {!d.hechos.ok ? <NoSePudoLeer b={d.hechos} /> : d.hechos.valor.length === 0 ? (
            <p className="text-[13px] text-[hsl(var(--muted-foreground))]">Todavía no hay hechos para mostrar.</p>
          ) : (
            <ul data-hue="violet" className="surface-card divide-y divide-white/5">
              {d.hechos.valor.map((h, i) => (
                <li key={i} className="flex items-baseline gap-3 px-4 py-2.5 text-[13px]">
                  {h.href ? <Link href={h.href} className="min-w-0 flex-1 hover:underline">{h.texto}</Link> : <span className="min-w-0 flex-1">{h.texto}</span>}
                  <span className="shrink-0 text-[11px] text-[hsl(var(--muted-foreground))]">{cuando(h.cuando, ahora)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <Titulo>Oficinas</Titulo>
          {!d.oficinas.ok ? <NoSePudoLeer b={d.oficinas} /> : (
            <ul data-hue="violet" className="surface-card divide-y divide-white/5">
              {d.oficinas.valor.map((o) => (
                <li key={o.clave}>
                  <Link href={`/oficinas#${o.clave}`} className="flex items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-white/[0.03]">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${LUZ[o.semaforo]}`} />
                    <span className="w-32 shrink-0 font-medium">{o.nombre}</span>
                    <span className="min-w-0 truncate text-[hsl(var(--muted-foreground))]">{o.estado_texto}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  )
}
