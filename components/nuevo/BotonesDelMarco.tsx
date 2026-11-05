"use client"

/**
 * LOS BOTONES DEL MARCO QUE HACEN ALGO (CC6 · 03-nov · sprint dashboard): el marco es de servidor; estos tres necesitan el navegador.
 *  - `BotonDePanel`: abre un panel encima de la escena (la escena escucha `nv:abrir-panel`).
 *  - `BotonSalir`: cierra la sesión de verdad y vuelve al ingreso.
 */
import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { EVENTO_ABRIR_PANEL, type PanelDelMarco, type PedidoDePanel } from "@/lib/buscador"
import { EVENTO_RIESGOS_LEIDOS, cuentaDeLaCampana, numeroDeLaCampana, type CuentaDeLaCampana, type Riesgos } from "@/lib/direccion-riesgos"
import { getBrowserClient } from "@/lib/supabase-browser"

/** pide a la escena que abra un panel (Riesgos, Dinero, Organización, Piezas…) */
export function abrirPanel(panel: PanelDelMarco, extra: Omit<PedidoDePanel, "panel"> = {}) {
  window.dispatchEvent(new CustomEvent<PedidoDePanel>(EVENTO_ABRIR_PANEL, { detail: { panel, ...extra } }))
}

export function BotonDePanel({ panel, etiqueta, className, children }: { panel: PanelDelMarco; etiqueta: string; className: string; children: ReactNode }) {
  return <button type="button" data-abre-panel={panel} aria-label={etiqueta} title={etiqueta} onClick={() => abrirPanel(panel)} className={className}>{children}</button>
}

/**
 * LA CAMPANA (estilo base 05-nov · Emilio: «la campana roja con su número se queda y abre su panel»; nada flota sobre la escena).
 * El número son los riesgos abiertos: en rojo si hay alguno grave, en oro si no. Sin lectura o sin riesgos, no muestra número (nunca un «0» falso).
 * Lee una vez al entrar y cada 5 minutos con la pestaña a la vista; mientras Tu oficina está abierta, toma el número que la escena ya lee cada minuto.
 */
export function CampanaDeRiesgos({ className, children, fetchImpl = fetch, cuentaInicial = null }: { className: string; children: ReactNode; fetchImpl?: typeof fetch; cuentaInicial?: CuentaDeLaCampana | null }) {
  const [cuenta, setCuenta] = useState<CuentaDeLaCampana | null>(cuentaInicial)
  useEffect(() => {
    const leer = async () => {
      try {
        const r = await fetchImpl("/api/direccion/riesgos", { cache: "no-store" })
        const j = (await r.json().catch(() => null)) as ({ ok: true } & Riesgos) | null
        setCuenta(r.ok && j?.ok ? cuentaDeLaCampana(j) : null)
      } catch { setCuenta(null) }
    }
    const deLaEscena = (e: Event) => setCuenta((e as CustomEvent<CuentaDeLaCampana>).detail)
    void leer()
    const t = setInterval(() => { if (!document.hidden) void leer() }, 300_000)
    window.addEventListener(EVENTO_RIESGOS_LEIDOS, deLaEscena)
    return () => { clearInterval(t); window.removeEventListener(EVENTO_RIESGOS_LEIDOS, deLaEscena) }
  }, [fetchImpl])
  const numero = numeroDeLaCampana(cuenta)
  const etiqueta = numero ? `Riesgos y alarmas: ${numero} ${cuenta!.abiertos === 1 ? "abierto" : "abiertos"}${cuenta!.graves ? `, ${cuenta!.graves} ${cuenta!.graves === 1 ? "grave" : "graves"}` : ""}` : "Riesgos y alarmas"
  return (
    <button type="button" data-abre-panel="riesgos" data-campana={numero ?? "sin-numero"} aria-label={etiqueta} title={etiqueta} onClick={() => abrirPanel("riesgos")} className={`relative ${className}`}>
      {children}
      {numero && <span aria-hidden data-numero-campana className={`absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-rotulo font-medio [font-variant-numeric:tabular-nums] text-carbon ${cuenta!.graves ? "bg-alarma" : "bg-oro"}`}>{numero}</span>}
    </button>
  )
}

export function BotonSalir({ className, children }: { className: string; children: ReactNode }) {
  const [saliendo, setSaliendo] = useState(false)
  async function salir() {
    setSaliendo(true)
    try { await getBrowserClient().auth.signOut() } finally { window.location.assign("/login") }
  }
  return <button type="button" data-accion="salir" aria-label="Salir" title="Salir" disabled={saliendo} onClick={() => void salir()} className={className}>{children}</button>
}
