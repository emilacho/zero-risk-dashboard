"use client"

/**
 * EL MARCO DE CADA PANTALLA (CC6 · 03-nov · corrección de Lenovo «al recargar se ve el dashboard viejo morado»).
 * Las pantallas del dashboard nuevo (`/nuevo…`) NO llevan nada del viejo: ni la barra lateral (con sus enlaces a `/`, `/piezas`, `/mapa`…),
 * ni el halo violeta, ni el margen. Antes los dos convivían y, mientras la escena nueva cargaba, se veía el viejo. Como `usePathname` también
 * responde en el servidor, la PRIMERA pintura ya sale sin el viejo (el fondo negro lo pone `globals.css` con `[data-pantalla-nueva]`).
 */
import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { RouteTransition } from "@/components/RouteTransition"
import { Sidebar } from "@/components/Sidebar"
import { esPantallaNueva } from "@/lib/rutas-viejas"

export function MarcoDeLaApp({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  if (esPantallaNueva(pathname)) return <div data-pantalla-nueva className="min-h-screen bg-black">{children}</div>
  return (
    <>
      {/* Lumen v3 · single subtle violet halo · no grid, no noise (solo en el dashboard viejo) */}
      <div className="ambient-halo" aria-hidden />
      <Sidebar />
      <RouteTransition>
        <div className="pl-[64px]">{children}</div>
      </RouteTransition>
    </>
  )
}
