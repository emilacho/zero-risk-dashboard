/**
 * LENGUAJE DE NEGOCIO (CC#1 · 29-oct · correcciones D1–D6): el dashboard es para Emilio. Nada de códigos internos ni valores crudos de la base en pantalla.
 * Aquí vive TODA traducción de un valor interno a una frase; si un valor no está en la tabla se dice de forma genérica, nunca se enseña el código.
 */

/** dinero con coma decimal y punto de miles: US$ 1,73 · US$ 1.234,50 */
export function usdES(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—"
  return `US$ ${n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** montos muy chicos (< 1 centavo) con 4 decimales para que no salgan como «US$ 0,00» */
export function usdFinoES(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—"
  return n > 0 && n < 0.01 ? `US$ ${n.toLocaleString("es-EC", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}` : usdES(n)
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const ECUADOR_MS = 5 * 3_600_000

/** «29 oct» en hora de Ecuador */
export function diaCorto(iso: string | Date): string {
  const d = new Date(new Date(iso).getTime() - ECUADOR_MS)
  return Number.isNaN(d.getTime()) ? "—" : `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`
}
/** «29 oct · 06:52» en hora de Ecuador */
export function diaYHora(iso: string | Date): string {
  const d = new Date(new Date(iso).getTime() - ECUADOR_MS)
  if (Number.isNaN(d.getTime())) return "—"
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]} · ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`
}

const FAMILIAS: Array<[RegExp, string]> = [
  [/^carrusel/i, "Carrusel"],
  [/^kit_historias|^historias/i, "Historias"],
  [/^post_img|^post/i, "Publicación con imagen"],
  [/^reel|^video/i, "Video corto"],
]
export function familiaLegible(familia: unknown): string {
  const f = String(familia ?? "")
  for (const [re, t] of FAMILIAS) if (re.test(f)) return t
  return "Pieza"
}

const REDES: Array<[RegExp, string]> = [[/facebook/i, "Facebook"], [/instagram/i, "Instagram"], [/tiktok/i, "TikTok"], [/linkedin/i, "LinkedIn"], [/youtube/i, "YouTube"]]
export function redLegible(texto: unknown): string | null {
  const t = String(texto ?? "")
  for (const [re, n] of REDES) if (re.test(t)) return n
  return null
}

/** «Carrusel Facebook · Zero Risk Seguridad Industrial · 29 oct» (sin BRF, sin versión, sin códigos) */
export function tituloDePieza(p: { familia?: unknown; tituloCrudo?: unknown; cliente?: string | null; creada?: string | Date | null }): string {
  const partes = [[familiaLegible(p.familia), redLegible(p.tituloCrudo)].filter(Boolean).join(" ")]
  if (p.cliente) partes.push(p.cliente)
  if (p.creada) partes.push(diaCorto(p.creada))
  return partes.join(" · ")
}

/** tipos de la bandeja que NO son piezas */
export function tipoDeRevisionLegible(tipo: unknown): string {
  switch (String(tipo ?? "")) {
    case "editor_escalation": return "Revisión del editor"
    case "plan_con_pendientes": return "Plan con puntos por resolver"
    case "confirm_competitor_list": return "Confirmar lista de competidores"
    case "content_piece_review": return "Pieza por aprobar"
    default: return "Revisión"
  }
}

export function estadoDelClienteLegible(estado: unknown): string {
  switch (String(estado ?? "")) {
    case "active": return "Cliente activo"
    case "onboarding": return "Cliente nuevo, en preparación"
    case "paused": return "En pausa"
    case "churned": return "Dado de baja"
    case "prospect": return "Prospecto"
    default: return "Sin estado definido"
  }
}

/** resultado de una revisión de la jefatura */
export function resultadoDeJefaturaLegible(r: unknown): string {
  switch (String(r ?? "")) {
    case "limpia": return "sin observaciones"
    case "con_desacuerdo": return "con desacuerdos"
    case "incompleta_por_tope": return "incompleta: se cortó por tope de gasto"
    case "fallida": return "falló"
    default: return "resultado sin clasificar"
  }
}

/** revisión de fidelidad del manual de marca */
export function revisionDeFidelidadLegible(g: unknown): string {
  switch (String(g ?? "")) {
    case "paso_la_vara": return "Pasó la revisión de fidelidad"
    case "no_paso": case "reprobo": return "No pasó la revisión de fidelidad"
    case "": return "Sin revisión de fidelidad"
    default: return "Revisión de fidelidad sin clasificar"
  }
}

/** pilares de contenido de las campañas */
export function pilarLegible(p: unknown): string {
  switch (String(p ?? "")) {
    case "consulta_entrante": return "consultas entrantes"
    case "educativo": return "contenido educativo"
    case "prueba_social": return "prueba social"
    default: return ""
  }
}

export function estadoDeCampanaLegible(e: unknown): string {
  switch (String(e ?? "")) {
    case "activa": return "en marcha"
    case "borrador": return "en borrador"
    case "pausada": return "en pausa"
    case "terminada": case "cerrada": case "cerrado": return "terminada"
    default: return "en preparación"
  }
}

/** roles de la mesa de especialistas: el nombre técnico del agente nunca sale en pantalla */
export function rolDeLaMesaLegible(agente: unknown): string {
  const a = String(agente ?? "")
  if (/creative-director/.test(a)) return "Director creativo"
  if (/copy|writer|content/.test(a)) return "Redactor"
  if (/design|visual/.test(a)) return "Diseñador"
  if (/brand/.test(a)) return "Guardián de la marca"
  if (/strateg/.test(a)) return "Estratega"
  if (/jefe|reviewer|editor/.test(a)) return "Revisor"
  return "Especialista"
}
export function tipoDeAporteLegible(t: unknown): string {
  switch (String(t ?? "")) {
    case "idea": return "propuso una idea"
    case "critica": return "hizo una crítica"
    case "respuesta": return "respondió"
    case "pieza": return "entregó la pieza"
    case "decision": return "decidió"
    default: return "aportó"
  }
}

export function resultadoDeJefaturaDePiezaLegible(r: string | null): string {
  return r ? resultadoDeJefaturaLegible(r) : "sin revisión registrada"
}

export const plural = (n: number, uno: string, varios: string): string => `${n} ${n === 1 ? uno : varios}`

/** estado de un encargo de la oficina creativa */
export function estadoDeLaPiezaLegible(e: unknown): string {
  const s = String(e ?? "")
  if (s.startsWith("cerrado")) return "entregada"
  if (s === "fallido") return "falló"
  if (s === "") return "sin estado"
  return "en proceso"
}
