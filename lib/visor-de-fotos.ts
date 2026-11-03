/** LÓGICA PURA DEL VISOR DE FOTOS (CC4 · 03-nov): miniatura liviana, vuelta circular entre fotos y qué hace cada tecla. */

/** una foto de nuestro almacén se pide chica para la miniatura (≈ 4× más liviana); cualquier otra dirección se deja tal cual */
export function miniaturaDe(url: string, ancho = 240): string {
  const m = /^(https:\/\/[^/]+\.supabase\.co)\/storage\/v1\/object\/public\/([^?#]+)$/.exec(url)
  return m ? `${m[1]}/storage/v1/render/image/public/${m[2]}?width=${ancho}&quality=70` : url
}

/** la foto que sigue (1) o la anterior (-1) en un grupo de `n`, dando la vuelta */
export function siguienteFoto(i: number, n: number, d: 1 | -1): number {
  if (n <= 0) return 0
  return (((i + d) % n) + n) % n
}

export function accionDeTecla(tecla: string): "cerrar" | "siguiente" | "anterior" | null {
  if (tecla === "Escape") return "cerrar"
  if (tecla === "ArrowRight") return "siguiente"
  if (tecla === "ArrowLeft") return "anterior"
  return null
}
