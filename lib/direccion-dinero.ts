/**
 * TU OFICINA · CAPA 2 · DINERO (6.23 · 1-nov · correcciones de Emilio a Riesgos: «los paneles Saldos de proveedores y Freno de gasto VAN A LA PANTALLA
 * DINERO»). Fuente: la misma ruta certificada `GET /api/direccion/riesgos` (CC1), que trae `saldos[]` (hoy solo Apify) y `topes[]` (gasto de 24 h de cada
 * cliente contra el techo con el que el freno detiene a sus agentes: el de su ficha o el general de arranque). SOLO LECTURA.
 * Regla de Emilio para todo /nuevo: nada de avisos de gasto en botones ni pantallas; el gasto SE VE AQUÍ (y en el panel de gastos de cada oficina).
 */
import type { Riesgos, Saldo, Tope } from "@/lib/direccion-riesgos"

export interface Medida { que: string; tipo: "saldo" | "freno"; pct: number }
export interface ResumenDeDinero { saldos: Saldo[]; topes: Tope[]; /** lo más cerca de su límite, para la pantalla del arco */ mayor: Medida | null; leido: true }

export function resumenDeDinero(d: Pick<Riesgos, "saldos" | "topes">): ResumenDeDinero {
  const medidas: Medida[] = [
    ...d.saldos.flatMap((s) => (s.pct == null ? [] : [{ que: s.proveedor, tipo: "saldo" as const, pct: s.pct }])),
    ...d.topes.flatMap((t) => (t.pct == null ? [] : [{ que: t.cliente ?? "Sin cliente", tipo: "freno" as const, pct: t.pct }])),
  ]
  const mayor = medidas.reduce<Medida | null>((m, x) => (!m || x.pct > m.pct ? x : m), null)
  return { saldos: d.saldos, topes: d.topes, mayor, leido: true }
}

/** el color de un medidor: ámbar normal · naranja desde 60 % · rojo desde 85 % */
export const colorDelMedidor = (pct: number | null): string => (pct == null ? "rgba(255,255,255,.2)" : pct >= 85 ? "#ff5a36" : pct >= 60 ? "#f5a524" : "#e8731a")
export const usd = (n: number | null): string => (n == null ? "sin dato" : `US$ ${n.toFixed(2)}`)
export const diaDelCiclo = (iso: string | null): string | null => {
  if (!iso) return null
  const t = new Date(iso)
  return Number.isNaN(t.getTime()) ? null : t.toLocaleDateString("es-EC", { timeZone: "America/Guayaquil", day: "numeric", month: "long" })
}
