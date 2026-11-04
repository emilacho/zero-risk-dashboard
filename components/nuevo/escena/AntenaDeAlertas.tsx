"use client"
/**
 * LA ANTENA (CC4 · 04-nov · Emilio eligió la opción 3 con animación sutil, 15:19Z): la parabólica de la plataforma de arriba a la izquierda avisa las alertas del departamento.
 * Sin alertas: no se dibuja nada (la antena de la foto queda quieta como está). Con alguna: la punta mayor se pone roja con un aura muy suave que respira, el borde de la plataforma
 * se vuelve una línea roja y por dentro de ella corre un tramo de la MISMA línea (mismo color y grosor, solo más brillante), en sentido del reloj, como el agua dentro de una manguera. Al tocarla se abre un panel con la lista (mismo marco que los demás).
 * Luces pequeñas y realistas sobre la foto: nada de formas planas.
 */
import { ANTENA, BORDE_DE_LA_ANTENA, type AlertaDeLaAntena } from "@/lib/escena-alertas"

export const CSS_DE_LA_ANTENA = `
@keyframes nvAntPulso{0%,100%{opacity:.5;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}
@keyframes nvAntCorre{from{stroke-dashoffset:0}to{stroke-dashoffset:-100}}
.nv-antena .nv-antena-pulso{animation:nvAntPulso 2.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.nv-antena .nv-antena-corre{animation:nvAntCorre 4.2s linear infinite}
@media (prefers-reduced-motion:reduce){.nv-antena .nv-antena-pulso,.nv-antena .nv-antena-corre{animation:none}}`
// la animación vive en la hoja (NO inline): un estilo inline le ganaría a «reducir movimiento» (CC3 04-nov)

export function AntenaDeAlertas({ alertas, onAbrir }: { alertas: AlertaDeLaAntena[] | undefined; onAbrir: () => void }) {
  if (!alertas?.length) return null
  const { punta2 } = ANTENA
  const abrir = (e: { stopPropagation: () => void }) => { e.stopPropagation(); onAbrir() }
  return (
    <g className="nv-antena" data-alertas={alertas.length}>
      <style>{CSS_DE_LA_ANTENA}</style>
      <defs>
        <radialGradient id="nvAntRojo" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff1ee" /><stop offset=".18" stopColor="#ff5a4a" /><stop offset=".55" stopColor="#d81a10" stopOpacity=".55" /><stop offset="1" stopColor="#d81a10" stopOpacity="0" />
        </radialGradient>
        <filter id="nvAntDifumina"><feGaussianBlur stdDeviation="1.6" /></filter>
      </defs>
      {/* la línea del borde de la plataforma, en rojo; la luz corre por dentro de ella sin salirse (mismo trazo, mismo largo) */}
      <g filter="url(#nvAntDifumina)" fill="none" strokeLinejoin="round" strokeLinecap="round">
        <path className="nv-antena-borde" d={BORDE_DE_LA_ANTENA} stroke="#e0301f" strokeWidth={3.2} opacity={0.85} />
        <path className="nv-antena-corre" d={BORDE_DE_LA_ANTENA} pathLength={100} stroke="#ff7a62" strokeWidth={3.2} strokeDasharray="9 91" />
      </g>
      {/* la luz de la punta mayor: aura suave que respira, sin círculo plano */}
      <g className="nv-antena-pulso">
        <circle cx={punta2.x} cy={punta2.y} r={28} fill="url(#nvAntRojo)" />
        <circle cx={punta2.x} cy={punta2.y} r={4} fill="#fff4f0" />
      </g>
      <ellipse cx={ANTENA.plato.x} cy={ANTENA.plato.y} rx={ANTENA.plato.rx + 14} ry={ANTENA.plato.ry + 14} fill="rgba(0,0,0,0)" role="button" tabIndex={0}
        aria-label={`${alertas.length === 1 ? "1 alerta" : `${alertas.length} alertas`} del departamento. Ver la lista`} style={{ cursor: "pointer", pointerEvents: "auto", outline: "none" }}
        onClick={abrir} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(e) } }} />
    </g>
  )
}

export function PanelDeLasAlertas({ alertas, onAbrir, onCerrar }: { alertas: AlertaDeLaAntena[] | undefined; onAbrir: (a: AlertaDeLaAntena) => void; onCerrar: () => void }) {
  const lista = alertas ?? []
  return (
    <div className="flex flex-col gap-3" data-panel-alertas>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-[.18em] text-zinc-500">Alertas</div>
          <div className="text-[18px] font-semibold text-red-200">{lista.length === 0 ? "Todo en orden" : lista.length === 1 ? "1 alerta" : `${lista.length} alertas`}</div>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="min-h-[44px] min-w-[44px] rounded-lg text-[22px] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200">×</button>
      </div>
      <ul className="space-y-2">
        {lista.map((a) => (
          <li key={a.clave} data-alerta={a.tipo}>
            <button type="button" disabled={!a.abre} onClick={() => onAbrir(a)} className="flex min-h-[52px] w-full items-center rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-[15px] text-zinc-100 hover:bg-white/[0.06] disabled:cursor-default">
              {a.texto}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
