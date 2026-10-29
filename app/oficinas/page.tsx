import Link from "next/link"
import { redirect } from "next/navigation"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { leerOficinas } from "@/lib/oficinas-datos"
import { haceCuanto, peorSemaforo, type Semaforo } from "@/lib/oficinas"

export const dynamic = "force-dynamic"
export const metadata = { title: "Oficinas" }

const LUZ: Record<Semaforo, string> = { verde: "bg-emerald-400", ambar: "bg-amber-400", rojo: "bg-rose-500", gris: "bg-zinc-500" }
const RESUMEN: Record<Semaforo, string> = { verde: "Todas las oficinas están en orden.", ambar: "Hay algo que mirar en alguna oficina.", rojo: "Hay una oficina con problema.", gris: "Todas las oficinas están apagadas." }

export default async function OficinasPage() {
  const puerta = await exigirAdmin()
  if (!puerta.ok) redirect(puerta.status === 401 ? "/login?next=%2Foficinas" : "/login?error=forbidden")
  const tarjetas = await leerOficinas(getServiceRoleClient())
  const peor = peorSemaforo(tarjetas)
  const ahora = new Date()
  return (
    <main className="mx-auto max-w-[1400px] px-6 pb-16 pl-24 pt-10">
      <span className="eyebrow-chip self-start">Estado real · últimos 7 días</span>
      <h1 className="mt-3 font-display text-[34px] font-semibold leading-tight tracking-tight">Oficinas</h1>
      <p className="mt-1 flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]"><span className={`h-2.5 w-2.5 rounded-full ${LUZ[peor]}`} />{RESUMEN[peor]}</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tarjetas.map((t) => (
          <section key={t.clave} className="surface-card flex flex-col gap-3 p-5" data-hue={t.semaforo === "rojo" ? "rose" : t.semaforo === "ambar" ? "amber" : t.semaforo === "verde" ? "emerald" : "violet"}>
            <header>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${LUZ[t.semaforo]}`} />
                <h2 className="font-display text-[17px] font-semibold">{t.nombre}</h2>
                <span className="ml-auto text-[11px] text-[hsl(var(--muted-foreground))]">{t.estado_texto}</span>
              </div>
              <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">{t.que_hace}</p>
            </header>
            {t.error ? (
              <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-[13px] text-rose-200">No pude leer esta oficina: {t.error}</p>
            ) : (
              <>
                {t.espera.length > 0 && (
                  <ul className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-[13px] text-amber-100">
                    {t.espera.map((e, i) => <li key={i}>⏳ {e}</li>)}
                  </ul>
                )}
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                  {t.datos.map((d) => (
                    <div key={d.etiqueta} className={d.valor.length > 24 ? "col-span-2" : ""}>
                      <dt className="text-[11px] uppercase tracking-[0.06em] text-[hsl(var(--muted-foreground))]">{d.etiqueta}</dt>
                      <dd className={`num ${d.alerta ? "text-rose-300" : ""}`}>{d.valor}</dd>
                    </div>
                  ))}
                </dl>
                {t.detalle.length > 0 && <ul className="space-y-1 text-[12px] text-[hsl(var(--muted-foreground))]">{t.detalle.map((x, i) => <li key={i}>{x}</li>)}</ul>}
                <footer className="mt-auto flex items-center justify-between pt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
                  <span>Última actividad: {haceCuanto(t.ultima_actividad, ahora)}</span>
                  {t.enlace && <Link href={t.enlace.href} className="text-[hsl(var(--primary-glow))] hover:underline">{t.enlace.texto} →</Link>}
                </footer>
              </>
            )}
          </section>
        ))}
      </div>
    </main>
  )
}
