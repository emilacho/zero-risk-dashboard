"use client"

import { useEffect, useRef, useState } from "react"
import { GLOBO, SOMBREADOR_DE_COLOR, SOMBREADOR_DE_VERTICES, cajaDelGlobo } from "@/lib/globo-de-la-oficina"

/**
 * 6.18 · el globo holográfico de tu oficina gira despacio sobre su eje (cuenta y razones en `lib/globo-de-la-oficina.ts`). Un lienzo WebGL justo encima del
 * globo de la foto toma sus propios píxeles y los hace correr sobre la esfera. Arranca en el ángulo 0 (idéntico a la foto) y aparece con un fundido, así
 * no hay salto. Sin WebGL, con «menos movimiento» o con la pestaña oculta, no gira: se ve la foto tal cual. Solo decoración: no se toca, no lee nada.
 */
const FOTO = { w: 2560, h: 1440, src: "/nuevo/oficina-2560.jpg" }
const pct = (n: number, total: number) => `${((n / total) * 100).toFixed(4)}%`

export function GloboQueGira() {
  const lienzo = useRef<HTMLCanvasElement>(null)
  const [listo, setListo] = useState(false)
  useEffect(() => {
    const cv = lienzo.current
    if (!cv || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const gl = cv.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false })
    if (!gl) return
    let vivo = true, cuadro = 0
    const compilar = (tipo: number, fuente: string) => { const s = gl.createShader(tipo)!; gl.shaderSource(s, fuente); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null }
    const vs = compilar(gl.VERTEX_SHADER, SOMBREADOR_DE_VERTICES), fs = compilar(gl.FRAGMENT_SHADER, SOMBREADOR_DE_COLOR)
    if (!vs || !fs) return
    const prog = gl.createProgram()!; gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
    gl.useProgram(prog)
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(prog, "a_pos"); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
    const u = (n: string) => gl.getUniformLocation(prog, n)
    gl.uniform1f(u("u_margen"), GLOBO.margen); gl.uniform2f(u("u_tam"), FOTO.w, FOTO.h); gl.uniform3f(u("u_globo"), GLOBO.cx, GLOBO.cy, GLOBO.r)
    gl.uniform1f(u("u_inclinacion"), GLOBO.inclinacion); gl.uniform2f(u("u_fundido"), GLOBO.fundido.desde, GLOBO.fundido.hasta); gl.uniform1f(u("u_nitido"), GLOBO.nitido); gl.uniform1f(u("u_empalme"), GLOBO.empalme)
    const uTheta = u("u_theta")
    const img = new Image()
    img.decoding = "async"
    img.onload = () => {
      if (!vivo) return
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img)
      gl.viewport(0, 0, cv.width, cv.height)
      let angulo = 0, antes = performance.now()
      const velocidad = (2 * Math.PI) / GLOBO.segundosPorVuelta
      const dibujar = (ahora: number) => {
        if (!vivo) return
        if (!document.hidden) angulo += (Math.min(ahora - antes, 100) / 1000) * velocidad // tras una pausa larga no salta
        antes = ahora
        gl.uniform1f(uTheta, angulo)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        cuadro = requestAnimationFrame(dibujar)
      }
      gl.uniform1f(uTheta, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); setListo(true)
      cuadro = requestAnimationFrame(dibujar)
    }
    img.src = FOTO.src
    return () => { vivo = false; cancelAnimationFrame(cuadro) }
  }, [])
  const c = cajaDelGlobo()
  return (
    <canvas ref={lienzo} className="nv-globo pointer-events-none absolute" aria-hidden="true" data-listo={listo} width={Math.round(c.w * 2)} height={Math.round(c.h * 2)}
      style={{ left: pct(c.x, FOTO.w), top: pct(c.y, FOTO.h), width: pct(c.w, FOTO.w), height: pct(c.h, FOTO.h), opacity: listo ? 1 : 0, transition: "opacity .6s ease" }} />
  )
}
