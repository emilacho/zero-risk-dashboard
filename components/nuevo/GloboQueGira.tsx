"use client"

import { useEffect, useRef, useState } from "react"
import { GLOBO, TRAZO_DEL_GLOBO, cajaDelGlobo, giroDelGlobo } from "@/lib/globo-de-la-oficina"

/**
 * 6.18b · el globo holográfico de tu oficina gira despacio sobre su eje, redibujado con un mapa del mundo real en el estilo del holograma (razones en
 * `lib/globo-de-la-oficina.ts`). Capas dentro del lienzo: la iluminación de la propia foto muy desenfocada · la cara de atrás tenue (transparencia) · tierras ·
 * costas · cuadrícula, con halo cálido · y un fundido hacia la foto en el borde, para que el borde brillante y el anillo sigan siendo los de la foto.
 * El mapa (world-atlas 1:110m, ~55 kB) se carga aparte, solo dentro de tu oficina. Con «menos movimiento» se dibuja quieto; con la pestaña oculta no se dibuja.
 * Hasta tener el primer cuadro el lienzo es invisible (se ve la foto). Solo decoración: no se toca, no lee nada del sistema.
 */
const FOTO = { w: 2560, h: 1440, src: "/nuevo/oficina-2560.webp" }
const pct = (n: number, total: number) => `${((n / total) * 100).toFixed(4)}%`
const ESCALA = 3 // píxeles del lienzo por píxel de la foto (nítido también en pantallas grandes)

export function GloboQueGira() {
  const lienzo = useRef<HTMLCanvasElement>(null)
  const [listo, setListo] = useState(false)
  useEffect(() => {
    const cv = lienzo.current
    const ctx = cv?.getContext("2d")
    if (!cv || !ctx) return
    let vivo = true, cuadro = 0
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ;(async () => {
      const [{ geoOrthographic, geoPath, geoGraticule }, { feature }, mundo] = await Promise.all([
        import("d3-geo"), import("topojson-client"), import("world-atlas/land-110m.json"),
      ])
      const img = new Image(); img.decoding = "async"; img.src = FOTO.src
      await img.decode().catch(() => undefined)
      if (!vivo || !img.naturalWidth) return
      const topo = (mundo as { default?: unknown }).default ?? mundo
      const tierra = feature(topo as never, (topo as { objects: { land: never } }).objects.land)
      const cuadricula = geoGraticule().step([GLOBO.paso, GLOBO.paso])()
      const W = cv.width, c = W / 2, R = W / 2 / GLOBO.margen
      // la iluminación: la propia foto del globo, muy desenfocada (queda el color y la luz, no las líneas viejas)
      const base = document.createElement("canvas"); base.width = W; base.height = W
      const b = base.getContext("2d")!
      const caja = cajaDelGlobo()
      b.filter = `blur(${GLOBO.desenfoque * ESCALA}px) brightness(${GLOBO.brilloDeLaBase}) saturate(${GLOBO.saturacionDeLaBase})`
      b.drawImage(img, caja.x, caja.y, caja.w, caja.h, 0, 0, W, W)
      b.filter = "none"
      const frente = geoOrthographic().translate([c, c]).scale(R).clipAngle(90).precision(0.3)
      const atras = geoOrthographic().translate([c, c]).scale(R).clipAngle(90).precision(0.3)
      const pF = geoPath(frente, ctx), pA = geoPath(atras, ctx)
      const T = TRAZO_DEL_GLOBO
      // la trama de puntitos de las tierras
      const tile = document.createElement("canvas"), lado = Math.max(2, Math.round(T.puntos.paso * ESCALA)); tile.width = lado; tile.height = lado
      const tc = tile.getContext("2d")!; tc.fillStyle = T.puntos.color; tc.beginPath(); tc.arc(lado / 2, lado / 2, T.puntos.radio * ESCALA, 0, Math.PI * 2); tc.fill()
      const trama = ctx.createPattern(tile, "repeat")!
      // los cruces que destellan: fijos sobre el globo (giran con él), elegidos una vez
      const cruces: [number, number][] = []
      for (let lon = -180; lon < 180; lon += GLOBO.paso) for (let lat = -75; lat <= 75; lat += GLOBO.paso) {
        const h = Math.abs(Math.sin(lon * 12.9898 + lat * 78.233) * 43758.5453) % 1
        if (h < T.destellos.proporcion) cruces.push([lon, lat])
      }
      const pintar = (segundos: number) => {
        const [l, f, g] = giroDelGlobo(segundos)
        frente.rotate([l, f, g])
        atras.rotate([l + 180, -f, g]) // la cara de atrás, vista a través del holograma (en espejo)
        ctx.save()
        ctx.clearRect(0, 0, W, W)
        ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.clip()
        ctx.drawImage(base, 0, 0)
        ctx.lineJoin = "round"; ctx.lineCap = "round"
        ctx.save(); ctx.globalAlpha = T.atras; ctx.translate(W, 0); ctx.scale(-1, 1)
        ctx.beginPath(); pA(cuadricula); ctx.strokeStyle = T.cuadricula; ctx.lineWidth = T.grosorCuadricula * ESCALA; ctx.stroke()
        ctx.beginPath(); pA(tierra); ctx.strokeStyle = T.costa; ctx.lineWidth = T.grosorCosta * ESCALA; ctx.stroke()
        ctx.restore()
        ctx.shadowColor = T.halo; ctx.shadowBlur = T.radioHalo * ESCALA
        ctx.beginPath(); pF(tierra); ctx.fillStyle = T.tierra; ctx.fill()
        ctx.save(); ctx.shadowBlur = 0; ctx.fillStyle = trama; ctx.fill(); ctx.restore()
        ctx.shadowBlur = T.radioHalo * 0.5 * ESCALA; ctx.strokeStyle = T.costa; ctx.lineWidth = T.grosorCosta * ESCALA; ctx.stroke(); ctx.shadowBlur = T.radioHalo * ESCALA
        ctx.beginPath(); pF(cuadricula); ctx.strokeStyle = T.cuadricula; ctx.lineWidth = T.grosorCuadricula * ESCALA; ctx.stroke()
        // los destellos en los cruces de la cara de enfrente
        ctx.fillStyle = T.destellos.color; ctx.shadowBlur = T.radioHalo * 0.8 * ESCALA
        for (const q of cruces) {
          const pt = frente(q); if (!pt) continue
          const [x, y] = pt; if (Math.hypot(x - c, y - c) > R * 0.97) continue
          ctx.beginPath(); ctx.arc(x, y, T.destellos.radio * ESCALA, 0, Math.PI * 2); ctx.fill()
        }
        // el haz vertical del pedestal: quieto, como en la foto, con su destello en cruz
        ctx.shadowBlur = T.radioHalo * ESCALA
        const haz = ctx.createLinearGradient(0, c - R, 0, c + R); haz.addColorStop(0, T.haz.arriba); haz.addColorStop(1, T.haz.abajo)
        ctx.beginPath(); ctx.moveTo(c, c - R); ctx.lineTo(c, c + R); ctx.strokeStyle = haz; ctx.lineWidth = T.haz.ancho * ESCALA; ctx.stroke()
        const yd = c + R * T.haz.destelloEn, ld = R * T.haz.destelloLargo
        const cruz = ctx.createLinearGradient(c - ld, 0, c + ld, 0); cruz.addColorStop(0, "rgba(255,220,160,0)"); cruz.addColorStop(0.5, T.haz.abajo); cruz.addColorStop(1, "rgba(255,220,160,0)")
        ctx.beginPath(); ctx.moveTo(c - ld, yd); ctx.lineTo(c + ld, yd); ctx.strokeStyle = cruz; ctx.lineWidth = T.haz.ancho * 0.8 * ESCALA; ctx.stroke()
        const nucleo = ctx.createRadialGradient(c, yd, 0, c, yd, R * 0.09); nucleo.addColorStop(0, "rgba(255,250,235,1)"); nucleo.addColorStop(1, "rgba(255,200,120,0)")
        ctx.fillStyle = nucleo; ctx.beginPath(); ctx.arc(c, yd, R * 0.09, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
        ctx.save(); ctx.globalCompositeOperation = "destination-in"
        const m = ctx.createRadialGradient(c, c, R * GLOBO.fundido.desde, c, c, R * GLOBO.fundido.hasta)
        m.addColorStop(0, "rgba(0,0,0,1)"); m.addColorStop(1, "rgba(0,0,0,0)")
        ctx.fillStyle = m; ctx.fillRect(0, 0, W, W); ctx.restore()
      }
      const t0 = performance.now()
      let ultimo = 0
      const dibujar = (ahora: number) => {
        if (!vivo) return
        cuadro = requestAnimationFrame(dibujar)
        if (document.hidden || ahora - ultimo < 1000 / GLOBO.cuadros) return
        ultimo = ahora
        pintar((ahora - t0) / 1000)
      }
      pintar(0); setListo(true)
      if (!quieto) cuadro = requestAnimationFrame(dibujar)
    })().catch(() => undefined)
    return () => { vivo = false; cancelAnimationFrame(cuadro) }
  }, [])
  const c = cajaDelGlobo()
  return (
    <canvas ref={lienzo} className="nv-globo pointer-events-none absolute" aria-hidden="true" data-listo={listo} width={Math.round(c.w * ESCALA)} height={Math.round(c.w * ESCALA)}
      style={{ left: pct(c.x, FOTO.w), top: pct(c.y, FOTO.h), width: pct(c.w, FOTO.w), height: pct(c.h, FOTO.h), opacity: listo ? 1 : 0, transition: "opacity .6s ease" }} />
  )
}
