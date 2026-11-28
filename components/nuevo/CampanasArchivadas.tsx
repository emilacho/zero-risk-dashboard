"use client"

/**
 * 28-nov (Emilio 17:35Z por Lenovo · boceto aprobado 17:46Z · `raw/evidencia/2026-11-28-diagnostico-historia-y-eliminar/7-CON-ARREGLO-archivadas-eliminar.png`)
 * «ARCHIVADAS · N» debajo de los 3 lugares de campaña: una campaña archivada ya no ocupa lugar, pero se puede ELIMINAR con el mismo botón de las vivas.
 *   · cada archivada: su nombre y «ARCHIVADA · <día>»; al dejar el cursor encima aparece «Eliminar» a la derecha (la misma espera y el mismo estilo de `BotonFlujo`)
 *   · dos clics: el primero cambia la palabra a «¿Seguro?», que vuelve sola a «Eliminar» si el segundo no llega o si sale el cursor
 *   · lo aplica la plataforma (`/api/campana-archivo`, el mismo pedido que el «Eliminar» de una viva); al salir bien, el Centro vuelve a leer
 *   · sin archivadas (o sin lectura) no se pinta nada
 * Agnóstico: cualquier cliente, cualquier campaña.
 */
import { useEffect, useRef, useState } from "react"
import { Trash } from "@phosphor-icons/react/dist/ssr/Trash"
import { CLASE_DE_LA_OPCION, ERROR_TRABAJO_EN_CURSO, ESPERA_DE_LAS_OPCIONES_MS, ESPERA_DEL_SEGURO_MS, TEXTO_SEGURO, TEXTO_TRABAJO_EN_CURSO } from "@/components/nuevo/BotonFlujo"
import type { CampanaArchivada } from "@/lib/flujo-de-campana"
import { diaCorto } from "@/lib/lenguaje"

export const TITULO_ARCHIVADAS = "Archivadas"
export const NO_SE_PUDO_ELIMINAR = "No se pudo eliminar ahora. Vuelve a intentarlo en un momento."

/** lee las archivadas del cliente (`/api/campanas-archivadas`); `null` mientras no hay lectura · `vuelta`: al cambiar, se vuelve a leer */
export function useCampanasArchivadas(clienteId: string | null, vuelta = 0, inicial: CampanaArchivada[] | null = null): CampanaArchivada[] | null {
  const [archivadas, setArchivadas] = useState<CampanaArchivada[] | null>(inicial)
  useEffect(() => {
    if (inicial || !clienteId) return
    let vivo = true
    void (async () => {
      try {
        const r = await fetch(`/api/campanas-archivadas?cliente=${encodeURIComponent(clienteId)}`, { cache: "no-store" })
        const j = (await r.json().catch(() => null)) as { ok?: boolean; archivadas?: CampanaArchivada[] } | null
        if (vivo && r.ok && j?.ok === true && Array.isArray(j.archivadas)) setArchivadas(j.archivadas)
      } catch { /* sin lectura no se pinta nada */ }
    })()
    return () => { vivo = false }
  }, [clienteId, vuelta, inicial])
  return archivadas
}

function UnaArchivada({ c, onEliminada }: { c: CampanaArchivada; onEliminada?: () => void }) {
  const [opciones, setOpciones] = useState(false)
  const [seguro, setSeguro] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [nota, setNota] = useState<string | null>(null)
  const relojOpciones = useRef<ReturnType<typeof setTimeout> | null>(null)
  const relojSeguro = useRef<ReturnType<typeof setTimeout> | null>(null)
  const parar = (r: { current: ReturnType<typeof setTimeout> | null }) => { if (r.current) clearTimeout(r.current); r.current = null }
  useEffect(() => () => { parar(relojOpciones); parar(relojSeguro) }, [])
  const entrar = () => { parar(relojOpciones); relojOpciones.current = setTimeout(() => setOpciones(true), ESPERA_DE_LAS_OPCIONES_MS) }
  const salir = () => { parar(relojOpciones); parar(relojSeguro); setOpciones(false); setSeguro(false) }

  const eliminar = async () => {
    if (eliminando) return
    if (!seguro) {
      setSeguro(true); parar(relojSeguro)
      relojSeguro.current = setTimeout(() => setSeguro(false), ESPERA_DEL_SEGURO_MS)
      return
    }
    parar(relojSeguro); setSeguro(false); setEliminando(true); setNota(null)
    try {
      const r = await fetch("/api/campana-archivo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campana_id: c.campana_id, accion: "eliminar" }) })
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (r.ok && j.ok === true) { setOpciones(false); onEliminada?.(); return }
      setNota(j.error === ERROR_TRABAJO_EN_CURSO ? TEXTO_TRABAJO_EN_CURSO : NO_SE_PUDO_ELIMINAR)
    } catch {
      setNota(NO_SE_PUDO_ELIMINAR)
    } finally { setEliminando(false) }
  }

  return (
    <div className="mt-3">
      <div data-campana-archivada={c.campana_id} onMouseEnter={entrar} onMouseLeave={salir}
        onFocus={() => setOpciones(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) salir() }}
        tabIndex={0} aria-label={`Campaña archivada «${c.nombre}»`}
        className="relative flex min-h-[76px] w-full flex-col items-center justify-center rounded-tarjeta border border-linea bg-tarjeta-escena px-4 py-4 text-center hover:border-linea-oro hover:bg-grafito-2 focus-visible:outline focus-visible:outline-1 focus-visible:outline-oro">
        <span data-nombre-de-la-archivada title={c.nombre} className="block max-w-full truncate text-cuerpo font-medio text-hueso">{c.nombre}</span>
        <span className="mt-1.5 flex items-center justify-center gap-2 text-rotulo font-medio uppercase tracking-rotulo text-gris">
          <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-gris" aria-hidden />Archivada · {diaCorto(c.archivada_en)}
        </span>
        {opciones && (
          <div className="absolute right-3 top-1/2 z-10 -translate-y-1/2">
            <button type="button" data-eliminar-campana data-seguro={seguro ? "si" : "no"} onClick={() => void eliminar()} disabled={eliminando}
              aria-label={seguro ? `Confirmar: eliminar la campaña «${c.nombre}»` : `Eliminar la campaña «${c.nombre}»`}
              className={`${CLASE_DE_LA_OPCION} border-linea-alarma text-alarma`}>
              <Trash aria-hidden className="h-4 w-4" />{eliminando ? "Eliminando…" : seguro ? TEXTO_SEGURO : "Eliminar"}
            </button>
          </div>
        )}
      </div>
      {nota && <p role="status" data-nota-de-la-archivada className="mt-2 text-center text-dato text-gris">{nota}</p>}
    </div>
  )
}

export function CampanasArchivadas({ archivadas, onCambio }: { archivadas: CampanaArchivada[] | null; onCambio?: () => void }) {
  if (!archivadas || archivadas.length === 0) return null
  return (
    <div data-campanas-archivadas className="mt-6">
      <p className="text-rotulo font-medio uppercase tracking-rotulo text-gris">{TITULO_ARCHIVADAS} · {archivadas.length}</p>
      {archivadas.map((c) => <UnaArchivada key={c.campana_id} c={c} onEliminada={onCambio} />)}
    </div>
  )
}
