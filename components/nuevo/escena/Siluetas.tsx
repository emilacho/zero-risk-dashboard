"use client"

import { DefsDelHolograma, HologramaFigura } from "@/components/nuevo/escena/Holograma"
import { puntoDelMas, repartirEnLaMesa } from "@/lib/escena-movimiento"
import { descripcionDelHolograma } from "@/lib/holograma"
import type { MesaViva } from "@/lib/escena-avatares"
import { nombreCanonico } from "@/lib/organigrama"

/**
 * LOS AGENTES EN SUS ESCRITORIOS (CC4 · 02-nov · sprint 1): una silueta de luz ámbar por cada empleado que trabaja AHORA (o que falló: en rojo), en su escritorio:
 * el que escribe, sentado en la única silla; los que aportan, de pie alrededor de esa computadora. Los demás no aparecen. Cada uno lleva su toque propio (`lib/holograma`).
 * El nombre se ve solo al pasar el cursor. Los que están en la sala de reuniones no se dibujan aquí (los sienta la sala).
 */
export const ESTILO_SILUETAS = `
.nv-av .nv-holo{filter:drop-shadow(0 0 5px rgba(255,170,60,.75))}
.nv-av .nv-holo[data-estado="falla"]{filter:drop-shadow(0 0 5px rgba(255,90,70,.8))}
.nv-av .nv-holo-cuerpo{animation:nvHoloFlicker 4.2s ease-in-out infinite}
.nv-av .nv-holo-barrido{animation:nvHoloSube 3.4s linear infinite}
.nv-av .nv-sil{pointer-events:auto;cursor:default;outline:none}
.nv-av .nv-sil .nv-sil-nombre{opacity:0;transition:opacity .25s ease;pointer-events:none}
.nv-av .nv-sil:hover .nv-sil-nombre,.nv-av .nv-sil:focus-visible .nv-sil-nombre{opacity:1}
.nv-av .nv-sil:hover .nv-holo,.nv-av .nv-sil:focus-visible .nv-holo{filter:drop-shadow(0 0 8px rgba(255,215,150,.95))}
@keyframes nvHoloFlicker{0%,100%{opacity:1}46%{opacity:.92}48%{opacity:.7}50%{opacity:.95}}
@keyframes nvHoloSube{from{transform:translateY(0)}to{transform:translateY(4px)}}
@media (prefers-reduced-motion:reduce){.nv-av .nv-holo-cuerpo,.nv-av .nv-holo-barrido{animation:none!important}}
`

export function Siluetas({ mesas, enLaSala }: { mesas: MesaViva[]; /** nombres canónicos de quienes están ahora en la sala de reuniones */ enLaSala: Set<string> }) {
  const dibujos = mesas.flatMap((m) => {
    const visibles = { ...m, sentados: m.sentados.filter((s) => !enLaSala.has(nombreCanonico(s.agente))) }
    const { puestos } = repartirEnLaMesa(visibles)
    return puestos.map((p) => ({ ...p, mesa: m }))
  }).sort((a, b) => a.pos.y - b.pos.y)
  const deMas = mesas.map((m) => ({ m, n: repartirEnLaMesa(m).deMas })).filter((x) => x.n > 0)
  return (
    <g data-siluetas>
      <defs><DefsDelHolograma /></defs>
      {dibujos.map(({ s, pos, postura, mesa }) => (
        <g key={`${mesa.clave}|${s.agente}`} className="nv-sil" data-agente={s.agente} data-postura={postura} data-estado={s.estado} transform={`translate(${pos.x} ${pos.y})`}
          role="img" tabIndex={0} aria-label={`${s.nombre}. ${mesa.nombre}. ${s.estado === "trabajando" ? "trabajando ahora" : "con fallo"}. ${descripcionDelHolograma(s.agente)}`}>
          <HologramaFigura semilla={s.agente} color={mesa.color} postura={postura} estado={s.estado === "fallo" ? "falla" : "trabajando"} />
          <rect x={-22} y={-86} width={44} height={96} fill="transparent" />
          <text className="nv-sil-nombre" y={-92} textAnchor="middle" fill="#ffe2a8" fontSize={17} fontFamily="system-ui, Arial, sans-serif" stroke="#000" strokeWidth={3} paintOrder="stroke">{s.nombre}</text>
        </g>
      ))}
      {deMas.map(({ m, n }) => {
        const p = puntoDelMas(m)
        return (
          <g key={m.clave} data-de-mas={m.clave} transform={`translate(${p.x} ${p.y})`} aria-label={`${n} más trabajando en ${m.nombre}`}>
            <rect x={-20} y={-14} width={40} height={26} rx={13} fill="#0e0c0a" fillOpacity={0.88} stroke="#ffb347" strokeOpacity={0.75} />
            <text y={5} textAnchor="middle" fill="#ffd9a0" fontSize={17} fontFamily="system-ui, Arial, sans-serif">+{n}</text>
          </g>
        )
      })}
    </g>
  )
}
