"use client"

import { lazy, Suspense, useEffect, useRef, useState } from "react"
import type { Application, SPEObject } from "@splinetool/runtime"
import {
  CAMARA_Z, ESCENA_SPLINE, HALOS, NOMBRES, aMundo, conviene, escalaDeBrillo, escalaDeHalo, poseDePolvo, poseDePulso,
} from "@/lib/vida-spline"

// la biblioteca de Spline solo se baja cuando hace falta (nunca en móvil ni en el servidor)
const Spline = lazy(() => import("@splinetool/react-spline"))

const hayWebGPU = async () => {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu
    return !!gpu && !!(await gpu.requestAdapter())
  } catch { return false }
}

const hayWebGL = () => {
  try {
    const c = document.createElement("canvas")
    return !!(c.getContext("webgl2") || c.getContext("webgl"))
  } catch { return false }
}

/**
 * La capa de VIDA sobre la foto de la escena (sprint 5): un lienzo 3D transparente de Spline, del tamaño exacto de la foto, que no atrapa el ratón
 * (los clics y el hover siguen siendo de las zonas de la foto). Al cargar, esta capa toma los objetos por su nombre y los mueve cuadro a cuadro
 * con las poses de `lib/vida-spline`; el hover de una zona (`data-zona` en la foto) enciende su halo.
 */
export function VidaSpline() {
  const [montar, setMontar] = useState(false)
  const caja = useRef<HTMLDivElement>(null)
  const zonaBajoElRaton = useRef<string | null>(null)
  const detener = useRef<(() => void) | null>(null)

  useEffect(() => {
    let vivo = true
    const decidir = async () => {
      if (!conviene(window.innerWidth, hayWebGL(), window.matchMedia("(prefers-reduced-motion: reduce)").matches)) return
      // la escena está exportada solo para WebGPU (31-oct): sin adaptador WebGPU el lienzo no pinta nada y es mejor no montarlo (queda la foto sola).
      // Cuando el archivo de Spline se re-exporte con «Renderer: Both», esta puerta se puede abrir a WebGL.
      if (!(await hayWebGPU())) return
      if (vivo) setMontar(true)
    }
    void decidir()
    return () => { vivo = false }
  }, [])

  // el hover de las zonas de la foto (hermanas de esta capa) decide qué halo se ve
  useEffect(() => {
    if (!montar) return
    const contenedor = caja.current?.parentElement
    if (!contenedor) return
    const zonaDe = (e: Event) => (e.target as Element | null)?.closest?.(".nv-zona")?.getAttribute("data-zona") ?? null
    const alEntrar = (e: Event) => { const z = zonaDe(e); if (z) zonaBajoElRaton.current = z }
    const alSalir = (e: Event) => {
      const zona = (e.target as Element | null)?.closest?.(".nv-zona")
      const hacia = (e as PointerEvent).relatedTarget as Node | null
      if (zona && !(hacia && zona.contains(hacia))) zonaBajoElRaton.current = null
    }
    contenedor.addEventListener("pointerover", alEntrar)
    contenedor.addEventListener("pointerout", alSalir)
    return () => { contenedor.removeEventListener("pointerover", alEntrar); contenedor.removeEventListener("pointerout", alSalir) }
  }, [montar])

  useEffect(() => () => { detener.current?.() }, [])

  const alCargar = (app: Application) => {
    detener.current?.()
    // el lienzo debe ser transparente: la foto está debajo
    try { app.setBackgroundColor("rgba(0,0,0,0)") } catch { /* el motor viejo no lo trae */ }
    const busca = (n: string) => app.findObjectByName(n)
    const camara = busca(NOMBRES.camara)
    if (camara) camara.position.z = CAMARA_Z
    // las marcas azules de calibración solo se ven si se piden a mano (?marcas=1); en producción nunca
    const verMarcas = typeof window !== "undefined" && /[?&]marcas=1/.test(window.location.search)
    for (const n of NOMBRES.marcas) { const m = busca(n); if (m) m.visible = verMarcas }
    const pulsos = NOMBRES.pulsos.map(busca)
    const brillos = NOMBRES.brillos.map(busca)
    const polvo = NOMBRES.polvo.map(busca).map((o) => (o ? { o, base: { x: o.position.x, y: o.position.y, z: o.position.z } } : null))
    const halos = new Map<string, SPEObject>()
    for (const [zona, nombre] of Object.entries(HALOS)) { const h = busca(nombre); if (h) { h.visible = false; halos.set(zona, h) } }

    const t0 = performance.now()
    let raf = 0
    const cuadro = (ahora: number) => {
      const t = (ahora - t0) / 1000
      for (let i = 0; i < pulsos.length; i++) {
        const o = pulsos[i]
        if (!o) continue
        const p = poseDePulso(t, i)
        const m = aMundo(p.x, p.y)
        o.position.x = m.x; o.position.y = m.y
        o.scale.x = p.s; o.scale.y = p.s; o.scale.z = p.s
      }
      for (let i = 0; i < brillos.length; i++) {
        const o = brillos[i]
        if (!o) continue
        const s = escalaDeBrillo(t, i)
        o.scale.x = s; o.scale.y = s; o.scale.z = s
      }
      for (let i = 0; i < polvo.length; i++) {
        const m = polvo[i]
        if (!m) continue
        const p = poseDePolvo(t, i, m.base)
        m.o.position.x = p.x; m.o.position.y = p.y; m.o.position.z = p.z
      }
      const activa = zonaBajoElRaton.current
      for (const [zona, h] of halos) {
        const ver = zona === activa
        if (h.visible !== ver) h.visible = ver
        if (ver) { const s = escalaDeHalo(t); h.scale.x = 1.4 * s; h.scale.y = 0.75 * s }
      }
      raf = requestAnimationFrame(cuadro)
    }
    raf = requestAnimationFrame(cuadro)
    detener.current = () => cancelAnimationFrame(raf)
  }

  if (!montar) return null
  return (
    <div ref={caja} data-vida="spline" aria-hidden="true" className="pointer-events-none absolute inset-0">
      <Suspense fallback={null}>
        <Spline scene={ESCENA_SPLINE} onLoad={alCargar} renderOnDemand={false} style={{ width: "100%", height: "100%" }} />
      </Suspense>
    </div>
  )
}
