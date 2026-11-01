"use client"

import type { CSSProperties } from "react"
import { globoDe, lineasDeLaSala, lineasDelResultado, SALA, type ParticipanteDeLaSala, type ReunionDeLaSala, type SalaDeReuniones, type UsoDelAporte } from "@/lib/escena-sala"
import { mesaPorClave } from "@/lib/escena-avatares"

/**
 * LA SALA DE REUNIONES en la foto (CC6 · S3): dentro del SVG de la escena. Cada participante de la reunión real se sienta en una silla de la mesa redonda
 * (la cabecera para el que dirige); el que habla ahora late en ámbar; el que falló, en rojo. Sin reunión, la sala queda vacía y el rótulo lo dice.
 * S4 · cada uno tiene su burbuja de aporte: se enciende cuando habla; al cerrar, lo usado viaja al centro de la mesa y lo que no se usó se apaga.
 * Solo LECTURA. Tocar a alguien abre su aporte completo; tocar el rótulo abre las fases de la reunión.
 */
export const ESTILO_SALA = `
.nv-sala-p{pointer-events:auto;cursor:pointer;outline:none}
.nv-sala-p .nv-sala-aro{transition:stroke-width .2s ease}
.nv-sala-p:hover .nv-sala-aro,.nv-sala-p:focus-visible .nv-sala-aro{stroke-width:4}
.nv-sala-p[data-estado="hablando"] .nv-sala-halo{animation:nvSalaHabla 1.8s ease-in-out infinite}
.nv-sala-rotulo{pointer-events:auto;cursor:pointer;outline:none}
.nv-sala-rotulo:hover .nv-sala-t1,.nv-sala-rotulo:focus-visible .nv-sala-t1{stroke:#ffb86b}
.nv-sala-luz{animation:nvAvLate 2.6s ease-in-out infinite}
.nv-sala-burbuja{transition:transform 1.4s cubic-bezier(.4,0,.2,1),opacity 1s ease}
.nv-sala-burbuja[data-luz="habla"] rect{animation:nvSalaHabla 1.4s ease-in-out infinite}
@keyframes nvSalaHabla{0%,100%{opacity:.85}50%{opacity:.25}}
@media (prefers-reduced-motion:reduce){.nv-sala-p[data-estado="hablando"] .nv-sala-halo,.nv-sala-luz,.nv-sala-burbuja[data-luz="habla"] rect{animation:none}.nv-sala-burbuja{transition:none}}
`
const FUENTE = "system-ui, Arial, sans-serif"
/** «Jefe de Marketing» → «JM» (sin «de», «del», «la», «y»…; primera y última palabra) */
export const inicialesDe = (nombre: string): string => { const p = nombre.split(/[\s/·-]+/).filter((w) => w && !/^(de|del|la|las|el|los|y|en)$/i.test(w)); return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() }
const colorDe = (p: ParticipanteDeLaSala) => (p.mesa ? mesaPorClave(p.mesa)?.color ?? "#bbb" : p.equipo.startsWith("Jefatura") ? "#f5a524" : "#9a9a9a")
export const estadoLegible = (p: ParticipanteDeLaSala) => (p.estado === "hablando" ? "hablando ahora" : p.estado === "fallo" ? `falló ${p.hace}` : p.estado === "hablo" ? `aportó ${p.hace}` : "en espera")

export const usoLegible = (u: UsoDelAporte): string => (u === "resultado" ? "resultado" : u === "usado" ? "usado" : u === "apagado" ? "no se usó" : u === "revision" ? "revisión" : "sin dato de uso")
/** S4 · la luz de la burbuja: «habla» (encendida, late) · «ultimo» (el último que habló, mientras la reunión sigue) · «normal» · al cerrar: «centro» (usado o
 *  resultado: viaja al centro) · «apagado» (no se usó) · «quieto» (revisión o sin dato: se queda en su silla) */
export type LuzDeLaBurbuja = "habla" | "ultimo" | "normal" | "centro" | "apagado" | "quieto"
export function luzDeLaBurbuja(p: ParticipanteDeLaSala, r: ReunionDeLaSala): LuzDeLaBurbuja {
  if (p.estado === "hablando") return "habla"
  if (r.estado === "en_curso") {
    if (r.participantes.some((x) => x.estado === "hablando")) return "normal"
    const ultimo = [...r.participantes].filter((x) => x.ultima).sort((a, b) => (b.ultima ?? "").localeCompare(a.ultima ?? ""))[0]
    return ultimo?.agente === p.agente ? "ultimo" : "normal"
  }
  const u = p.aporte?.uso
  return u === "usado" || u === "resultado" ? "centro" : u === "apagado" ? "apagado" : "quieto"
}
/** dónde queda cada burbuja que viaja al centro: en un anillo chico alrededor del centro de la mesa (el resultado, en el medio) */
export function destinoEnElCentro(i: number, n: number, esResultado: boolean): { x: number; y: number } {
  if (esResultado) return { x: SALA.mesa.x, y: SALA.mesa.y - 18 }
  const a = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2
  return { x: Math.round(SALA.mesa.x + 42 * Math.cos(a)), y: Math.round(SALA.mesa.y - 8 + 22 * Math.sin(a)) }
}
export const posBurbuja = (s: { x: number; y: number }) => ({ x: s.x + 14, y: s.y - 66 })

export function SalaEnLaFoto({ sala, abierta, onAbrir, onFoco, onTocar }: {
  sala: SalaDeReuniones | null | undefined
  abierta: boolean
  onAbrir: () => void
  onFoco: (agente: string | null) => void
  onTocar: (agente: string) => void
}) {
  const r = sala?.reunion ?? null
  const lineas = lineasDeLaSala(sala)
  const terminada = r?.estado === "terminada"
  return (
    <g className="nv-sala" data-sala={r ? r.estado : "vacia"} data-corridas={r?.corridas.join(",") ?? ""}>
      {r?.estado === "en_curso" && <ellipse className="nv-sala-luz" cx={SALA.mesa.x} cy={SALA.mesa.y} rx={150} ry={95} fill="url(#nv-av-ambar)" opacity={0.7} />}
      <g className="nv-sala-rotulo" role="button" tabIndex={0} aria-haspopup="dialog" aria-expanded={abierta} aria-label={`${lineas.join(". ")}. Ver la reunión`}
        onClick={(e) => { e.stopPropagation(); onAbrir() }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAbrir() } }}>
        <rect x={SALA.rotulo.x - 330} y={SALA.rotulo.y - 34} width={660} height={lineas.length > 2 ? 92 : 64} fill="rgba(0,0,0,0)" />
        <text className="nv-sala-t1" x={SALA.rotulo.x} y={SALA.rotulo.y} textAnchor="middle" fill="none" stroke={r ? "#e8731a" : "#9a9a9a"} strokeWidth={1.4} fontSize={24} fontWeight="500" letterSpacing={5} fontFamily={FUENTE}>{lineas[0]}</text>
        {lineas.slice(1).map((l, i) => (
          <text key={i} x={SALA.rotulo.x} y={SALA.rotulo.y + 26 + i * 22} textAnchor="middle" fill={i === 0 && r ? "#ffd9a0" : "#a8a097"} fontSize={i === 0 && r ? 19 : 16} fontWeight={i === 0 && r ? 600 : 400} fontFamily={FUENTE} stroke="#0b0a09" strokeWidth={4} strokeOpacity={0.85} paintOrder="stroke" data-sala-linea={i + 1}>{l}</text>
        ))}
      </g>
      {r?.participantes.filter((p) => p.silla).map((p) => {
        const s = p.silla!, c = colorDe(p)
        const aro = p.estado === "fallo" ? "#ff5a4a" : p.cabecera ? "#ffb347" : c
        return (
          <g key={p.agente} className="nv-sala-p" data-agente={p.agente} data-estado={p.estado} data-cabecera={p.cabecera} opacity={terminada ? 0.6 : 1} role="button" tabIndex={0}
            aria-label={`${p.nombre}${p.cabecera ? ", dirige" : ""}. ${p.equipo}. ${p.fase}. ${estadoLegible(p)}. Ver su aporte completo`}
            onMouseEnter={() => onFoco(p.agente)} onMouseLeave={() => onFoco(null)} onFocus={() => onFoco(p.agente)} onBlur={() => onFoco(null)}
            onClick={(e) => { e.stopPropagation(); onTocar(p.agente) }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTocar(p.agente) } }}>
            <ellipse cx={s.x} cy={s.y + 4} rx={16} ry={6} fill="rgba(0,0,0,.45)" />
            {(p.estado === "hablando" || p.estado === "fallo") && <circle className="nv-sala-halo" cx={s.x} cy={s.y - 30} r={26} fill={p.estado === "fallo" ? "url(#nv-av-rojo)" : "url(#nv-av-ambar)"} />}
            <line x1={s.x} y1={s.y - 12} x2={s.x} y2={s.y} stroke={c} strokeOpacity={0.5} strokeWidth={2} />
            <circle className="nv-sala-aro" cx={s.x} cy={s.y - 30} r={17} fill="#141210" stroke={aro} strokeWidth={p.cabecera ? 3 : 2} style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,.6))" } as CSSProperties} />
            <text x={s.x} y={s.y - 25} textAnchor="middle" fill={p.estado === "espera" ? "#8a8a8a" : "#f3e7d6"} fontSize={13} fontWeight={600} fontFamily={FUENTE}>{inicialesDe(p.nombre)}</text>
            {p.cabecera && <text x={s.x} y={s.y - 54} textAnchor="middle" fill="#ffb347" fontSize={11} fontWeight={600} letterSpacing={1} fontFamily={FUENTE}>DIRIGE</text>}
          </g>
        )
      })}
      {/* S4 · las burbujas de aporte (encima de las figuras): la que habla se enciende; al cerrar, lo usado viaja al centro y lo que no se usó se apaga */}
      {r && (() => {
        const viajan = r.participantes.filter((p) => p.silla && !p.cabecera && luzDeLaBurbuja(p, r) === "centro")
        return r.participantes.filter((p) => p.silla).map((p) => {
          const luz = luzDeLaBurbuja(p, r)
          const b = posBurbuja(p.silla!)
          const destino = luz === "centro" ? destinoEnElCentro(viajan.indexOf(p), viajan.length, p.cabecera) : null
          const d = destino ? { x: destino.x - b.x, y: destino.y - b.y } : { x: 0, y: 0 }
          const color = luz === "apagado" ? "#5a5550" : luz === "habla" || luz === "ultimo" || luz === "centro" ? "#ffb347" : "#c9b89f"
          const fondo = luz === "apagado" ? "#1c1a18" : "#211b14"
          return (
            <g key={`b-${p.agente}`} className="nv-sala-burbuja" data-burbuja={p.agente} data-luz={luz} data-uso={p.aporte?.uso ?? ""} pointerEvents="none"
              style={{ transform: `translate(${d.x}px, ${d.y}px)`, opacity: luz === "apagado" ? 0.28 : luz === "normal" || luz === "quieto" ? 0.75 : 1 } as CSSProperties}>
              {(luz === "habla" || luz === "centro") && <circle cx={b.x} cy={b.y} r={20} fill="url(#nv-av-ambar)" />}
              <rect x={b.x - 11} y={b.y - 8} width={22} height={15} rx={5} fill={fondo} stroke={color} strokeWidth={1.6} />
              <path d={`M ${b.x - 5} ${b.y + 7} l -3 6 l 8 -6 z`} fill={fondo} stroke={color} strokeWidth={1.2} strokeLinejoin="round" />
              {[-5, 0, 5].map((k) => <circle key={k} cx={b.x + k} cy={b.y - 0.5} r={1.5} fill={color} />)}
            </g>
          )
        })
      })()}
      {r && r.de_mas > 0 && <text x={SALA.mesa.x + 95} y={SALA.mesa.y + 70} fill="#ffd9a0" fontSize={18} fontFamily={FUENTE}>+{r.de_mas}</text>}
    </g>
  )
}

/** S4 · el GLOBO que se lee sin tocar: el del que está bajo el cursor; si no, el del que habla (o el último que habló) mientras la reunión sigue;
 *  al cerrar, el resultado al centro de la mesa */
export type Globo = { tipo: "participante"; p: ParticipanteDeLaSala; ancla: { x: number; y: number }; lineas: string[] } | { tipo: "resultado"; ancla: { x: number; y: number }; lineas: string[] }
export function globoVisible(r: ReunionDeLaSala | null | undefined, foco: string | null): Globo | null {
  if (!r) return null
  const deP = (p: ParticipanteDeLaSala): Globo => ({ tipo: "participante", p, ancla: posBurbuja(p.silla!), lineas: [`${p.nombre}${p.cabecera ? " · dirige" : ""} · ${p.fase}`, globoDe(p), r.estado === "terminada" && p.aporte ? `${usoLegible(p.aporte.uso)} · ${p.aporte.motivo}` : estadoLegible(p)] })
  const f = foco ? r.participantes.find((p) => p.agente === foco && p.silla) : null
  if (f) return deP(f)
  if (r.estado === "en_curso") {
    const x = r.participantes.find((p) => p.silla && luzDeLaBurbuja(p, r) === "habla") ?? r.participantes.find((p) => p.silla && luzDeLaBurbuja(p, r) === "ultimo")
    return x ? deP(x) : null
  }
  const l = lineasDelResultado(r)
  // a la derecha de la sala (no tapa la mesa ni las burbujas que llegaron al centro)
  return l.length ? { tipo: "resultado", ancla: { x: SALA.mesa.x + 100, y: SALA.mesa.y - 60 }, lineas: l } : null
}

/** el panel de la reunión al tocar el rótulo: fases, participantes (tocar = su ficha) y de dónde sale el dato */
export function PanelDeLaSala({ sala, onCerrar, onTocar }: { sala: SalaDeReuniones | null | undefined; onCerrar: () => void; onTocar: (agente: string) => void }) {
  const r = sala?.reunion ?? null
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-[.18em] text-zinc-500">Sala de reuniones</div>
          <div className="text-[14px] font-semibold text-amber-100">{r ? r.titulo : "Sala vacía"}</div>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded px-1.5 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200">×</button>
      </div>
      {!r ? (
        <p className="text-zinc-400">{sala?.ultima ? `No hay ninguna reunión ahora. La última fue ${sala.ultima.titulo} y terminó ${sala.ultima.hace}.` : "No hubo ninguna reunión en las últimas 24 horas."}</p>
      ) : (
        <>
          <p className="text-zinc-300">Dirige <b className="text-amber-100">{r.dirige}</b> ({r.equipo}) · {r.estado === "en_curso" ? "en curso" : `terminó ${r.hace}`}{r.cliente ? ` · cliente ${r.cliente}` : ""}</p>
          <ol className="space-y-1" aria-label="Fases de la reunión">
            {r.fases.map((f, i) => (
              <li key={f.nombre} data-fase={f.nombre} data-estado={f.estado} className="rounded-lg border border-white/10 px-2 py-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-zinc-100">{i + 1}. {f.nombre}</span>
                  <span className={`text-[11px] ${f.estado === "en_curso" ? "text-amber-200" : f.estado === "fallo" ? "text-red-300" : "text-zinc-500"}`}>{f.estado === "en_curso" ? "en curso" : f.estado === "fallo" ? "con fallo" : "hecha"}</span>
                </div>
                <div className="text-[11px] text-zinc-400">{f.agentes.map((a) => r.participantes.find((p) => p.agente === a)?.nombre ?? a).join(" · ")}</div>
              </li>
            ))}
          </ol>
          <ul className="space-y-0.5" aria-label="En la mesa">
            {r.participantes.map((p) => (
              <li key={p.agente} className="flex items-baseline justify-between gap-2" data-participante={p.agente}>
                <button type="button" data-abrir-ficha={p.agente} onClick={(e) => { e.stopPropagation(); onTocar(p.agente) }} className="truncate text-left underline decoration-white/20 decoration-dotted underline-offset-4 hover:text-amber-100">{p.nombre}{p.cabecera ? " · dirige" : ""}</button>
                <span className={`shrink-0 text-[11px] ${p.estado === "hablando" ? "text-amber-200" : p.estado === "fallo" ? "text-red-300" : "text-zinc-500"}`}>{p.equipo} · {estadoLegible(p)}</span>
              </li>
            ))}
          </ul>
          {sala && sala.otras_en_curso > 0 && <p className="text-[11px] text-zinc-400">Hay {sala.otras_en_curso} reunión(es) más en curso a la vez; se muestra la más reciente.</p>}
        </>
      )}
      <p className="text-[10px] text-zinc-600">{sala?.fuente ?? "sin dato todavía"}{r ? ` · corridas ${r.corridas.join(" + ")}` : ""}</p>
    </div>
  )
}
