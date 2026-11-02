/**
 * LAS NOTAS DE UN DATO DEL MANUAL (CC6 · 02-nov · SEÑAL de Lenovo «desbloquear el manual», decisión de Emilio: «no borrar: anotar visible y él decide»).
 * Dos fuentes dentro de `_field_meta.<clave>` del borrador:
 *  - `datos_sin_fuente` = [{ dato, marca, clausula, motivo }] → lo marcó LA PUERTA, por código (CC1 #855): una fecha o cifra que no aparece en la evidencia.
 *  - `notas_del_juez`   = [{ dato, motivo }]                  → lo marcó EL JUEZ, razonando (CC2 · ADENDA 1).
 * Pueden coincidir: si el mismo dato viene de los dos, sale UNA nota que dice «la puerta y el juez». No toca el texto del manual; solo informa.
 */
export type QuienMarco = "puerta" | "juez" | "ambos"
export interface NotaDelCampo { dato: string; motivo: string; quien: QuienMarco }

const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "")
const lista = (v: unknown): Array<Record<string, unknown>> => (Array.isArray(v) ? v.map(objeto) : [])
const clave = (dato: string) => dato.toLocaleLowerCase("es").replace(/\s+/g, " ")

/** las notas de un campo, en el orden en que llegan; sin dato no hay nota (no se inventa) */
export function notasDelCampo(meta: unknown): NotaDelCampo[] {
  const m = objeto(meta)
  const salida: NotaDelCampo[] = []
  const indice = new Map<string, NotaDelCampo>()
  const sumar = (dato: string, motivo: string, quien: "puerta" | "juez") => {
    if (!dato) return
    const k = clave(dato), ya = indice.get(k)
    if (ya) { if (ya.quien !== quien) { ya.quien = "ambos"; if (!ya.motivo && motivo) ya.motivo = motivo } return }
    const n: NotaDelCampo = { dato, motivo, quien }; indice.set(k, n); salida.push(n)
  }
  for (const x of lista(m.datos_sin_fuente)) sumar(texto(x.dato) || texto(x.marca), texto(x.motivo) || "dato sin fuente en la evidencia", "puerta")
  for (const x of lista(m.notas_del_juez)) sumar(texto(x.dato), texto(x.motivo), "juez")
  return salida
}

/** quién lo marcó, en palabras */
export const QUIEN_MARCO: Record<QuienMarco, string> = { puerta: "lo marcó la puerta (por código)", juez: "lo marcó el juez (razonando)", ambos: "lo marcaron la puerta y el juez" }
