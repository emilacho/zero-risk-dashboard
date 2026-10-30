import Link from "next/link"
import { redirect } from "next/navigation"
import { exigirAdmin } from "@/lib/admin-guard"
import { getServiceRoleClient } from "@/lib/supabase-server"
import { leerOficinas, leerParaManejar } from "@/lib/oficinas-datos"
import { clientesParaElegir } from "@/lib/clientes-datos"
import { AccionBoton } from "@/components/AccionBoton"
import { FORMATOS_DE_PIEZA, OFICINAS_MANEJABLES, REDES, TOPE_POR_PIEZA_USD } from "@/lib/tablero-acciones"
import { peorSemaforo, type Semaforo } from "@/lib/oficinas"

export const dynamic = "force-dynamic"
export const metadata = { title: "Oficinas" }

const LUZ: Record<Semaforo, string> = { verde: "bg-emerald-400", ambar: "bg-amber-400", rojo: "bg-rose-500", gris: "bg-zinc-500" }
const RESUMEN: Record<Semaforo, string> = { verde: "Todas las oficinas están en orden.", ambar: "Hay algo que mirar en alguna oficina.", rojo: "Hay una oficina con problema.", gris: "Todas las oficinas están apagadas." }

export default async function OficinasPage() {
  const puerta = await exigirAdmin()
  if (!puerta.ok) redirect(puerta.status === 401 ? "/login?next=%2Foficinas" : "/login?error=forbidden")
  const supa = getServiceRoleClient()
  const [tarjetas, manejo, clientes] = await Promise.all([leerOficinas(supa), leerParaManejar(supa).catch(() => null), clientesParaElegir(supa).catch(() => [])])
  const peor = peorSemaforo(tarjetas)
  return (
    <main data-seccion="oficinas" className="mx-auto max-w-[1400px] px-6 pb-16 pl-24 pt-10">
      <h1 className="font-display text-[34px] font-semibold leading-tight tracking-tight">Oficinas</h1>
      <p className="mt-1 flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]"><span className={`h-2.5 w-2.5 rounded-full ${LUZ[peor]}`} />{RESUMEN[peor]}</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tarjetas.map((t) => (
          <section key={t.clave} id={t.clave} className="scroll-mt-6 surface-card flex flex-col gap-3 p-5" data-hue={t.semaforo === "rojo" ? "rose" : t.semaforo === "ambar" ? "amber" : t.semaforo === "verde" ? "emerald" : "violet"}>
            <header>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${LUZ[t.semaforo]}`} />
                <h2 className="font-display text-[17px] font-semibold">{t.nombre}</h2>
                <span className="ml-auto text-[11px] text-[hsl(var(--muted-foreground))]">{t.estado_texto}</span>
              </div>
            </header>
            {t.error ? (
              <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-[13px] text-rose-200">No pude leer esta oficina: {t.error}</p>
            ) : (
              <>
                {t.hizo.length > 0 && (
                  <ul className="space-y-1 text-[13px]">{t.hizo.map((x, i) => <li key={i}>{x}</li>)}</ul>
                )}
                {t.espera.length > 0 && (
                  <ul className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-[13px] text-amber-100">
                    {t.espera.map((e, i) => <li key={i}>{e}</li>)}
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
                {(OFICINAS_MANEJABLES as readonly string[]).includes(t.clave) && manejo && (
                  <div className="flex flex-wrap items-start gap-2 border-t border-white/10 pt-3">
                    <AccionBoton
                      accion="oficina-estado" datos={{ oficina: t.clave, estado: manejo.encendida[t.clave] ? "apagada" : "encendida" }}
                      etiqueta={manejo.encendida[t.clave] ? "Apagar" : "Encender"} variante={manejo.encendida[t.clave] ? "peligro" : "normal"}
                      confirmar={manejo.encendida[t.clave] ? `Vas a apagar ${t.nombre}: deja de recibir trabajo nuevo. Lo que ya está en marcha termina.` : `Vas a encender ${t.nombre}: empieza a recibir trabajo.`}
                    />
                    <AccionBoton accion="oficina-tope" datos={{ oficina: t.clave }} etiqueta="Ajustar el tope de gasto" variante="suave" confirmar="Cambiar el tope cambia cuánto puede gastar esta oficina antes de frenarse." campos={[{ clave: "tope_usd", etiqueta: "Tope (US$)", tipo: "numero", requerido: true }]} />
                    {t.clave === "creativa" && (
                      <AccionBoton
                        accion="pieza-nueva" etiqueta="Pedir una pieza nueva" tope_usd={TOPE_POR_PIEZA_USD}
                        campos={[
                          { clave: "client_id", etiqueta: "Cliente", tipo: "lista", requerido: true, opciones: clientes.map((c) => ({ valor: c.id, texto: c.nombre })) },
                          { clave: "red", etiqueta: "Red", tipo: "lista", requerido: true, opciones: REDES.map((r) => ({ valor: r, texto: r[0].toUpperCase() + r.slice(1) })) },
                          { clave: "formato", etiqueta: "Formato", tipo: "lista", requerido: true, opciones: FORMATOS_DE_PIEZA.map((f) => ({ valor: f, texto: f === "kit" ? "Kit de historias" : "Carrusel" })) },
                          { clave: "brief", etiqueta: "Qué quieres (breve)", tipo: "largo", requerido: true, ayuda: "De 10 a 1.500 letras." },
                        ]}
                      />
                    )}
                    {t.clave === "financiera" && manejo.sin_firmar.map((s) => (
                      <AccionBoton key={s.id} accion="firmar-tablero" datos={{ tablero_id: s.id }} etiqueta={`Firmar el tablero de ${s.cliente}`} confirmar="Al firmar, das por bueno este tablero financiero: queda firmado con tu nombre y fecha." />
                    ))}
                  </div>
                )}
                {t.enlace && (
                  <footer className="mt-auto pt-1 text-[12px]">
                    <Link href={t.enlace.href} className="text-[hsl(var(--primary-glow))] hover:underline">{t.enlace.texto} →</Link>
                  </footer>
                )}
              </>
            )}
          </section>
        ))}
      </div>
    </main>
  )
}
