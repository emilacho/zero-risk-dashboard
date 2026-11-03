"use client"

/**
 * LOS BOTONES DEL MARCO QUE HACEN ALGO (CC6 · 03-nov · sprint dashboard): el marco es de servidor; estos tres necesitan el navegador.
 *  - `BotonDePanel`: abre un panel encima de la escena (la escena escucha `nv:abrir-panel`).
 *  - `BotonSalir`: cierra la sesión de verdad y vuelve al ingreso.
 */
import type { ReactNode } from "react"
import { useState } from "react"
import { EVENTO_ABRIR_PANEL, type PanelDelMarco, type PedidoDePanel } from "@/lib/buscador"
import { getBrowserClient } from "@/lib/supabase-browser"

/** pide a la escena que abra un panel (Riesgos, Dinero, Organización, Piezas…) */
export function abrirPanel(panel: PanelDelMarco, extra: Omit<PedidoDePanel, "panel"> = {}) {
  window.dispatchEvent(new CustomEvent<PedidoDePanel>(EVENTO_ABRIR_PANEL, { detail: { panel, ...extra } }))
}

export function BotonDePanel({ panel, etiqueta, className, children }: { panel: PanelDelMarco; etiqueta: string; className: string; children: ReactNode }) {
  return <button type="button" data-abre-panel={panel} aria-label={etiqueta} title={etiqueta} onClick={() => abrirPanel(panel)} className={className}>{children}</button>
}

export function BotonSalir({ className, children }: { className: string; children: ReactNode }) {
  const [saliendo, setSaliendo] = useState(false)
  async function salir() {
    setSaliendo(true)
    try { await getBrowserClient().auth.signOut() } finally { window.location.assign("/login") }
  }
  return <button type="button" data-accion="salir" aria-label="Salir" title="Salir" disabled={saliendo} onClick={() => void salir()} className={className}>{children}</button>
}
