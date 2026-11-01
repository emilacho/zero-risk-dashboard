"use client"

import { lazy, Suspense, useEffect, useRef, useState } from "react"
import type { Application } from "@splinetool/runtime"
import { CAMARA_Z, ESCENA_SPLINE, NOMBRES, aMundo, conviene, poseDePulso } from "@/lib/vida-spline"

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
 * La capa de VIDA sobre la foto de la escena (sprint 5 · corrección 5.1): un lienzo 3D transparente de Spline, del tamaño exacto de la foto,
 * que no atrapa el ratón (los clics y el hover siguen siendo de las zonas de la foto). Al cargar, esta capa toma los diez pulsos por su
 * nombre y los mueve cuadro a cuadro por los trazos de circuito de la foto con las poses de `lib/vida-spline`. Todo lo demás que quedó en
 * el archivo de Spline (polvo, brillos, halos, marcas) se OCULTA al cargar: en pantalla solo hay pulsos sobre circuitos.
 */
export function VidaSpline() {
  const [montar, setMontar] = useState(false)
  const detener = useRef<(() => void) | null>(null)

  useEffect(() => {
    let vivo = true
    const decidir = async () => {
      // la biblioteca de Spline pesa varios MB: espera a que las fotos y la pantalla estén listas (carga + un respiro) para no competir con ellas por la red
      if (document.readyState !== "complete") await new Promise<void>((r) => window.addEventListener("load", () => r(), { once: true }))
      await new Promise<void>((r) => setTimeout(r, 1200))
      if (!vivo) return
      if (!conviene(window.innerWidth, hayWebGL(), window.matchMedia("(prefers-reduced-motion: reduce)").matches)) return
      // la escena está exportada solo para WebGPU (31-oct): sin adaptador WebGPU el lienzo no pinta nada y es mejor no montarlo (queda la foto sola).
      // Cuando el archivo de Spline se re-exporte con «Renderer: Both», esta puerta se puede abrir a WebGL.
      if (!(await hayWebGPU())) return
      if (vivo) setMontar(true)
    }
    void decidir()
    return () => { vivo = false }
  }, [])

  useEffect(() => () => { detener.current?.() }, [])
  // el sello «Built with Spline» lo pone el propio visor (un enlace con id «logo» dentro del contenedor): se quita al aparecer (Emilio 01-nov, encargo de Lenovo 21:14Z)
  useEffect(() => {
    if (!montar) return
    const quitar = () => document.querySelectorAll('[data-vida="spline"] a#logo, [data-vida="spline"] a[href*="spline.design"]').forEach((a) => a.remove())
    quitar()
    const obs = new MutationObserver(quitar)
    const raiz = document.querySelector('[data-vida="spline"]')
    if (raiz) obs.observe(raiz, { childList: true, subtree: true })
    return () => obs.disconnect()
  }, [montar])

  const alCargar = (app: Application) => {
    detener.current?.()
    // el lienzo debe ser transparente: la foto está debajo
    try { app.setBackgroundColor("rgba(0,0,0,0)") } catch { /* el motor viejo no lo trae */ }
    const busca = (n: string) => app.findObjectByName(n)
    const camara = busca(NOMBRES.camara)
    if (camara) camara.position.z = CAMARA_Z
    // todo lo que no es pulso se oculta (quedó en el archivo de Spline, pero en pantalla no va)
    for (const n of NOMBRES.ocultos) { const o = busca(n); if (o) o.visible = false }
    // las marcas azules de calibración solo se ven si se piden a mano (?marcas=1); en producción nunca
    const verMarcas = typeof window !== "undefined" && /[?&]marcas=1/.test(window.location.search)
    for (const n of NOMBRES.marcas) { const m = busca(n); if (m) m.visible = verMarcas }
    // los pulsos cuelgan de un grupo del archivo de Spline: si ese grupo trae su propio desplazamiento, giro o escala, las posiciones que
    // mandamos (relativas al grupo) salen corridas respecto de los circuitos de la foto (medido 31-oct: 30-80 unidades). Se resetea el grupo
    // y se fija la profundidad de cada pulso en 0 (el plano calibrado de la cámara).
    for (const n of NOMBRES.grupos) {
      const g = busca(n)
      if (!g) continue
      g.position.x = 0; g.position.y = 0; g.position.z = 0
      g.rotation.x = 0; g.rotation.y = 0; g.rotation.z = 0
      g.scale.x = 1; g.scale.y = 1; g.scale.z = 1
    }
    const pulsos = NOMBRES.pulsos.map(busca)
    if (verMarcas) {
      const g = busca(NOMBRES.grupos[0]), p1 = pulsos[0]
      console.info("[vida] grupo", g && { p: g.position, r: g.rotation, s: g.scale }, "pulso 1", p1 && { p: p1.position, s: p1.scale })
    }

    const t0 = performance.now()
    let raf = 0
    const cuadro = (ahora: number) => {
      const t = (ahora - t0) / 1000
      for (let i = 0; i < pulsos.length; i++) {
        const o = pulsos[i]
        if (!o) continue
        const p = poseDePulso(t, i)
        const m = aMundo(p.x, p.y)
        o.position.x = m.x; o.position.y = m.y; o.position.z = 0
        o.scale.x = p.s; o.scale.y = p.s; o.scale.z = p.s
      }
      raf = requestAnimationFrame(cuadro)
    }
    raf = requestAnimationFrame(cuadro)
    detener.current = () => cancelAnimationFrame(raf)
  }

  if (!montar) return null
  return (
    <div data-vida="spline" aria-hidden="true" className="pointer-events-none absolute inset-0">
      <style>{`[data-vida="spline"] a#logo,[data-vida="spline"] a[href*="spline.design"]{display:none!important}`}</style>
      <Suspense fallback={null}>
        <Spline scene={ESCENA_SPLINE} onLoad={alCargar} renderOnDemand={false} style={{ width: "100%", height: "100%" }} />
      </Suspense>
    </div>
  )
}
