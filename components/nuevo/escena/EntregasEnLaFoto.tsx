/**
 * LA ESCENA VIVA · SPRINT 3 · lo que se ve de las entregas en la foto de marketing (CC4 · 02-nov): los cuadros encendidos del pizarrón, la tarjeta de la entrega que se acaba de dejar
 * y la luz de firma del panel del borde derecho (la puerta hacia Tu oficina). Solo dibuja lo que dicen los datos: sin entregas, el pizarrón queda apagado; sin firmas, el panel queda como está.
 */
import { useEffect, useState, type CSSProperties } from "react"
import { ANCLA_DE_LA_TARJETA, CUADROS_DEL_PIZARRON, ENLACE_A_TU_OFICINA, LAMPARA_DE_FIRMA, rotuloDeLaFirma, type EntregaViva } from "@/lib/escena-entregas"
import { TEXTO_SIN_METRICAS, type MetricasDelPizarron } from "@/lib/escena-metricas"
import { PANTALLA_VERTICAL, ROTACION_DE_LA_VITRINA_MS, type VitrinaDeLaEscena } from "@/lib/escena-vitrina"

const FUENTE = "system-ui, Arial, sans-serif"
export const ESTILO_ENTREGAS = `
.nv-av .nv-metrica{outline:none}
.nv-av .nv-metrica .nv-metrica-cuadro{pointer-events:auto;cursor:pointer;filter:drop-shadow(0 0 4px rgba(255,170,60,.55));transition:fill-opacity .25s ease}
.nv-av .nv-metrica:hover .nv-metrica-cuadro,.nv-av .nv-metrica:focus-visible .nv-metrica-cuadro{fill-opacity:.45}
.nv-av .nv-vitrina-hit{pointer-events:auto;cursor:pointer;outline:none}
.nv-av .nv-firma{pointer-events:auto;cursor:pointer;outline:none}
.nv-av .nv-firma .nv-firma-luz{animation:nvFirmaPulso 3.6s ease-in-out infinite}
.nv-av .nv-firma .nv-firma-rotulo{opacity:0;transition:opacity .25s ease;pointer-events:none}
.nv-av .nv-firma:hover .nv-firma-rotulo,.nv-av .nv-firma:focus-visible .nv-firma-rotulo{opacity:1}
@keyframes nvFirmaPulso{0%,100%{opacity:.35}50%{opacity:.95}}
@media (prefers-reduced-motion:reduce){.nv-av .nv-firma .nv-firma-luz{animation:none;opacity:.7}.nv-av .nv-metrica .nv-metrica-cuadro{transition:none}}
`

const puntos = (p: Array<{ x: number; y: number }>) => p.map((q) => `${q.x},${q.y}`).join(" ")

/** los cuadros del pizarrón son de MÉTRICAS: «General» y uno por red del cliente. Hoy dicen «métricas pronto»; al pasar el cursor, el nombre y el estado (la métrica principal y su variación llegan con el contrato de CC1) */
export function CuadrosDeMetricas({ metricas, onAbrir }: { metricas: MetricasDelPizarron | undefined; onAbrir?: (clave: string) => void }) {
  const [activo, setActivo] = useState<string | null>(null)
  if (!metricas) return null
  const cuadros = metricas.cuadros.slice(0, CUADROS_DEL_PIZARRON.length)
  const centro = (i: number) => { const c = CUADROS_DEL_PIZARRON[i]; return { x: c.reduce((s, q) => s + q.x, 0) / c.length, y: c.reduce((s, q) => s + q.y, 0) / c.length } }
  const a = cuadros.findIndex((c) => c.clave === activo)
  const w = 196
  return (
    <g data-pizarron-de-metricas data-cuadros={cuadros.length} data-lectura={metricas.lectura}>
      <rect data-pizarron-toque className="nv-metrica-cuadro" x={Math.min(...CUADROS_DEL_PIZARRON.flat().map((q) => q.x)) - 10} y={Math.min(...CUADROS_DEL_PIZARRON.flat().map((q) => q.y)) - 10}
        width={Math.max(...CUADROS_DEL_PIZARRON.flat().map((q) => q.x)) - Math.min(...CUADROS_DEL_PIZARRON.flat().map((q) => q.x)) + 20} height={Math.max(...CUADROS_DEL_PIZARRON.flat().map((q) => q.y)) - Math.min(...CUADROS_DEL_PIZARRON.flat().map((q) => q.y)) + 20}
        fill="rgba(0,0,0,0)" style={{ filter: "none" }} role="button" tabIndex={0} aria-label="Abrir el pizarrón de métricas" onClick={() => onAbrir?.("")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAbrir?.("") } }} />
      {cuadros.map((c, i) => {
        return (
          <g key={c.clave} className="nv-metrica" data-metrica={c.clave} data-tiene={c.tiene} opacity={c.tiene ? 1 : 0.4} role="button" tabIndex={0} onClick={() => onAbrir?.(c.clave)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAbrir?.(c.clave) } }} aria-label={`${c.nombre}: ${c.principal ? `${c.principal}${c.variacion ? `, ${c.variacion}` : ""}` : c.texto}`}
            onMouseEnter={() => setActivo(c.clave)} onMouseLeave={() => setActivo(null)} onFocus={() => setActivo(c.clave)} onBlur={() => setActivo(null)}>
            <polygon className="nv-metrica-cuadro" points={puntos(CUADROS_DEL_PIZARRON[i])} fill="#ffb347" fillOpacity={0.2} stroke="#ffd9a0" strokeOpacity={0.6} strokeWidth={0.8} />
          </g>
        )
      })}
      {a >= 0 && (
        <g className="nv-metrica-rotulo" data-rotulo-de={cuadros[a].clave} transform={`translate(${centro(a).x} ${centro(a).y - 30})`} pointerEvents="none">
          <rect x={-w / 2} y={-30} width={w} height={cuadros[a].principal ? 50 : 42} rx={12} fill="#0e0c0a" fillOpacity={0.95} stroke="#ffb347" strokeOpacity={0.7} strokeWidth={1.2} />
          <text x={-w / 2 + 12} y={-13} fontFamily={FUENTE} fontSize={11} fill="#a8a097" letterSpacing={1.5}>{cuadros[a].nombre.toUpperCase()}</text>
          <text x={-w / 2 + 12} y={5} fontFamily={FUENTE} fontSize={14} fontWeight={600} fill="#ffe2a8">{cuadros[a].principal ?? cuadros[a].texto}</text>
          {cuadros[a].variacion && <text x={-w / 2 + 12} y={18} fontFamily={FUENTE} fontSize={12} fill="#e8dfd2">{cuadros[a].variacion}</text>}
        </g>
      )}
    </g>
  )
}

/** la tarjeta de la entrega que acaba de llegar: sobre el pizarrón, con nuestro estilo (tarjeta oscura, borde ámbar) */
export function TarjetaDeLaEntrega({ e }: { e: EntregaViva | null }) {
  if (!e) return null
  const linea = e.titulo.length > 46 ? `${e.titulo.slice(0, 45)}…` : e.titulo
  const w = Math.min(Math.max(linea.length * 7.6, 150), 380) + 24, h = e.nombre ? 56 : 38
  const x = ANCLA_DE_LA_TARJETA.x - w / 2, y = ANCLA_DE_LA_TARJETA.y - h
  return (
    <g data-tarjeta-entrega={e.id} role="status" aria-label={`Entrega: ${e.titulo}${e.nombre ? `, de ${e.nombre}` : ""}`} pointerEvents="none" style={{ filter: "drop-shadow(0 6px 14px rgba(0,0,0,.6))" } as CSSProperties}>
      <rect x={x} y={y} width={w} height={h} rx={12} fill="#0e0c0a" fillOpacity={0.94} stroke="#ffb347" strokeOpacity={0.7} strokeWidth={1.4} />
      <path d={`M ${ANCLA_DE_LA_TARJETA.x - 7} ${y + h} l 7 10 l 7 -10 z`} fill="#0e0c0a" fillOpacity={0.94} stroke="#ffb347" strokeOpacity={0.7} strokeWidth={1.2} strokeLinejoin="round" />
      <text x={x + 12} y={y + 17} fontFamily={FUENTE} fontSize={11} fill="#a8a097" letterSpacing={1.5}>ENTREGA</text>
      <text x={x + 12} y={y + 34} fontFamily={FUENTE} fontSize={14} fontWeight={600} fill="#ffe2a8">{linea}</text>
      {e.nombre && <text x={x + 12} y={y + 50} fontFamily={FUENTE} fontSize={12} fill="#e8dfd2">{e.nombre}</text>}
    </g>
  )
}

/** la lámpara de firma: sobre el escritorio de Dirección, se enciende en ámbar y pulsa mientras haya algo esperando a Emilio; al pasar el cursor dice cuántas y lleva a Tu oficina */
export function LamparaDeFirma({ pendientes }: { pendientes: number }) {
  if (pendientes <= 0) return null
  const rotulo = rotuloDeLaFirma(pendientes)
  const { x, y } = LAMPARA_DE_FIRMA
  return (
    <a className="nv-firma" href={ENLACE_A_TU_OFICINA} data-firma={pendientes} data-lampara aria-label={`${rotulo}. Ir a Tu oficina`}>
      <ellipse className="nv-firma-luz" cx={x + 2} cy={y - 14} rx={58} ry={42} fill="url(#nv-av-ambar)" />
      <ellipse cx={x} cy={y} rx={8} ry={3.4} fill="#1b1713" stroke="#8a6a3c" strokeWidth={0.6} />
      <line x1={x} y1={y} x2={x + 2} y2={y - 15} stroke="#7a6a55" strokeWidth={1.7} strokeLinecap="round" />
      <polygon className="nv-firma-luz" points={`${x - 7},${y - 14} ${x + 9},${y - 21} ${x + 12},${y - 9} ${x - 3},${y - 6}`} fill="#ffb347" fillOpacity={0.95} stroke="#ffd9a0" strokeWidth={0.8} style={{ filter: "drop-shadow(0 0 7px rgba(255,170,60,.95))" }} />
      <circle cx={x} cy={y - 12} r={24} fill="rgba(0,0,0,0)" />
      <g className="nv-firma-rotulo" transform={`translate(${x} ${y - 50})`}>
        <rect x={-92} y={-18} width={184} height={32} rx={16} fill="#0e0c0a" fillOpacity={0.94} stroke="#ffb347" strokeOpacity={0.8} />
        <text y={4} textAnchor="middle" fill="#ffe2a8" fontSize={15} fontWeight={600} fontFamily={FUENTE}>{rotulo}</text>
      </g>
    </a>
  )
}

const partir = (s: string, ancho: number, maxLineas: number): string[] => {
  const out: string[] = []
  let l = ""
  for (const w of s.split(/\s+/).filter(Boolean)) {
    if ((l + " " + w).trim().length > ancho && l) { out.push(l); l = w } else l = (l + " " + w).trim()
  }
  if (l) out.push(l)
  const r = out.slice(0, maxLineas)
  if (out.length > maxLineas) r[maxLineas - 1] = r[maxLineas - 1].slice(0, Math.max(1, ancho - 1)) + "…"
  return r
}
const MATRIZ_VITRINA = `matrix(1 ${((PANTALLA_VERTICAL[1].y - PANTALLA_VERTICAL[0].y) / (PANTALLA_VERTICAL[1].x - PANTALLA_VERTICAL[0].x)).toFixed(4)} 0 1 ${PANTALLA_VERTICAL[0].x} ${PANTALLA_VERTICAL[0].y})`

/** la pantalla vertical: la vitrina de las mejores piezas, rotando. Hoy sin resultados: «métricas pronto» + la última pieza aprobada. Con el cursor encima, el detalle de la pieza que se ve */
export function VitrinaVertical({ vitrina, onAbrir }: { vitrina: VitrinaDeLaEscena | undefined; onAbrir?: () => void }) {
  const [n, setN] = useState(0)
  const [encima, setEncima] = useState(false)
  const total = vitrina?.piezas.length ?? 0
  useEffect(() => {
    if (total < 2 || encima) return
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
    const id = setInterval(() => setN((v) => (v + 1) % total), ROTACION_DE_LA_VITRINA_MS)
    return () => clearInterval(id)
  }, [total, encima])
  if (!vitrina) return null
  const pieza = vitrina.piezas.length > 0 ? vitrina.piezas[n % vitrina.piezas.length] : null
  const lineas = pieza ? partir(pieza.titulo, 11, 5) : ["aún sin", "piezas"]
  const texto = pieza?.texto ?? TEXTO_SIN_METRICAS
  const leyenda = vitrina.modo === "mejores" ? `Pieza ${(n % total) + 1} de ${total}` : vitrina.modo === "ultima" ? "Última pieza aprobada" : "Aún sin piezas"
  const cx = PANTALLA_VERTICAL.reduce((s, p) => s + p.x, 0) / 4, top = Math.min(...PANTALLA_VERTICAL.map((p) => p.y))
  const w = 230
  return (
    <g data-vitrina data-modo={vitrina.modo} data-piezas={total} data-lectura={vitrina.lectura}>
      <g transform={MATRIZ_VITRINA} pointerEvents="none">
        <rect x={0} y={0} width={41} height={107} fill="#160d05" fillOpacity={0.9} />
        {pieza?.imagen
          ? <image href={pieza.imagen} x={3} y={13} width={35} height={35} preserveAspectRatio="xMidYMid slice" />
          : <rect x={3} y={13} width={35} height={35} rx={2} fill="#ffb347" fillOpacity={0.12} stroke="#ffd9a0" strokeOpacity={0.35} strokeWidth={0.5} />}
        {lineas.map((l, i) => <text key={i} x={3} y={58 + i * 7} fontFamily={FUENTE} fontSize={5.4} fill="#ffe2a8">{l}</text>)}
      </g>
      <polygon className="nv-vitrina-hit" points={puntos(PANTALLA_VERTICAL)} fill="rgba(0,0,0,0)" tabIndex={0} role="button" onClick={() => onAbrir?.()} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAbrir?.() } }} aria-label={`Vitrina de mejores piezas. ${leyenda}${pieza ? `: ${pieza.titulo}` : ""}. ${texto}`}
        onMouseEnter={() => setEncima(true)} onMouseLeave={() => setEncima(false)} onFocus={() => setEncima(true)} onBlur={() => setEncima(false)} />
      {encima && (
        <g className="nv-vitrina-rotulo" transform={`translate(${cx} ${top - 14})`} pointerEvents="none">
          <rect x={-w / 2} y={-70} width={w} height={74} rx={12} fill="#0e0c0a" fillOpacity={0.95} stroke="#ffb347" strokeOpacity={0.7} strokeWidth={1.2} />
          <text x={-w / 2 + 12} y={-50} fontFamily={FUENTE} fontSize={11} fill="#a8a097" letterSpacing={1.5}>VITRINA · MEJORES PIEZAS</text>
          <text x={-w / 2 + 12} y={-30} fontFamily={FUENTE} fontSize={14} fontWeight={600} fill="#ffe2a8">{pieza ? (pieza.titulo.length > 28 ? pieza.titulo.slice(0, 27) + "…" : pieza.titulo) : "Aún sin piezas"}</text>
          <text x={-w / 2 + 12} y={-12} fontFamily={FUENTE} fontSize={12} fill="#e8dfd2">{leyenda} · {texto}</text>
        </g>
      )}
    </g>
  )
}
