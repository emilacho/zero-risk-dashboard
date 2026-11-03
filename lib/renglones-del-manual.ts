/**
 * LAS REGLAS DE «EDITAR / RETIRAR» POR RENGLÓN (CC2 · 03-nov), en funciones puras para poder probarlas sin pantalla
 * (certificación de CC3 sobre #239: «lo central no lo exige ninguna prueba»). Las usan `Campo` (PanelManual), `SeccionesNuevas` y `RenglonEditable`.
 */

/** la lista completa con SOLO el renglón `i` cambiado (los demás, intactos y en su sitio) */
export function conRenglonCambiado(renglones: string[], i: number, nuevo: string): string[] {
  return renglones.map((r, j) => (j === i ? nuevo : r))
}

/** qué hacer al tocar «Retirar» en el renglón `i`: si quedan otros, se quita solo ese; si era el único, se pide confirmar el retiro del campo entero */
export type RetiroDeRenglon = { tipo: "quitar"; quedan: string[] } | { tipo: "confirmar_campo" }
export function retirarRenglon(renglones: string[], i: number): RetiroDeRenglon {
  if (renglones.length <= 1) return { tipo: "confirmar_campo" }
  return { tipo: "quitar", quedan: renglones.filter((_, j) => j !== i) }
}

/** un renglón está «editado» cuando ya no es uno de los que están GUARDADOS en el manual */
export const renglonEditado = (renglon: string, guardados: string[]): boolean => !guardados.includes(renglon)

/** cómo lo dice «Tus cambios»: el número de renglón empieza en 1 */
export const detalleDelRenglon = (i: number): string => `editaste el renglón ${i + 1}`

/** el texto corregido de un renglón: una sola línea (los saltos y espacios repetidos se juntan); vacío = no vale (para eso está «Retirar») */
export const textoDelRenglon = (escrito: string): string => escrito.replace(/\s+/g, " ").trim()

/** «Enter» confirma el renglón; «Mayús + Enter» no (queda a disposición) */
export const confirmaConEnter = (tecla: string, mayus: boolean): boolean => tecla === "Enter" && !mayus
