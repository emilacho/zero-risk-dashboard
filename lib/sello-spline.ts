/**
 * EL SELLO «BUILT WITH SPLINE» (CC4 · 03-nov · auditoría n.º 19): el visor lo pone como un enlace (id «logo» o a spline.design) y no siempre dentro del contenedor
 * de la escena; también puede colgar de un shadow root abierto. Esta limpieza lo busca en TODA la página (y en los shadow roots abiertos) y lo quita; las dos escenas
 * (VidaSpline y FigurasSpline) la repiten con un MutationObserver mientras estén montadas, así que sobrevive a recargas y a re-montajes.
 */
export const SELECTOR_DEL_SELLO = 'a#logo, a[href*="spline.design"], #logo[href], a[href*="spline.design/"]'

interface Raiz { querySelectorAll: (s: string) => Iterable<{ remove: () => void; shadowRoot?: Raiz | null }> }

/** quita el sello de `raiz` y de los shadow roots abiertos que cuelguen de ella; devuelve cuántos quitó */
export function quitarSelloDeSpline(raiz: Raiz, profundidad = 0): number {
  let n = 0
  for (const a of [...raiz.querySelectorAll(SELECTOR_DEL_SELLO)]) { a.remove(); n++ }
  if (profundidad < 3) for (const e of [...raiz.querySelectorAll("*")]) if (e.shadowRoot) n += quitarSelloDeSpline(e.shadowRoot, profundidad + 1)
  return n
}

/** vigila la página mientras la escena esté montada; devuelve la función que deja de vigilar */
export function vigilarSelloDeSpline(doc: Document = document): () => void {
  quitarSelloDeSpline(doc)
  const obs = new MutationObserver(() => { quitarSelloDeSpline(doc) })
  obs.observe(doc.body, { childList: true, subtree: true })
  return () => obs.disconnect()
}

/** la regla de estilo que lo esconde desde el primer cuadro (antes de que la limpieza lo alcance) */
export const ESTILO_DEL_SELLO = 'a#logo,a[href*="spline.design"],#logo[href]{display:none!important;visibility:hidden!important}'
