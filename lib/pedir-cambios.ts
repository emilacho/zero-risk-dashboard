/**
 * LA VENTANA «PEDIR CAMBIOS» (GO Lenovo 21:59 · Emilio aprobó el boceto `APROBADO-pedir-cambios.png` y sus 3 variantes `boceto-variantes.png`, A1 + B1).
 * Lo que la ventana necesita y no es dibujo: cómo se cuenta la nota (una sola función para los 4 paneles), el título y las líneas
 * «Qué pasa después» de cada panel. Cada línea dice SOLO lo que pasa hoy (nada de colaterales hasta que Emilio los encienda).
 */
import { hayTexto } from "@/lib/piezas"
import { NOTA_MINIMA } from "@/lib/concepto-decision"

/** cuántas letras tiene la nota: después de recortar los espacios (10 espacios no son 10 letras) */
export const letrasDeLaNota = (t: string | null | undefined): number => (typeof t === "string" ? t.trim().length : 0)

/** ¿alcanza la nota? `minimo` 1 = «basta que haya texto» (regla del 11-nov 05:03Z, la de `hayTexto`); la gran idea pide `NOTA_MINIMA`
 *  porque la plataforma lo exige. Es una ayuda de la pantalla: la puerta de cada panel decide igual que hoy. */
export function notaAlcanza(t: string | null | undefined, minimo: number): boolean {
  const n = letrasDeLaNota(t)
  return minimo <= 1 ? hayTexto(t ?? "") : n >= minimo
}

/** el mínimo de cada panel (pendiente de la respuesta de Lenovo: «basta que haya texto» o 10 en los 4) */
export const MINIMO_DE_LA_NOTA = { plan: 1, manual: 1, piezas: 1, gran_idea: NOTA_MINIMA } as const
export type PanelDelPedido = keyof typeof MINIMO_DE_LA_NOTA

/** el prefijo que hoy se antepone al texto cuando se pide desde una sección (plan y manual, el mismo) */
export const prefijoDeSeccion = (seccion: string): string => `Sección «${seccion}»: `

/** PLAN · el texto que viaja: el MISMO que armaba el formulario de antes (con sección, el prefijo al comienzo; la sección sigue en el cuerpo) */
export const textoDelPedidoDelPlan = (nota: string, seccion: string | null): string => (seccion ? `${prefijoDeSeccion(seccion)}${nota}` : nota)

/** MANUAL (A1) · «Sumar a tus cambios»: la nota se suma al MISMO texto libre de «Tus cambios», como hacía «Pedir cambios en esta sección»
 *  (un renglón en blanco entre lo que ya había y lo nuevo). No manda nada: el envío sigue siendo uno solo, abajo (regla del 03-nov). */
export function sumarATusCambios(libre: string, nota: string, seccion: string | null): string {
  const nuevo = seccion ? `${prefijoDeSeccion(seccion)}${nota}` : nota
  return libre.trim() ? `${libre.trimEnd()}\n\n${nuevo}` : nuevo
}

/** la línea bajo la caja: solo cuando hay un mínimo de verdad (más de una letra) */
export const lineaDelMinimo = (minimo: number): string | null => (minimo > 1 ? `Mínimo ${minimo} letras` : null)

/** «Pedir cambios al <documento> · <sección>» · el documento va subrayado en la ventana */
export const ARTICULO_DEL_DOCUMENTO = { Plan: "al", Manual: "al", "Gran idea": "a la", Pieza: "a la" } as const
export type DocumentoDelPedido = keyof typeof ARTICULO_DEL_DOCUMENTO

/** un texto con nombres que van subrayados (los que tienen su explicación en el tablero, como en el boceto) */
export interface TextoConNombres { texto: string; nombres: string[] }

/** parte un texto en trozos, marcando los nombres a subrayar (el primero que aparece gana; sin solaparse) */
export function trozosConNombres({ texto, nombres }: TextoConNombres): Array<{ texto: string; nombre: boolean }> {
  const lista = [...new Set(nombres.filter(Boolean))].sort((a, b) => b.length - a.length)
  if (!lista.length) return [{ texto, nombre: false }]
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return texto.split(new RegExp(`(${lista.map(esc).join("|")})`, "u")).filter((p) => p !== "").map((p) => ({ texto: p, nombre: lista.includes(p) }))
}

/** QUÉ PASA DESPUÉS · lo que pasa HOY en cada panel (sin prometer lo que depende de los colaterales) */
export const QUE_PASA_DESPUES = {
  /** el pie del plan, tal cual dice hoy */
  plan: { texto: "El Jefe de Marketing reescribe el plan con tu nota y la Jefatura lo revisa. Te llega para aprobar. Lo que ya está aprobado no se toca.", nombres: ["Jefe de Marketing", "Jefatura"] },
  /** A1: la nota no sale sola; se suma a «Tus cambios» y sale con «Pedir los cambios» (regla del 03-nov) */
  manual: { texto: "Tu nota queda en «Tus cambios», abajo, con las demás. Cuando pulses «Pedir los cambios», salen todas juntas.", nombres: [] },
  /** B1: cada elección con su línea */
  gran_idea_concepto: { texto: "La mesa de creativos hace otra ronda con tu nota. El brief se queda.", nombres: ["mesa de creativos"] },
  gran_idea_brief: { texto: "Se escribe un brief nuevo y, sobre él, otra gran idea.", nombres: [] },
  /** lo que dice hoy el aviso tras decidir */
  piezas: { texto: "La oficina creativa rehace la pieza con tu nota (solo las láminas que marcaste, si marcaste). La versión nueva te llega a esta bandeja.", nombres: ["oficina creativa"] },
} as const satisfies Record<string, TextoConNombres>

/** PIEZAS · el recuadro de solo lectura «Va con tu nota»: lo que ya marcaste en la pieza viaja con la nota (en la ventana no se marca nada nuevo).
 *  null = no hay nada marcado ni editado (el recuadro no se muestra: la nota va para toda la pieza). */
export function loQueVaConTuNota(marcadas: number, editados: number): string | null {
  const partes: string[] = []
  if (marcadas > 0) partes.push(marcadas === 1 ? "1 lámina marcada" : `${marcadas} láminas marcadas`)
  if (editados > 0) partes.push(editados === 1 ? "1 texto editado" : `${editados} textos editados`)
  return partes.length ? partes.join(" y ") : null
}
