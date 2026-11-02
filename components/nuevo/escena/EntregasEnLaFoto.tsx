/**
 * LA ESCENA VIVA · SPRINT 3 · lo que se ve de las entregas en la foto de marketing (CC4 · 02-nov): los cuadros encendidos del pizarrón, la tarjeta de la entrega que se acaba de dejar
 * y la luz de firma del panel del borde derecho (la puerta hacia Tu oficina). Solo dibuja lo que dicen los datos: sin entregas, el pizarrón queda apagado; sin firmas, el panel queda como está.
 */
import type { CSSProperties } from "react"
import { ANCLA_DE_LA_TARJETA, CUADROS_DEL_PIZARRON, ENLACE_A_TU_OFICINA, MAXIMO_DE_CUADROS, PANEL_DE_FIRMA, rotuloDeLaFirma, type EntregaViva } from "@/lib/escena-entregas"

const FUENTE = "system-ui, Arial, sans-serif"
export const ESTILO_ENTREGAS = `
.nv-av .nv-cuadro{transition:opacity .8s ease;filter:drop-shadow(0 0 6px rgba(255,170,60,.7))}
.nv-av .nv-cuadro polygon{pointer-events:auto;cursor:default}
.nv-av .nv-firma{pointer-events:auto;cursor:pointer;outline:none}
.nv-av .nv-firma .nv-firma-luz{animation:nvFirmaPulso 3.6s ease-in-out infinite}
.nv-av .nv-firma .nv-firma-rotulo{opacity:0;transition:opacity .25s ease;pointer-events:none}
.nv-av .nv-firma:hover .nv-firma-rotulo,.nv-av .nv-firma:focus-visible .nv-firma-rotulo{opacity:1}
@keyframes nvFirmaPulso{0%,100%{opacity:.35}50%{opacity:.95}}
@media (prefers-reduced-motion:reduce){.nv-av .nv-firma .nv-firma-luz{animation:none;opacity:.7}.nv-av .nv-cuadro{transition:none}}
`

/**
 * A cada entrega le toca UN cuadro y lo conserva mientras siga vigente (no se corren de lugar cuando llega otra). Si no hay cuadro libre, se apaga el de la más vieja.
 * `previas` = quién ocupaba cada cuadro; `entregas` = las vigentes (de la más nueva a la más vieja).
 */
export function asignarRanuras(previas: Array<string | null>, entregas: Array<Pick<EntregaViva, "id" | "cerrado_en">>): Array<string | null> {
  const vigentes = new Set(entregas.map((e) => e.id))
  const ranuras: Array<string | null> = Array.from({ length: MAXIMO_DE_CUADROS }, (_, i) => (previas[i] && vigentes.has(previas[i]!) ? previas[i]! : null))
  const puestas = new Set(ranuras.filter((x): x is string => !!x))
  for (const e of [...entregas].sort((a, b) => (a.cerrado_en < b.cerrado_en ? -1 : 1))) {
    if (puestas.has(e.id)) continue
    let libre = ranuras.indexOf(null)
    if (libre < 0) { // todo ocupado: se apaga el más viejo
      const orden = new Map(entregas.map((x) => [x.id, x.cerrado_en]))
      libre = ranuras.reduce((m, id, i) => ((orden.get(id!) ?? "") < (orden.get(ranuras[m]!) ?? "") ? i : m), 0)
    }
    ranuras[libre] = e.id; puestas.add(e.id)
  }
  return ranuras
}

const puntos = (p: Array<{ x: number; y: number }>) => p.map((q) => `${q.x},${q.y}`).join(" ")

/** los cuadros del pizarrón: uno encendido por cada entrega vigente (el de la que se está dejando ahora aparece cuando termina su tarjeta) */
export function CuadrosDelPizarron({ entregas, ranuras, oculta }: { entregas: EntregaViva[]; ranuras: Array<string | null>; oculta: string | null }) {
  const por = new Map(entregas.map((e) => [e.id, e]))
  return (
    <g data-cuadros-de-entregas data-encendidos={ranuras.filter((id) => id && id !== oculta && por.has(id)).length}>
      {CUADROS_DEL_PIZARRON.map((c, i) => {
        const id = ranuras[i]; const e = id ? por.get(id) : undefined
        if (!e || e.id === oculta) return null
        return (
          <g key={e.id} className="nv-cuadro" data-cuadro={i} data-entrega={e.id}>
            <polygon points={puntos(c)} fill="#ffb347" fillOpacity={0.62} stroke="#ffe2a8" strokeOpacity={0.8} strokeWidth={0.8}><title>{`${e.titulo} · entregada${e.nombre ? ` por ${e.nombre}` : ""}`}</title></polygon>
          </g>
        )
      })}
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
