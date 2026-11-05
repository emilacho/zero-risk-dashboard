"use client"

import { useCallback, useEffect, useState } from "react"
import { HORA_24 } from "@/lib/formato"
import { haceCuanto } from "@/lib/direccion-decisiones"
import { NOMBRE_DE_LA_GRAVEDAD, NOMBRE_DEL_SECTOR, ORIGEN_DEL_RIESGO, SECTORES_SIN_FUENTE, type Gravedad, type Riesgo, type Riesgos } from "@/lib/direccion-riesgos"
import { riesgoClaro } from "@/lib/riesgo-claro"
import { Acciones, BOTON_SECUNDARIO, PanelBase, Pares, Recuadros, Rotulo } from "@/components/nuevo/EstiloBase"

/**
 * TU OFICINA · RIESGOS (se abre con la campana del marco y con la pantalla 6 de la escena).
 * ESTILO BASE aprobado por Emilio el 05-nov (guía zr-vault `00-meta/ESTILO-DASHBOARD.md`, imagen `APROBADO-concepto.png`): sin radar dentro del panel
 * (el radar sigue en la pantalla 6 de la escena). Arriba, los recuadros con el número de riesgos ABIERTOS, GRAVES y POR ATENDER: son los filtros. Debajo, la
 * tarjeta del riesgo elegido (gravedad · cliente · sector → qué pasó → a quién afecta y quién lo arregla → desde cuándo y de dónde viene) y la lista del resto,
 * lo más grave arriba; tocar uno lo sube a la tarjeta. Al pie, tus pausas (no son riesgo) y lo que el sistema todavía no puede saber («sin dato»).
 * Datos: `/api/direccion/riesgos` (servidor del tablero → ruta certificada de la plataforma). SOLO LECTURA: todavía no hay dónde guardar «visto» ni «tomada»,
 * así que la tarjeta no ofrece esos botones. Si la lista está incompleta, nunca dice «sin riesgos».
 */
type Respuesta = ({ ok: true } & Riesgos) | { ok: false; error: string }
type Filtro = "abiertas" | "graves" | "atender"

const fecha = (iso: string | null) => { if (!iso) return null; const t = new Date(iso); return Number.isNaN(t.getTime()) ? null : t.toLocaleString("es-EC", { timeZone: "America/Guayaquil", day: "numeric", month: "short", ...HORA_24 }) }
/** el punto de cada riesgo: alarma solo para lo grave; oro para lo que hay que atender; el resto, apagado */
const PUNTO: Record<Gravedad, string> = { 3: "bg-alarma", 2: "bg-oro", 1: "bg-apagado" }
const ordenar = (xs: Riesgo[]) => xs.slice().sort((a, b) => b.gravedad - a.gravedad || Date.parse(b.desde ?? "") - Date.parse(a.desde ?? ""))

function Tarjeta({ r }: { r: Riesgo }) {
  const c = riesgoClaro(r)
  const [detalle, setDetalle] = useState(false)
  const hayDetalle = !!(c.detalle || c.tecnico)
  return (
    <article data-ficha={r.id} data-gravedad={r.gravedad} className="shrink-0 rounded-tarjeta border border-linea bg-grafito-2 p-6 text-center">
      <p className="flex flex-wrap items-center justify-center gap-x-2 text-rotulo uppercase tracking-rotulo text-gris">
        <span data-gravedad-nombre className={`inline-flex items-center gap-1.5 font-medio ${r.gravedad === 3 ? "text-alarma" : "text-oro"}`}><span aria-hidden className={`h-[7px] w-[7px] rounded-full ${PUNTO[r.gravedad]}`} />{NOMBRE_DE_LA_GRAVEDAD[r.gravedad].nombre}</span>
        <span aria-hidden>·</span><span>{r.cliente ?? "Toda la empresa"}</span><span aria-hidden>·</span><span>{NOMBRE_DEL_SECTOR[r.sector].corto}</span>
      </p>
      <h3 data-titulo className="mt-3 text-cuerpo font-medio text-hueso">{c.frase}</h3>
      <p data-quien className="mt-1.5 text-dato text-gris">Afecta a {c.afecta} · {c.arregla ?? "sin responsable asignado"}</p>
      <div className="mt-5"><Pares valor="text-dato" pares={[
        { rotulo: "Desde", valor: haceCuanto(r.desde), dato: fecha(r.desde) ?? undefined },
        { rotulo: "Origen", valor: <span data-origen>{ORIGEN_DEL_RIESGO[r.fuente ?? ""] ?? "Sin dato"}</span> },
      ]} /></div>
      {detalle && (
        <div data-detalle-abierto className="mt-4 border-t border-linea pt-4 text-left">
          {c.detalle && <p data-detalle className="text-dato text-hueso">{c.detalle}</p>}
          {c.tecnico && <p data-tecnico className="mt-2 whitespace-pre-wrap break-words text-dato text-gris">{c.tecnico}</p>}
        </div>
      )}
      {hayDetalle && <Acciones><button type="button" data-ver-detalle aria-expanded={detalle} onClick={() => setDetalle((x) => !x)} className={BOTON_SECUNDARIO}>{detalle ? "Ocultar detalle" : "Detalle"}</button></Acciones>}
    </article>
  )
}

export function PanelRiesgos({ onCerrar, datosIniciales = null, fetchImpl = fetch }: { onCerrar: () => void; datosIniciales?: Riesgos | null; fetchImpl?: typeof fetch }) {
  const [datos, setDatos] = useState<Riesgos | null>(datosIniciales)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(!datosIniciales)
  const [elegido, setElegido] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>("abiertas")

  const leer = useCallback(async () => {
    setCargando(true); setError(null)
    // 6.31 · si ya hay datos (los que la oficina lee cada minuto), se quedan a la vista mientras se refrescan
    try {
      const r = await fetchImpl("/api/direccion/riesgos", { cache: "no-store" })
      const j = (await r.json().catch(() => null)) as Respuesta | null
      if (!r.ok || !j || !j.ok) throw new Error(r.status === 401 || r.status === 403 ? "Necesitas una sesión de administrador para ver los riesgos." : (j && !j.ok && j.error) || `No pude leer los riesgos (${r.status}).`)
      setDatos(j)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setCargando(false) }
  }, [fetchImpl])
  useEffect(() => { void leer() }, [leer]) // 6.31 · siempre se refresca al abrir; con datos iniciales, sin pantalla vacía
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key !== "Escape") return; e.stopPropagation(); e.preventDefault(); onCerrar() }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar])

  const todos = ordenar(datos?.riesgos ?? [])
  const visibles = todos.filter((r) => filtro === "abiertas" || (filtro === "graves" ? r.gravedad === 3 : r.gravedad === 2))
  const ficha = visibles.find((r) => r.id === elegido) ?? visibles[0] ?? null
  const resto = visibles.filter((r) => r.id !== ficha?.id)
  const total = datos?.total ?? 0
  const n = (x: number) => (datos ? x : "…")
  const faltan = (datos?.fuentes ?? []).filter((f) => f.estado === "error" || f.estado === "sin_credencial")
  const avisos = (datos?.fuentes ?? []).filter((f) => f.detalle && f.estado === "ok")
  const vacios = datos ? SECTORES_SIN_FUENTE.filter((s) => !datos.por_sector[s]) : []
  const resumen = !datos ? "" : `${total} ${total === 1 ? "riesgo" : "riesgos"} · ${datos.por_gravedad[3]} ${datos.por_gravedad[3] === 1 ? "grave" : "graves"}${datos.completo ? "" : " · la lista puede estar incompleta"}`
  const elegir = (k: string) => { setFiltro(k as Filtro); setElegido(null) }

  return (
    <PanelBase titulo="Riesgos" id="riesgos-titulo" seccion="riesgos" onCerrar={onCerrar} etiquetaCerrar="Cerrar los riesgos">
      <p data-resumen className="sr-only">{cargando && !datos ? "Leyendo…" : resumen}</p>
      <Recuadros etiqueta="Filtrar los riesgos" alElegir={elegir} items={[
        { clave: "abiertas", numero: n(total), rotulo: "Abiertos", activo: filtro === "abiertas" },
        { clave: "graves", numero: n(datos?.por_gravedad[3] ?? 0), rotulo: "Graves", activo: filtro === "graves", alarma: (datos?.por_gravedad[3] ?? 0) > 0 },
        { clave: "atender", numero: n(datos?.por_gravedad[2] ?? 0), rotulo: "Atender", activo: filtro === "atender" },
      ]} />
      {error && <p role="alert" className="mb-4 border-y border-linea-alarma py-3 text-center text-dato text-hueso">{error}</p>}

      {ficha ? <Tarjeta key={ficha.id} r={ficha} />
        : datos ? (
          <p data-vacio className="py-6 text-center text-cuerpo text-gris">
            {total > 0 ? "Nada en este filtro." : datos.completo && !error ? "Sin riesgos abiertos ahora." : "No pude leer todas las fuentes: no puedo asegurarte que no haya riesgos."}
          </p>
        ) : <p className="py-6 text-center text-dato text-gris">Leyendo los riesgos…</p>}

      {resto.length > 0 && (
        <ul aria-label="Los demás riesgos" className="mt-6 shrink-0">
          {resto.map((r) => {
            const c = riesgoClaro(r)
            return (
              <li key={r.id} className="border-t border-linea">
                <button type="button" data-fila={r.id} onClick={() => setElegido(r.id)} className="grid min-h-11 w-full grid-cols-[16px_1fr] items-start gap-x-1 py-4 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-oro">
                  <span aria-hidden className={`mt-2 h-[7px] w-[7px] rounded-full ${PUNTO[r.gravedad]}`} />
                  <span className="min-w-0"><span className="block text-cuerpo text-hueso">{c.frase}</span><span className="block text-dato text-gris">{NOMBRE_DEL_SECTOR[r.sector].corto} · {r.cliente ?? "Toda la empresa"} · {haceCuanto(r.desde)}</span></span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {datos && datos.decisiones_tuyas.length > 0 && (
        <div data-decisiones-tuyas className="mt-6 shrink-0 border-t border-linea pt-4 text-center">
          <Rotulo>Tus pausas</Rotulo>
          <p className="mt-1 text-dato text-gris">No son riesgo: las decidiste tú.</p>
          {datos.decisiones_tuyas.map((d) => <p key={d.id} className="mt-1 text-dato text-hueso">{d.titulo}{d.detalle ? <span className="text-gris"> · {d.detalle}</span> : null}</p>)}
        </div>
      )}
      {datos ? (
        <div data-sin-dato className="mt-6 shrink-0 border-t border-linea pt-4 text-center">
          <Rotulo>Sin dato</Rotulo>
          <p className="mt-1 text-dato text-gris">{[
            ...faltan.map((f) => `${ORIGEN_DEL_RIESGO[f.fuente] ?? "una fuente"} (no se pudo leer)`),
            ...datos.sin_fuente.map((x) => x.que),
            ...(vacios.length ? [`${vacios.map((x) => NOMBRE_DEL_SECTOR[x].nombre.toLowerCase()).join(", ")}: el sistema todavía no tiene de dónde leerlos`] : []),
          ].join(" · ")}</p>
          {avisos.map((f) => <p key={`a-${f.fuente}`} className="mt-1 text-dato text-gris">{ORIGEN_DEL_RIESGO[f.fuente] ?? "Una fuente"}: {(f.detalle ?? "").replace(/\bn8n\b/g, "el sistema de procesos")}</p>)}
          {datos.caducados > 0 && <p className="mt-1 text-dato text-gris">{datos.caducados === 1 ? "1 aviso viejo caducó solo" : `${datos.caducados} avisos viejos caducaron solos`}</p>}
        </div>
      ) : null}
    </PanelBase>
  )
}
