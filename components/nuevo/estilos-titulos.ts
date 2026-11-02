/**
 * 6.43 · UNA sola escala de títulos para Dinero y la vista del cliente (pedido de Emilio: simetría, tamaño y contraste; el título nunca más chico
 * ni más tenue que su subcategoría). De mayor a menor: título de sección > rótulo de tarjeta > subcategoría / encabezado de tabla.
 */
/** título de cada sección (Lo que tienes que saber, Preguntas sugeridas, Detalle, Desglose…) */
export const TITULO_SECCION = "text-[15px] font-medium uppercase tracking-[0.12em] text-[#ffc07a]"
/** rótulo de una tarjeta (Gasto del período, Freno 24 h…): más chico que el título, pero claro */
export const ROTULO_TARJETA = "text-[12.5px] font-medium uppercase tracking-[0.08em] text-zinc-200"
/** subcategoría dentro de una sección (Qué pasó · Por qué · Qué conviene) */
export const SUBCATEGORIA = "text-[12px] font-medium uppercase tracking-[0.08em] text-[#f0a060]"
/** encabezado de columna de una tabla */
export const ENCABEZADO_TABLA = "text-[11.5px] font-medium uppercase tracking-[0.06em] text-zinc-300"
