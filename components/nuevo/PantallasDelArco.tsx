"use client"

import { useCallback, useEffect, useState, type CSSProperties } from "react"
import { createPortal } from "react-dom"
import { CENTROS, PANTALLAS_VIVAS, cajaDeLaForma, cifraDeLaPantalla, type CifrasDelArco, type ClaveDeCentro, type Glifo } from "@/lib/pantallas-de-la-oficina"
import { PanelPiezas } from "@/components/nuevo/PanelPiezas"
import { PanelGranIdea } from "@/components/nuevo/PanelGranIdea"
import { PanelInformes } from "@/components/nuevo/PanelInformes"
import { PanelEnVivo } from "@/components/nuevo/PanelEnVivo"
import { PanelEquipo } from "@/components/nuevo/PanelEquipo"
import { PanelPizarron } from "@/components/nuevo/PanelPizarron"

/**
 * EL ARCO DE PANTALLAS DE TU OFICINA (sprint 6.14 · Emilio, 1-nov): cada pantalla encendida es un centro de comando distinto. En la pantalla se ve un dibujo mínimo
 * animado en su propio tono de naranja (cada centro, uno distinto) y, en dos de ellas, una cifra viva (piezas por aprobar · trabajos de hoy). Al pasar el ratón la
 * pantalla se aviva y aparece su rótulo con las letras de la marca; al tocarla, el centro se abre ENCIMA de la oficina (como el Centro de campaña en marketing),
 * sin cambiar de dirección; Esc cierra el centro y te deja en tu oficina. Coordenadas en píxeles de la foto 2560×1440. Se monta DENTRO de la proyección de tu oficina.
 * Nada escribe aquí: dos lecturas livianas (bandeja pendiente · en vivo) solo para las cifras; si fallan, queda el dibujo.
 */
const FOTO = { w: 2560, h: 1440 }
const TAM_ROTULO = 30

const ESTILO = `
.nv-arco{cursor:pointer;outline:none;pointer-events:auto}
.nv-arco polygon.nv-vidrio{fill:transparent;stroke:none}
.nv-arco .nv-aviva{fill:var(--tono);opacity:.14;mix-blend-mode:screen;transition:opacity .5s ease;pointer-events:none}
.nv-arco:hover .nv-aviva,.nv-arco:focus-visible .nv-aviva{opacity:.42}
.nv-arco .nv-glifo{color:var(--tono);mix-blend-mode:screen;pointer-events:none}
.nv-arco .nv-rotulo{opacity:0;transform:translateY(5px);transition:opacity .45s ease,transform .45s ease;pointer-events:none}
.nv-arco:hover .nv-rotulo,.nv-arco:focus-visible .nv-rotulo{opacity:1;transform:translateY(0)}
.nv-glifo [data-anima="flota"]{animation:nvFlota 4.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.nv-glifo [data-anima="late"]{animation:nvLate 3.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.nv-glifo [data-anima="crece"]{animation:nvCrece 5s ease-in-out infinite;transform-box:fill-box;transform-origin:bottom}
.nv-glifo [data-anima="corre"]{animation:nvCorre 3s linear infinite}
.nv-glifo [data-anima="parpadea"]{animation:nvParpadea 2.8s ease-in-out infinite}
@keyframes nvFlota{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
@keyframes nvLate{0%,100%{transform:scale(1);opacity:.55}50%{transform:scale(1.35);opacity:.05}}
@keyframes nvCrece{0%,100%{transform:scaleY(.55)}50%{transform:scaleY(1)}}
@keyframes nvCorre{to{stroke-dashoffset:-120}}
@keyframes nvParpadea{0%,100%{opacity:.25}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){.nv-glifo [data-anima]{animation:none}.nv-arco .nv-aviva,.nv-arco .nv-rotulo{transition:none}}
`

/* ─── los dibujos mínimos: cada uno dentro de la caja de su pantalla ─── */
function DibujoDelGlifo({ glifo, x, y, w, h }: { glifo: Glifo; x: number; y: number; w: number; h: number }) {
  const cx = x + w / 2, cy = y + h / 2, u = Math.min(w, h) / 10 // unidad: un décimo del lado corto
  switch (glifo) {
    case "tarjetas": // la bandeja: tres láminas apiladas que flotan por turnos
      return <g fill="currentColor">{[0, 1, 2].map((i) => <rect key={i} data-anima="flota" style={{ animationDelay: `${i * 0.7}s` }} x={cx - u * 3.2 + i * u * 0.6} y={cy - u * 2.6 + i * u * 1.1} width={u * 5.2} height={u * 1.6} rx={u * 0.25} opacity={0.35 + i * 0.25} />)}</g>
    case "chispa": // la gran idea: un punto y dos anillos que respiran
      return <g fill="none" stroke="currentColor" strokeWidth={u * 0.35}><circle cx={cx} cy={cy - u} r={u * 0.9} fill="currentColor" stroke="none" /><circle data-anima="late" cx={cx} cy={cy - u} r={u * 2.2} /><circle data-anima="late" style={{ animationDelay: "1.2s" }} cx={cx} cy={cy - u} r={u * 3.4} /></g>
    case "barras": // los informes: cuatro barras que suben y bajan
      return <g fill="currentColor">{[0.5, 0.8, 0.65, 1].map((a, i) => <rect key={i} data-anima="crece" style={{ animationDelay: `${i * 0.6}s` }} x={cx - u * 3.4 + i * u * 1.9} y={cy + u * 2.8 - a * u * 5} width={u * 1.2} height={a * u * 5} rx={u * 0.2} opacity={0.85} />)}</g>
    case "onda": { // en vivo: una onda que corre
      const p = [-4, -2.6, -1.2, 0, 1.2, 2.6, 4].map((k, i) => `${(cx + k * u).toFixed(1)},${(cy - u + (i % 2 ? -1 : 1) * (i === 3 ? 2.6 : 1.2) * u).toFixed(1)}`).join(" ")
      return <polyline data-anima="corre" points={p} fill="none" stroke="currentColor" strokeWidth={u * 0.45} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="14 6" />
    }
    case "puntos": // el equipo: cinco puntos que se encienden por turnos
      return <g fill="currentColor">{[0, 1, 2, 3, 4].map((i) => <circle key={i} data-anima="parpadea" style={{ animationDelay: `${i * 0.45}s` }} cx={cx - u * 3.2 + i * u * 1.6} cy={cy - u * 0.5} r={u * 0.55} />)}</g>
    case "rejilla": // el calendario: una rejilla de días, uno encendido a la vez
      return <g fill="currentColor">{Array.from({ length: 12 }, (_, i) => <circle key={i} data-anima="parpadea" style={{ animationDelay: `${(i * 0.9) % 3.6}s` }} cx={cx - u * 2.4 + (i % 4) * u * 1.6} cy={cy - u * 2.2 + Math.floor(i / 4) * u * 1.6} r={u * 0.42} />)}</g>
  }
}

/* ─── el centro que abre cada pantalla (todos ya existen en el estilo nuevo; ninguno enlaza al dashboard viejo) ─── */
function PanelDelCentro({ clave, pieza, cerrar, abrirPieza }: { clave: ClaveDeCentro; pieza: string | null; cerrar: () => void; abrirPieza: (id: string) => void }) {
  switch (clave) {
    case "bandeja": return <PanelPiezas onCerrar={cerrar} piezaInicial={pieza} />
    case "gran_idea": return <PanelGranIdea onCerrar={cerrar} />
    case "informes": return <PanelInformes onCerrar={cerrar} />
    case "en_vivo": return <PanelEnVivo onCerrar={cerrar} />
    case "equipo": return <PanelEquipo onCerrar={cerrar} />
    case "calendario": return <PanelPizarron onCerrar={cerrar} onAbrirPieza={abrirPieza} />
  }
}

export function PantallasDelArco({ fetchImpl = fetch, cifrasIniciales = null }: { fetchImpl?: typeof fetch; cifrasIniciales?: CifrasDelArco | null }) {
  const [centro, setCentro] = useState<{ clave: ClaveDeCentro; pieza: string | null } | null>(null)
  const [cifras, setCifras] = useState<CifrasDelArco>(cifrasIniciales ?? {})
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])

  // las cifras vivas: dos lecturas livianas al abrir la oficina; cualquier fallo deja la pantalla con su dibujo
  useEffect(() => {
    if (cifrasIniciales) return
    let vivo = true
    const leer = async (url: string) => { try { const r = await fetchImpl(url, { cache: "no-store" }); if (!r.ok) return null; return (await r.json().catch(() => null)) as Record<string, unknown> | null } catch { return null } }
    void Promise.all([leer("/api/bandeja?estado=pendiente"), leer("/api/en-vivo?limite=1")]).then(([b, v]) => {
      if (!vivo) return
      const c: CifrasDelArco = {}
      if (b && b.ok === true && typeof b.por_aprobar === "number") c.por_aprobar = b.por_aprobar
      if (v && v.ok === true && typeof v.hoy === "number") c.hoy = v.hoy
      setCifras(c)
    })
    return () => { vivo = false }
  }, [fetchImpl, cifrasIniciales])

  const cerrar = useCallback(() => setCentro(null), [])
  const abrirPieza = useCallback((id: string) => setCentro({ clave: "bandeja", pieza: id }), [])
  // «En vivo» cierra con Esc sin frenar la tecla: aquí se frena para que Esc no cierre también la oficina
  useEffect(() => {
    if (centro?.clave !== "en_vivo") return
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); cerrar() } }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [centro, cerrar])

  return (
    <>
      <style>{ESTILO}</style>
      <svg viewBox={`0 0 ${FOTO.w} ${FOTO.h}`} className="pointer-events-none absolute inset-0 h-full w-full" role="group" aria-label="Pantallas del arco" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="nv-arco-suave" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" /></filter>
          {PANTALLAS_VIVAS.map((p) => <clipPath key={p.centro} id={`nv-arco-${p.centro}`}><polygon points={p.forma} /></clipPath>)}
        </defs>
        {PANTALLAS_VIVAS.map((p) => {
          const c = CENTROS[p.centro], caja = cajaDeLaForma(p.forma), cifra = cifraDeLaPantalla(p.centro, cifras), abierta = centro?.clave === p.centro
          const abrir = () => setCentro({ clave: p.centro, pieza: null })
          return (
            <g key={p.centro} className="nv-arco" data-zona={`arco-${p.centro}`} data-centro={p.centro} data-glifo={c.glifo} data-pantalla={p.indice} style={{ "--tono": c.tono } as CSSProperties}
              role="button" tabIndex={0} aria-label={`${c.nombre}: ${c.que}`} aria-haspopup="dialog" aria-expanded={abierta}
              onClick={(e) => { e.stopPropagation(); abrir() }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir() } }}>
              <polygon className="nv-vidrio" points={p.forma} />
              <g clipPath={`url(#nv-arco-${p.centro})`}>
                <polygon className="nv-aviva" points={p.forma} filter="url(#nv-arco-suave)" />
                <g className="nv-glifo">
                  <DibujoDelGlifo glifo={c.glifo} x={caja.x} y={caja.y} w={caja.w} h={caja.h} />
                  {cifra && <text className="nv-cifra" x={caja.cx} y={caja.y + caja.h * 0.86} textAnchor="middle" fill="currentColor" fontSize={Math.min(caja.w, caja.h) * 0.42} fontWeight="500" fontFamily="system-ui, Arial, sans-serif">{cifra}</text>}
                </g>
              </g>
              <text className="nv-rotulo" x={caja.cx} y={caja.y - 22} textAnchor="middle" fill="none" stroke={c.tono} strokeWidth={TAM_ROTULO * 0.9 / 16}
                fontSize={TAM_ROTULO} fontWeight="500" letterSpacing={TAM_ROTULO * 3.4 / 16} fontFamily="system-ui, Arial, sans-serif">{c.rotulo}</text>
            </g>
          )
        })}
      </svg>
      {/* el centro sale al <body> (como el Centro de campaña en marketing): la oficina lleva máscaras que lo desvanecerían */}
      {centro && montado && createPortal(<PanelDelCentro clave={centro.clave} pieza={centro.pieza} cerrar={cerrar} abrirPieza={abrirPieza} />, document.body)}
    </>
  )
}
