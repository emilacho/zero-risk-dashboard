/**
 * REFLEJO INMEDIATO (CC#1 · 30-oct · ADENDA 3): tras decidir una pieza, la pantalla dice el resultado al instante.
 * Antes se quedaba en «Pendiente» con los botones activos hasta recargar.
 */
import type { EstadoPieza } from "@/lib/piezas"

export type DecisionDeLaPieza = "aprobar" | "cambios" | "rechazar"

/** el estado que queda en la bandeja tras cada decisión (igual que `ESTADOS_DE_LA_BANDEJA`: approved · edited · rejected) */
export function estadoTrasDecidir(d: DecisionDeLaPieza): EstadoPieza {
  return d === "aprobar" ? "aprobada" : d === "cambios" ? "con_cambios" : "rechazada"
}
