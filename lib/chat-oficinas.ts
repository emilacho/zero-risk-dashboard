/**
 * Piezas puras del cuadro de chat de /nuevo («Habla con tus oficinas…»): leer el flujo de eventos del servidor y dejar un texto apto para leerlo en voz alta.
 * Sin navegador ni red aquí, para poder probarlas sin pantalla.
 */

export interface EventoDeChat {
  event: string
  data: Record<string, unknown>
}

/** Parte el texto recibido en eventos completos (cada uno termina en línea vacía); devuelve los eventos y lo que sobra sin terminar. */
export function leerEventos(pendiente: string): { eventos: EventoDeChat[]; resto: string } {
  const eventos: EventoDeChat[] = []
  const limpio = pendiente.replace(/\r\n/g, "\n")
  const bloques = limpio.split("\n\n")
  const resto = bloques.pop() ?? ""
  for (const bloque of bloques) {
    let event = "message"
    const datos: string[] = []
    for (const linea of bloque.split("\n")) {
      if (linea.startsWith(":")) continue
      if (linea.startsWith("event:")) event = linea.slice(6).trim()
      else if (linea.startsWith("data:")) datos.push(linea.slice(5).trim())
    }
    if (datos.length === 0) continue
    try {
      const data = JSON.parse(datos.join("\n")) as unknown
      if (data && typeof data === "object") eventos.push({ event, data: data as Record<string, unknown> })
    } catch {
      /* un evento roto no tumba la conversación */
    }
  }
  return { eventos, resto }
}

/** Quita lo que suena mal al leerlo (marcas de markdown, viñetas, enlaces) y recorta a lo que cabe razonablemente en voz. */
export function textoParaVoz(texto: string, maximo = 700): string {
  const limpio = texto
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/[*_~>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  if (limpio.length <= maximo) return limpio
  const corte = limpio.slice(0, maximo)
  const punto = Math.max(corte.lastIndexOf(". "), corte.lastIndexOf("? "), corte.lastIndexOf("! "))
  return (punto > maximo * 0.5 ? corte.slice(0, punto + 1) : corte).trim()
}

export interface PedidoPropuesto {
  titulo: string
  detalle: string
}

/** Lee la herramienta `proponer_pedido` sin fiarse de lo que trae: solo textos, con largo acotado. */
export function leerPedido(input: Record<string, unknown> | undefined): PedidoPropuesto | null {
  const titulo = typeof input?.titulo === "string" ? input.titulo.trim().slice(0, 140) : ""
  const detalle = typeof input?.detalle === "string" ? input.detalle.trim().slice(0, 1500) : ""
  return titulo && detalle ? { titulo, detalle } : null
}
