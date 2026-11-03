/**
 * LAS TARJETAS DE «TU OFICINA» CON SU DATO (CC6 · 03-nov · encargo de Lenovo 22:20Z: ORGANIZACIÓN era la única sin estado).
 * Cada vidrio lleva su dato grande o un «pronto» honesto, nunca vacío. Organización usa la MISMA cuenta que su panel (`partesQueSuman`, #251 de CC1);
 * Portafolio, los clientes de verdad del selector (`/api/direccion/clientes`). Gobierno e Ideas y proyectos todavía no tienen de dónde leer: «pronto».
 */
import { partesQueSuman, type Organizacion } from "@/lib/direccion-organizacion"

export const TEXTO_PRONTO = "pronto"

export interface ResumenDeOrganizacion { grande: string; detalle: string }
/** lo grande es la primera parte de la suma del panel; el resto, abajo en chico (mismas palabras que el panel) */
export function resumenDeOrganizacion(r: Organizacion["resumen"]): ResumenDeOrganizacion {
  const [grande, ...resto] = partesQueSuman(r)
  return { grande, detalle: resto.join(" · ") }
}

export interface ResumenDePortafolio { clientes: number }
export function resumenDePortafolio(clientes: unknown[]): ResumenDePortafolio {
  return { clientes: clientes.length }
}
export const textoDelPortafolio = (p: ResumenDePortafolio): string => (p.clientes === 0 ? "sin clientes" : `${p.clientes} ${p.clientes === 1 ? "cliente" : "clientes"}`)

/** la pantalla de música dice en qué está: nunca queda muda */
export const textoDeLaMusica = (encendida: boolean): string => (encendida ? "sonando" : "▶ escuchar")
