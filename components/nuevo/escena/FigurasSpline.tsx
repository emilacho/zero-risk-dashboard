"use client"

import { lazy, Suspense, useEffect, useRef, useState } from "react"
import type { Application } from "@splinetool/runtime"
import { ESCENA_AVATARES, MESAS, NOMBRES_SPLINE, alSuelo, respiracion, type Colocacion } from "@/lib/escena-avatares"

// la biblioteca de Spline solo se baja cuando hace falta (nunca en móvil ni en el servidor) · mismo criterio que `VidaSpline`
const Spline = lazy(() => import("@splinetool/react-spline"))

const hayWebGPU = async () => {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu
    return !!gpu && !!(await gpu.requestAdapter())
  } catch { return false }
}

/**
 * LAS FIGURAS 3D (CC6 · Sprint 1): un lienzo transparente de Spline del tamaño exacto de la foto de la oficina, con hasta MAXIMO_DE_FIGURAS figuras iguales de cuerpo
 * completo sentadas (archivo «Zero Risk · avatares de la oficina»). Esta capa NO decide nada: recibe de `Avatares` quién se sienta dónde (`colocarFiguras`) y, cuadro a
 * cuadro, coloca cada figura en el suelo 3D que corresponde a su silla de la foto (`alSuelo`, cámara calibrada en `CAMARA`), la gira hacia el monitor, enciende su luz
 * (ámbar trabajando · roja si falló) y la hace respirar despacio. Las figuras que sobran se esconden. No atrapa el ratón: las fichas y los clics son de `Avatares`.
 * `?marcas=1` muestra las marcas de calibración (una por silla) para ajustar `CAMARA` contra la foto.
 */
export function FigurasSpline({ colocaciones }: { colocaciones: Colocacion[] }) {
  const [montar, setMontar] = useState(false)
  const app = useRef<Application | null>(null)
  const detener = useRef<(() => void) | null>(null)
  const ultimas = useRef<Colocacion[]>(colocaciones)
  ultimas.current = colocaciones

  useEffect(() => {
    let vivo = true
    const decidir = async () => {
      if (!ESCENA_AVATARES || window.innerWidth <= 700) return
      if (!(await hayWebGPU())) return // exportada solo para WebGPU hasta que el archivo se re-exporte con «Renderer: Both»
      if (vivo) setMontar(true)
    }
    void decidir()
    return () => { vivo = false }
  }, [])
  useEffect(() => () => { detener.current?.() }, [])

  const aplicar = (a: Application, cs: Colocacion[]) => {
    const busca = (n: string) => a.findObjectByName(n)
    NOMBRES_SPLINE.figuras.forEach((n, i) => {
      const f = busca(n), la = busca(NOMBRES_SPLINE.luzAmbar[i]), lr = busca(NOMBRES_SPLINE.luzRoja[i])
      const c = cs[i]
      if (!f) return
      f.visible = !!c
      if (la) la.visible = !!c && c.estado === "trabajando"
      if (lr) lr.visible = !!c && c.estado === "fallo"
      if (!c) return
      f.position.x = c.suelo.x; f.position.y = 0; f.position.z = c.suelo.z
      f.rotation.x = 0; f.rotation.y = (c.giro * Math.PI) / 180; f.rotation.z = 0
    })
  }

  const alCargar = (a: Application) => {
    detener.current?.()
    app.current = a
    try { a.setBackgroundColor("rgba(0,0,0,0)") } catch { /* el motor viejo no lo trae */ }
    const verMarcas = /[?&]marcas=1/.test(window.location.search)
    NOMBRES_SPLINE.marcas.forEach((n, i) => { const m = a.findObjectByName(n); if (!m) return; m.visible = verMarcas; const p = alSuelo(MESAS[i].silla); m.position.x = p.x; m.position.y = 0; m.position.z = p.z })
    aplicar(a, ultimas.current)
    const t0 = performance.now()
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let raf = 0
    const cuadro = (ahora: number) => {
      const t = (ahora - t0) / 1000
      if (!quieto) NOMBRES_SPLINE.figuras.forEach((n, i) => { if (!ultimas.current[i]) return; const f = a.findObjectByName(n); if (f) { const s = respiracion(t, i); f.scale.y = s } })
      raf = requestAnimationFrame(cuadro)
    }
    raf = requestAnimationFrame(cuadro)
    detener.current = () => cancelAnimationFrame(raf)
  }
  // cada vez que cambia quién trabaja, se recolocan las figuras
  useEffect(() => { if (app.current) aplicar(app.current, colocaciones) }, [colocaciones])

  if (!montar) return null
  return (
    <div data-figuras="spline" aria-hidden="true" className="pointer-events-none absolute inset-0">
      <Suspense fallback={null}>
        <Spline scene={ESCENA_AVATARES} onLoad={alCargar} renderOnDemand={false} style={{ width: "100%", height: "100%" }} />
      </Suspense>
    </div>
  )
}
