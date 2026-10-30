"use client"

import { useSyncExternalStore, type ReactNode } from "react"
import { createPortal } from "react-dom"

const suscribir = () => () => {}

/**
 * Saca la pantalla nueva al <body>. La transición de rutas del dashboard actual deja un `filter` en su contenedor, y con él
 * una capa `fixed` se mide contra ese contenedor (alto casi cero) en vez de contra la ventana. Así no se toca el dashboard actual.
 */
export function CapaNueva({ children }: { children: ReactNode }) {
  const enNavegador = useSyncExternalStore(suscribir, () => true, () => false)
  return enNavegador ? createPortal(children, document.body) : null
}
