/**
 * EL PANEL DERECHO DEL VISOR DE UNA PIEZA (boceto `2-panel-despues.png` aprobado por Emilio 11-nov 21:54 Zúrich · GO Lenovo 21:55).
 * De lo macro a lo micro: chips de estado y avisos · 4 recuadros (Cuándo · Dónde · Video/Láminas · Sede) · Tema · Texto · plegados (Revisión · Equipo · Detalle).
 * Aquí viven solo las cuentas y las frases, sin React, para poder probarlas con datos reales de más de un cliente.
 */
import type { Aviso, VideoDeLaPieza } from "@/lib/piezas"
import type { FilaDeLaPieza } from "@/lib/pieza-acompana"
import { diaConNombre } from "@/lib/calendario"
import { formatoLegible, redDelTablero } from "@/lib/pizarron"
import { fechaYHoraEnPalabras, diaYHora, plural } from "@/lib/lenguaje"

export const mayuscula = (s: string): string => (s ? s.charAt(0).toLocaleUpperCase("es") + s.slice(1) : s)

/** un aviso de la pieza convertido en chip: la palabra corta va en el chip y el texto entero se ve al tocarlo */
export interface ChipDeAviso { corto: string; detalle: string; nivel: "rojo" | "ambar" }

/**
 * El chip de un aviso. Los informativos (el video es generado, cuándo vence el archivo) no son chip: ya los dicen el recuadro «Video» y el plegado «Detalle».
 * Un aviso que no se reconoce NO se pierde: sale con «Aviso» y su texto entero al tocarlo.
 */
export function chipDelAviso(a: Aviso): ChipDeAviso | null {
  if (a.nivel === "info") return null
  const t = a.texto
  const chip = (corto: string): ChipDeAviso => ({ corto, detalle: t, nivel: a.nivel as "rojo" | "ambar" })
  const desac = /^(\d+) desacuerdos? abiertos? en la revisión/.exec(t)
  if (desac) return chip(plural(Number(desac[1]), "desacuerdo", "desacuerdos"))
  if (/^Falló un paso de la revisión|^La revisión de la jefatura no terminó/.test(t)) return chip("Revisión incompleta")
  if (/^Ensayo/.test(t)) return chip("Ensayo")
  if (/^El video quedó solo en el proveedor/.test(t)) return chip("Solo en el proveedor")
  if (/^Sin video/.test(t)) return chip("Sin video")
  if (/^Sin dibujo/.test(t)) return chip("Sin dibujo")
  if (/SIN DIBUJAR/.test(t)) return chip("Sin dibujar")
  if (/^Las láminas .* signos/.test(t)) return chip("Signos que salen vacíos")
  if (/^El resumen de la bandeja/.test(t)) return chip("Faltan imágenes")
  return chip("Aviso")
}

export const chipsDeLosAvisos = (avisos: Aviso[]): ChipDeAviso[] => avisos.map(chipDelAviso).filter((c): c is ChipDeAviso => c !== null)

/** «Lun 16 nov · 10:00» */
export function cuandoDeLaFila(f: FilaDeLaPieza | null): string {
  if (!f?.fecha) return "Sin fecha"
  return `${mayuscula(diaConNombre(f.fecha))}${f.hora ? ` · ${f.hora}` : ""}`
}

/** «Instagram · Reel» */
export function dondeDeLaFila(f: FilaDeLaPieza | null): string {
  return [f?.red ? redDelTablero(f.red).nombre : null, f?.formato ? formatoLegible(f.formato) : null].filter(Boolean).join(" · ") || "—"
}

/** «12 s · generado» · «ensayo» si el brazo no filmó nada · «en el proveedor» si el archivo no se pudo guardar */
export function valorDelVideo(v: VideoDeLaPieza): string {
  const que = v.simulado ? "ensayo" : v.solo_en_proveedor ? "en el proveedor" : "generado"
  return v.segundos != null ? `${v.segundos} s · ${que}` : mayuscula(que)
}

/** «5 · 1080×1350» */
export function valorDeLasLaminas(total: number, ancho: number | null | undefined, alto: number | null | undefined): string {
  return `${total}${ancho && alto ? ` · ${ancho}×${alto}` : ""}`
}

export const sedeDeLaFila = (f: FilaDeLaPieza | null): string => (f?.sede ? mayuscula(f.sede) : "—")

/** «Historia de origen» + «Fachada de Olón, manos con el caldo…»: el tema hasta los dos puntos es el título corto; lo demás, la línea gris */
export function temaPartido(tema: string | null | undefined): { corto: string; linea: string | null } | null {
  const s = String(tema ?? "").trim()
  if (!s) return null
  const i = s.indexOf(":")
  if (i < 0) return { corto: s, linea: null }
  const linea = s.slice(i + 1).trim()
  return { corto: s.slice(0, i).trim() || s, linea: linea ? mayuscula(linea) : null }
}

export const resumenDeLaRevision = (desacuerdos: number): string => (desacuerdos > 0 ? plural(desacuerdos, "desacuerdo", "desacuerdos") : "Sin desacuerdos")

export function resumenDelEquipo(personas: number, aportes: number): string {
  const a = plural(aportes, "aporte", "aportes")
  return personas > 0 ? `${plural(personas, "persona", "personas")} · ${a}` : a
}

/** «vence 17 nov a las 23:28» si el video tiene vencimiento; si no, cuándo entró a la bandeja */
export function resumenDelDetalle(vence: unknown, creada: string): string {
  const v = fechaYHoraEnPalabras(vence)
  return v ? `vence ${v}` : `entró ${diaYHora(creada)}`
}
