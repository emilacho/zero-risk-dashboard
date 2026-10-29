import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { cargarFicha, type FichaDeCliente } from "@/lib/clientes-datos"
import { etiquetaDelCliente, origenDelManual } from "@/lib/clientes"
import { usdES as usd, estadoDeCampanaLegible, pilarLegible, revisionDeFidelidadLegible, diaYHora } from "@/lib/lenguaje"

export const dynamic = "force-dynamic"
export const metadata = { title: "Cliente" }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const dia = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-EC", { timeZone: "America/Guayaquil", day: "2-digit", month: "short", year: "numeric" }) : "—")

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="surface-card flex flex-col gap-3 p-5">
      <h2 className="font-display text-[16px] font-semibold">{titulo}</h2>
      {children}
    </section>
  )
}
const Dato = ({ e, v }: { e: string; v: React.ReactNode }) => (
  <div>
    <dt className="text-[11px] uppercase tracking-[0.06em] text-[hsl(var(--muted-foreground))]">{e}</dt>
    <dd className="text-[13px]">{v}</dd>
  </div>
)
const Vacio = ({ children }: { children: React.ReactNode }) => <p className="text-[13px] text-[hsl(var(--muted-foreground))]">{children}</p>

export default async function FichaDeClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const puerta = await exigirAdmin()
  if (!puerta.ok) redirect(puerta.status === 401 ? `/login?next=%2Fclientes%2F${encodeURIComponent(id)}` : "/login?error=forbidden")
  if (!UUID.test(id)) notFound()
  let error: string | null = null
  let f: FichaDeCliente | null = null
  try {
    f = await cargarFicha(getServiceRoleClient(), id)
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }
  if (error) return <main className="px-6 pl-24 pt-10"><p className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-[13px] text-rose-200">No pude leer la ficha: {error}</p></main>
  if (!f) notFound()
  const manual = origenDelManual(f.manual)
  return (
    <main className="mx-auto max-w-[1200px] px-6 pb-16 pl-24 pt-10">
      <Link href="/clientes" className="text-[12px] text-[hsl(var(--muted-foreground))] hover:underline">← Clientes</Link>
      <h1 className="mt-2 font-display text-[30px] font-semibold leading-tight tracking-tight">{f.cliente.nombre}</h1>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
        {etiquetaDelCliente(f.cliente.estado)}{f.cliente.rubro ? ` · ${f.cliente.rubro}` : ""}{f.cliente.mercado ? ` · ${f.cliente.mercado}` : ""} · cliente desde {dia(f.cliente.creado)}
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Bloque titulo="Piezas">
          {f.piezas.length === 0 ? <Vacio>Todavía no hay piezas.</Vacio> : (
            <ul className="space-y-1.5 text-[13px]">
              {f.piezas.map((p) => (
                <li key={p.id} className="flex justify-between gap-3">
                  <Link href={`/piezas?id=${p.id}&estado=todas`} className="truncate hover:underline">{p.titulo} <span className="text-[hsl(var(--muted-foreground))]">· {diaYHora(p.creada)}</span></Link>
                  <span className={p.pendiente ? "shrink-0 text-amber-300" : "shrink-0 text-[hsl(var(--muted-foreground))]"}>{p.estado}</span>
                </li>
              ))}
            </ul>
          )}
        </Bloque>
        <Bloque titulo="Plan de 90 días">
          {!f.plan ? <Vacio>Sin plan: este cliente todavía no tiene campaña armada.</Vacio> : (
            <>
              <dl className="grid grid-cols-2 gap-3">
                <Dato e="Campaña" v={estadoDeCampanaLegible(f.plan.campana_estado)} />
                <Dato e="Ventana" v={`${dia(f.plan.desde)} → ${dia(f.plan.hasta)}`} />
                <Dato e="Presupuesto" v={f.plan.presupuesto == null ? "—" : usd(f.plan.presupuesto)} />
                <Dato e="Publicaciones en el calendario" v={f.plan.filas_del_calendario} />
              </dl>
              {f.plan.fases.length > 0 ? (
                <ol className="space-y-1 text-[13px]">
                  {f.plan.fases.map((x) => (
                    <li key={x.clave}>Días {x.dia_desde}–{x.dia_hasta} · {x.objetivo}{pilarLegible(x.cita_plan) ? <span className="text-[hsl(var(--muted-foreground))]"> — {pilarLegible(x.cita_plan)}</span> : null}</li>
                  ))}
                </ol>
              ) : <Vacio>Aún sin estrategia con fases.</Vacio>}
            </>
          )}
        </Bloque>
        <Bloque titulo="Gasto (30 días)">
          <dl className="grid grid-cols-2 gap-3">
            <Dato e="Total (el mismo de Gasto)" v={usd(f.gasto.total_30d)} />
            <Dato e="Empleados AI" v={usd(f.gasto.agentes_30d)} />
            <Dato e="De eso, piezas de la oficina creativa" v={usd(f.gasto.piezas_30d)} />
          </dl>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">El total incluye a los empleados AI y a Apify. Lo de las piezas ya está dentro del gasto de los empleados.</p>
        </Bloque>
        <Bloque titulo="Cerebro">
          <dl className="grid grid-cols-2 gap-3">
            <Dato e="Fichas vigentes" v={f.cerebro.fichas_vigentes} />
            <Dato e="Trozos de conocimiento" v={f.cerebro.trozos} />
            <Dato e="Perfiles de cliente ideal" v={f.perfiles_de_cliente_ideal} />
          </dl>
        </Bloque>
        <Bloque titulo="Manual e identidad">
          {!f.manual ? <Vacio>Sin manual de marca.</Vacio> : (
            <>
              <p className={`w-fit rounded-full border px-2.5 py-0.5 text-[11px] ${manual.propuesta ? "border-amber-500/40 text-amber-200" : "border-white/15"}`}>
                {manual.texto}
              </p>
              <dl className="grid gap-3">
                <Dato e="Propósito" v={f.manual.proposito ?? <span className="text-amber-300">Falta definirlo</span>} />
                <Dato e="Eslogan" v={f.manual.eslogan ?? <span className="text-amber-300">Falta definirlo</span>} />
                <Dato e="Voz de la marca" v={f.manual.voz ?? <span className="text-amber-300">Falta definirla</span>} />
                {f.manual.gate && <Dato e="Revisión de fidelidad" v={revisionDeFidelidadLegible(f.manual.gate)} />}
              </dl>
            </>
          )}
        </Bloque>
      </div>
    </main>
  )
}
