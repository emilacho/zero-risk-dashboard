/**
 * LA ESCENA VIVA · SPRINT 3 · lo que se ve de las entregas en la foto de marketing (CC4 · 02-nov): los cuadros encendidos del pizarrón, la tarjeta de la entrega que se acaba de dejar
 * y la luz de firma del panel del borde derecho (la puerta hacia Tu oficina). Solo dibuja lo que dicen los datos: sin entregas, el pizarrón queda apagado; sin firmas, el panel queda como está.
 */
import { useState, type CSSProperties } from "react"
import { ANCLA_DE_LA_TARJETA, CUADROS_DEL_PIZARRON, ENLACE_A_TU_OFICINA, PANEL_DE_FIRMA, rotuloDeLaFirma, type EntregaViva } from "@/lib/escena-entregas"
import type { MetricasDelPizarron } from "@/lib/escena-metricas"

const FUENTE = "system-ui, Arial, sans-serif"
export const ESTILO_ENTREGAS = `
.nv-av .nv-metrica{outline:none}
.nv-av .nv-metrica .nv-metrica-cuadro{pointer-events:auto;cursor:default;filter:drop-shadow(0 0 4px rgba(255,170,60,.55));transition:fill-opacity .25s ease}
.nv-av .nv-metrica:hover .nv-metrica-cuadro,.nv-av .nv-metrica:focus-visible .nv-metrica-cuadro{fill-opacity:.45}
.nv-av .nv-firma{pointer-events:auto;cursor:pointer;outline:none}
.nv-av .nv-firma .nv-firma-luz{animation:nvFirmaPulso 3.6s ease-in-out infinite}
.nv-av .nv-firma .nv-firma-rotulo{opacity:0;transition:opacity .25s ease;pointer-events:none}
.nv-av .nv-firma:hover .nv-firma-rotulo,.nv-av .nv-firma:focus-visible .nv-firma-rotulo{opacity:1}
@keyframes nvFirmaPulso{0%,100%{opacity:.35}50%{opacity:.95}}
@media (prefers-reduced-motion:reduce){.nv-av .nv-firma .nv-firma-luz{animation:none;opacity:.7}.nv-av .nv-metrica .nv-metrica-cuadro{transition:none}}
`

const puntos = (p: Array<{ x: number; y: number }>) => p.map((q) => `${q.x},${q.y}`).join(" ")

/** los cuadros del pizarrón son de MÉTRICAS: «General» y uno por red del cliente. Hoy dicen «métricas pronto»; al pasar el cursor, el nombre y el estado (la métrica principal y su variación llegan con el contrato de CC1) */
export function CuadrosDeMetricas({ metricas }: { metricas: MetricasDelPizarron | undefined }) {
  const [activo, setActivo] = useState<string | null>(null)
  if (!metricas) return null
  const cuadros = metricas.cuadros.slice(0, CUADROS_DEL_PIZARRON.length)
  const centro = (i: number) => { const c = CUADROS_DEL_PIZARRON[i]; return { x: c.reduce((s, q) => s + q.x, 0) / c.length, y: c.reduce((s, q) => s + q.y, 0) / c.length } }
  const a = cuadros.findIndex((c) => c.clave === activo)
  const w = 196
  return (
    <g data-pizarron-de-metricas data-cuadros={cuadros.length} data-lectura={metricas.lectura}>
      {cuadros.map((c, i) => {
        const { x, y } = centro(i)
        return (
          <g key={c.clave} className="nv-metrica" data-metrica={c.clave} role="img" tabIndex={0} aria-label={`${c.nombre}: ${c.principal ? `${c.principal}${c.variacion ? `, ${c.variacion}` : ""}` : c.texto}`}
            onMouseEnter={() => setActivo(c.clave)} onMouseLeave={() => setActivo(null)} onFocus={() => setActivo(c.clave)} onBlur={() => setActivo(null)}>
            <polygon className="nv-metrica-cuadro" points={puntos(CUADROS_DEL_PIZARRON[i])} fill="#ffb347" fillOpacity={0.2} stroke="#ffd9a0" strokeOpacity={0.6} strokeWidth={0.8} />
            <text x={x} y={y + 3} textAnchor="middle" fill="#ffe2a8" fontSize={c.sigla.length > 2 ? 7.5 : 9.5} fontWeight={600} fontFamily={FUENTE} pointerEvents="none">{c.sigla}</text>
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

/** la luz de firma: el panel luminoso del borde derecho pulsa en ámbar mientras haya algo esperando a Emilio; al pasar el cursor dice cuántas y lleva a Tu oficina */
export function LuzDeFirma({ pendientes }: { pendientes: number }) {
  if (pendientes <= 0) return null
  const rotulo = rotuloDeLaFirma(pendientes)
  const cx = PANEL_DE_FIRMA.reduce((s, p) => s + p.x, 0) / PANEL_DE_FIRMA.length
  const top = Math.min(...PANEL_DE_FIRMA.map((p) => p.y))
  return (
    <a className="nv-firma" href={ENLACE_A_TU_OFICINA} data-firma={pendientes} aria-label={`${rotulo}. Ir a Tu oficina`}>
      <ellipse className="nv-firma-luz" cx={cx} cy={569} rx={62} ry={92} fill="url(#nv-av-ambar)" />
      <polygon className="nv-firma-luz" points={puntos(PANEL_DE_FIRMA)} fill="#ffb347" fillOpacity={0.5} stroke="#ffd9a0" strokeWidth={2} style={{ filter: "drop-shadow(0 0 14px rgba(255,170,60,.95))" }} />
      <polygon points={puntos(PANEL_DE_FIRMA)} fill="rgba(0,0,0,0)" />
      <g className="nv-firma-rotulo" transform={`translate(${cx} ${top - 26})`}>
        <rect x={-92} y={-18} width={184} height={32} rx={16} fill="#0e0c0a" fillOpacity={0.94} stroke="#ffb347" strokeOpacity={0.8} />
        <text y={4} textAnchor="middle" fill="#ffe2a8" fontSize={15} fontWeight={600} fontFamily={FUENTE}>{rotulo}</text>
      </g>
    </a>
  )
}
