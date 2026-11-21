/**
 * 21-nov · el nombre genérico de una campaña sin nombre (Emilio 10:30Z, por Lenovo 10:31Z: «la campaña debe tener nombre al crearse, así sea algo genérico tomado del plan de marketing», sin fecha de inicio).
 * La MISMA regla que la plataforma (`zero-risk-platform · src/lib/cadena/campanas.ts · nombreGenericoDelPlan`): la plataforma lo pone al crear; aquí se entrega AL LEER para las campañas
 * viejas sin nombre, sin escribir en la base. Las dos copias tienen las mismas pruebas con la misma cifra escrita a mano.
 * El primer título «# …» del plan, sin las partes de versión ni de fecha (separadas por «·»); sin título legible, o si no cabe en un nombre (120), el genérico fijo.
 */
export const LARGO_DE_NOMBRE = 120
export const NOMBRE_GENERICO_SIN_PLAN = "Campaña del plan de marketing"
const PARTE_CON_FECHA = /\d{4}-\d{2}-\d{2}|\b\d{1,2}\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b|\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+(de\s+)?\d{4}\b/i

function nombreValido(t: string): string | null {
  // eslint-disable-next-line no-control-regex
  return t.length >= 1 && t.length <= LARGO_DE_NOMBRE && !/[\u0000-\u001f\u007f]/.test(t) ? t : null
}

export function nombreGenericoDelPlan(planTexto: string | null | undefined): string {
  const titulo = String(planTexto ?? "").split("\n").map((l) => l.trim()).find((l) => /^#\s+\S/.test(l))
  if (!titulo) return NOMBRE_GENERICO_SIN_PLAN
  const partes = titulo.replace(/^#\s+/, "").replace(/[*_`]/g, "").split("·").map((p) => p.trim()).filter((p) => p !== "" && !/^versi[oó]n\b/i.test(p) && !PARTE_CON_FECHA.test(p))
  return nombreValido(partes.join(" · ").trim()) ?? NOMBRE_GENERICO_SIN_PLAN
}
