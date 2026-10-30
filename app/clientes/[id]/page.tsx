import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { cargarFicha, type FichaDeCliente } from "@/lib/clientes-datos"
import { etiquetaDelCliente, esDeBaja, origenDelManual } from "@/lib/clientes"
import { AccionBoton } from "@/components/AccionBoton"
import { CAMPOS_DEL_MANUAL, REDES } from "@/lib/tablero-acciones"
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
  const deBaja = esDeBaja({ estado: f.cliente.estado, nombre: f.cliente.nombre })
  const lector = f.manual?.lector ?? null
  const del = (clave: string) => lector?.campos.find((c) => c.clave === clave)?.valor ?? ""
  const valorDelManual: Record<string, string> = { proposito: del("proposito"), eslogan: del("eslogan"), voz: del("voz") }
  return (
    <main data-seccion="clientes" className="mx-auto max-w-[1200px] px-6 pb-16 pl-24 pt-10">
      <Link href="/clientes" className="text-[12px] text-[hsl(var(--muted-foreground))] hover:underline">← Clientes</Link>
      <h1 className="mt-2 font-display text-[30px] font-semibold leading-tight tracking-tight">{f.cliente.nombre}</h1>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
        {etiquetaDelCliente(f.cliente.estado)}{f.cliente.rubro ? ` · ${f.cliente.rubro}` : ""}{f.cliente.mercado ? ` · ${f.cliente.mercado}` : ""}
      </p>
      <div className="mt-4 flex flex-wrap items-start gap-3">
        <AccionBoton
          accion="cliente-editar" datos={{ client_id: id }} etiqueta="Editar datos" variante="suave" anidar="campos"
          campos={[
            { clave: "rubro", etiqueta: "Rubro", inicial: f.cliente.rubro ?? "" },
            { clave: "ciudad", etiqueta: "Ciudad o mercado", inicial: f.cliente.mercado ?? "" },
            { clave: "sitio", etiqueta: "Sitio web", inicial: f.cliente.sitio ?? "" },
            { clave: "presupuesto", etiqueta: "Presupuesto mensual (US$)", tipo: "numero", ayuda: "Déjalo vacío para no cambiarlo." },
            ...REDES.map((r) => ({ clave: `redes.${r}`, etiqueta: `Usuario en ${r[0].toUpperCase()}${r.slice(1)}`, ayuda: "Déjalo vacío para no cambiarlo." })),
          ]}
        />
        {!deBaja && (
          <AccionBoton accion="cliente-baja" datos={{ client_id: id }} etiqueta="Dar de baja" variante="peligro" confirmar={`Vas a dar de baja a ${f.cliente.nombre}. Deja de aparecer en la lista y se detienen sus piezas nuevas; nada se borra.`} campos={[{ clave: "comentario", etiqueta: "¿Por qué se da de baja?", tipo: "largo", requerido: true }]} alTerminar={() => "/clientes"} />
        )}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Bloque titulo="Piezas">
          {f.piezas.length === 0 ? <Vacio>Sin piezas.</Vacio> : (
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
          {!f.plan ? <Vacio>Sin plan.</Vacio> : (
            <>
              <dl className="grid grid-cols-2 gap-3">
                <Dato e="Campaña" v={estadoDeCampanaLegible(f.plan.campana_estado)} />
                <Dato e="Ventana" v={`${dia(f.plan.desde)} → ${dia(f.plan.hasta)}`} />
                <Dato e="Presupuesto" v={f.plan.presupuesto == null ? "—" : usd(f.plan.presupuesto)} />
                <Dato e="Publicaciones" v={f.plan.filas_del_calendario} />
              </dl>
              {f.plan.fases.length > 0 ? (
                <ol className="space-y-1 text-[13px]">
                  {f.plan.fases.map((x) => (
                    <li key={x.clave}>Días {x.dia_desde}–{x.dia_hasta} · {x.objetivo}{pilarLegible(x.cita_plan) ? <span className="text-[hsl(var(--muted-foreground))]"> — {pilarLegible(x.cita_plan)}</span> : null}</li>
                  ))}
                </ol>
              ) : <Vacio>Sin fases.</Vacio>}
              <div className="flex flex-wrap items-start gap-3">
                <AccionBoton accion="plan-aprobar" datos={{ campana_id: f.plan.campana_id }} etiqueta="Aprobar el plan" confirmar="Al aprobar, el plan queda firme y la oficina creativa empieza a producir las piezas del calendario." />
                <AccionBoton accion="plan-cambios" datos={{ campana_id: f.plan.campana_id }} etiqueta="Pedir cambios al plan" variante="suave" campos={[{ clave: "comentario", etiqueta: "¿Qué quieres cambiar?", tipo: "largo", requerido: true }]} />
              </div>
              {f.plan.esperas.length > 0 && (
                <div>
                  <h3 className="mb-1 text-[11px] uppercase tracking-[0.06em] text-[hsl(var(--muted-foreground))]">Esperan una respuesta ({f.plan.esperas.length})</h3>
                  <ul className="space-y-2 text-[13px]">
                    {f.plan.esperas.map((e) => (
                      <li key={e.id} className="flex flex-wrap items-start justify-between gap-2">
                        <span className="min-w-0 flex-1">{e.motivo}{e.vence_en ? <span className="text-[hsl(var(--muted-foreground))]"> · plazo {dia(e.vence_en)}</span> : null}</span>
                        {/bandeja/i.test(e.motivo)
                          ? <Link href="/piezas" className="shrink-0 rounded-md border border-white/15 px-3 py-1.5 text-[12px] hover:bg-white/[0.06]">Ir a las piezas</Link>
                          : <AccionBoton accion="plan-responder" datos={{ espera_id: e.id }} etiqueta="Contestar" variante="suave" campos={[{ clave: "respuesta", etiqueta: "Tu respuesta", tipo: "largo", requerido: true }]} />}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {f.plan.calendario.length > 0 && (
                <details className="text-[13px]">
                  <summary className="cursor-pointer text-[hsl(var(--muted-foreground))] hover:text-white">Ver el calendario completo ({f.plan.calendario.length} publicaciones)</summary>
                  <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto pr-1">
                    {f.plan.calendario.map((x) => (
                      <li key={x.id} className="flex gap-2"><span className="w-20 shrink-0 text-[hsl(var(--muted-foreground))]">{dia(x.fecha)}</span><span className="w-24 shrink-0">{x.red} · {x.formato}</span><span className="min-w-0">{x.tema}</span></li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </Bloque>
        <Bloque titulo="Gasto (30 días)">
          <dl className="grid grid-cols-2 gap-3">
            <Dato e="Total" v={usd(f.gasto.total_30d)} />
            <Dato e="Empleados AI" v={usd(f.gasto.agentes_30d)} />
          </dl>
        </Bloque>
        <Bloque titulo="Cerebro">
          <dl className="grid grid-cols-2 gap-3">
            <Dato e="Fichas vigentes" v={f.cerebro.fichas_vigentes} />
            <Dato e="Trozos" v={f.cerebro.trozos} />
            <Dato e="Perfiles de cliente" v={f.perfiles_de_cliente_ideal} />
          </dl>
        </Bloque>
        <Bloque titulo="Manual e identidad">
          {!f.manual ? <Vacio>Sin manual de marca.</Vacio> : (
            <>
              <div className="flex flex-wrap gap-2">
                <p className={`w-fit rounded-full border px-2.5 py-0.5 text-[11px] ${lector && lector.validadoPor === "propuesta" ? "border-amber-500/40 text-amber-200" : "border-white/15"}`}>
                  {lector ? lector.rotulo : manual.texto}
                </p>
                {lector && (
                  <p className={`w-fit rounded-full border px-2.5 py-0.5 text-[11px] ${lector.completo ? "border-white/15" : "border-amber-500/40 text-amber-200"}`}>
                    {lector.completo ? (lector.rotuloVisual ?? "Completo") : `Incompleto · faltan ${lector.huecos.length}`}
                  </p>
                )}
              </div>
              <dl className="grid gap-3">
                {(lector?.campos ?? []).map((c) => (
                  <Dato key={c.clave} e={c.etiqueta} v={c.valor ? (<>{c.valor}{c.estado === "propuesta" && <span className="ml-2 text-[11px] text-amber-300">propuesta del agente</span>}</>) : <span className="text-amber-300">{c.nota}</span>} />
                ))}
                {f.manual.gate && <Dato e="Revisión de fidelidad" v={revisionDeFidelidadLegible(f.manual.gate)} />}
              </dl>
              <div className="flex flex-wrap items-start gap-3">
                <AccionBoton
                  accion="manual-campos" datos={{ client_id: id }} etiqueta="Editar el manual" variante="suave" anidar="campos"
                  campos={[...CAMPOS_DEL_MANUAL.map((c) => ({ clave: c.clave, etiqueta: c.etiqueta, tipo: c.largo ? ("largo" as const) : ("texto" as const), inicial: valorDelManual[c.clave] ?? "", ayuda: valorDelManual[c.clave] === undefined ? "Déjalo vacío para no cambiarlo." : undefined })), { clave: "comentario_porque", etiqueta: "¿Por qué? (opcional, el sistema aprende de esto)", tipo: "largo" as const }]}
                />
                {!(f.manual && manual.texto.startsWith("Validado")) && (
                  <AccionBoton accion="manual-validar" datos={{ client_id: id }} etiqueta="Validar el manual" confirmar="Validar significa que tú das este manual por bueno: la oficina creativa y la planeación lo leerán como tuyo." />
                )}
              </div>
            </>
          )}
        </Bloque>
      </div>
    </main>
  )
}
