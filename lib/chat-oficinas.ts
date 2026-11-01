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

/**
 * La CAUSA que se le muestra a Emilio cuando el asistente no puede responder (01-nov · el genérico «No pude responder ahora» no decía nada).
 * Recibe lo que el servidor puso en el evento `error` (`message`, y de Anthropic `status` y `details`) o lo que vio el navegador (`http` si la respuesta no era el flujo de eventos).
 * Nunca devuelve datos secretos: solo la clase de problema, el código HTTP y el motivo corto que da el proveedor.
 */
export function causaDelFallo(d: { message?: unknown; status?: unknown; details?: unknown; http?: number } = {}): string {
  const msg = String(d.message ?? "")
  const status = Number(d.status)
  if (msg === "unauthenticated" || d.http === 401) return "Tu sesión venció: vuelve a entrar para conversar."
  if (msg === "forbidden" || d.http === 403) return "Tu usuario no tiene permiso de administrador para este chat (403)."
  if (msg === "anthropic_api_key_missing") return "El servidor no tiene la llave del asistente (ANTHROPIC_API_KEY): hay que ponerla en las variables del dashboard."
  if (msg === "invalid_json" || msg === "message_empty_or_too_long" || msg === "session_id_required") return `El servidor no aceptó el mensaje (${msg}).`
  if (msg === "anthropic_api_error") {
    let tipo = ""
    let motivo = ""
    try {
      const j = JSON.parse(String(d.details ?? "")) as { error?: { type?: string; message?: string } }
      tipo = String(j?.error?.type ?? "")
      motivo = String(j?.error?.message ?? "").replace(/sk-[A-Za-z0-9_-]+/g, "***").slice(0, 160)
    } catch { /* el proveedor no devolvió JSON */ }
    if (status === 401 || tipo === "authentication_error") return "El proveedor del asistente rechazó la llave del dashboard (401): hay que cambiarla en las variables del dashboard."
    if (/credit balance|saldo|billing/i.test(motivo)) return "El proveedor del asistente dice que no hay saldo (revisa la facturación de Anthropic)."
    if (status === 403 || tipo === "permission_error") return "El proveedor del asistente no permite esta llave para este modelo (403)."
    if (status === 404 || tipo === "not_found_error") return "El proveedor del asistente no encuentra el modelo (404)."
    if (status === 429 || tipo === "rate_limit_error") return "El proveedor del asistente pide esperar un momento (429, demasiadas peticiones)."
    if (status === 529 || tipo === "overloaded_error" || status >= 500) return `El proveedor del asistente está saturado o caído (${status || "5xx"}). Inténtalo de nuevo en un momento.`
    return `El proveedor del asistente respondió ${status || "con un error"}${motivo ? `: ${motivo}` : ""}.`
  }
  if (d.http && d.http >= 500) return `El servidor del dashboard falló (${d.http}). Inténtalo de nuevo en un momento.`
  if (d.http && d.http >= 400) return `El servidor del dashboard rechazó el mensaje (${d.http}).`
  if (msg === "sin_conexion") return "No llegué al servidor: revisa tu conexión."
  if (msg === "stream_interrupted") return "La respuesta se cortó a la mitad. Inténtalo de nuevo."
  return `No pude responder${msg ? ` (${msg.slice(0, 120)})` : ""}. Inténtalo de nuevo en un momento.`
}
