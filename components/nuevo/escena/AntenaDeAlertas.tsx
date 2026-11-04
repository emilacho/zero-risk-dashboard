"use client"
/**
 * LA ANTENA (CC4 · 04-nov · encargo de Lenovo, Emilio 14:05Z): la parabólica de la plataforma de arriba a la izquierda avisa las alertas del departamento.
 * Sin alertas: no se dibuja nada (la antena de la foto queda apagada y quieta). Con alguna: se pone ROJA FIJA (sin latido, sin aura) y, al tocarla,
 * abre una lista corta en palabras simples, la más reciente arriba; cada línea lleva al lugar donde se resuelve. Se apaga sola cuando la causa se resuelve.
 */
import { useState } from "react"
import { ANTENA, type AlertaDeLaAntena } from "@/lib/escena-alertas"
import type { PanelDelMarco } from "@/lib/buscador"

const FUENTE = "Inter, system-ui, sans-serif"
const ROJO = "#ef4444"
const ANCHO_DE_LINEA = 34

export function partirEnLineas(t: string, max = ANCHO_DE_LINEA, tope = 3): string[] {
  const out: string[] = []; let cur = ""
  for (const w of t.split(/\s+/).filter(Boolean)) { if ((cur + " " + w).trim().length > max && cur) { out.push(cur); cur = w } else cur = (cur + " " + w).trim() }
  if (cur) out.push(cur)
  return out.length > tope ? [...out.slice(0, tope - 1), `${out[tope - 1].replace(/\s*\S*$/, "")}…`] : out
}

export function AntenaDeAlertas({ alertas, onAbrir }: { alertas: AlertaDeLaAntena[] | undefined; onAbrir: (p: PanelDelMarco) => void }) {
  const [abierta, setAbierta] = useState(false)
  if (!alertas?.length) return null
  const { plato, punta1, punta2, rotulo } = ANTENA
  let y = rotulo.y + 44
  const filas = alertas.map((a) => { const lineas = partirEnLineas(a.texto); const f = { a, lineas, y }; y += lineas.length * 19 + 14; return f })
  const alto = y - rotulo.y - 6
  const abrir = (e: { stopPropagation: () => void }) => { e.stopPropagation(); setAbierta((v) => !v) }
  return (
    <g className="nv-antena" data-alertas={alertas.length} data-abierta={abierta}>
      <g transform={`rotate(${plato.giro} ${plato.x} ${plato.y})`}>
        <ellipse className="nv-antena-plato" cx={plato.x} cy={plato.y} rx={plato.rx} ry={plato.ry} fill={ROJO} fillOpacity={0.22} stroke={ROJO} strokeWidth={3} />
      </g>
      <circle className="nv-antena-punta" cx={punta1.x} cy={punta1.y} r={6} fill={ROJO} />
      <circle className="nv-antena-punta" cx={punta2.x} cy={punta2.y} r={6} fill={ROJO} />
      <ellipse cx={plato.x} cy={plato.y} rx={plato.rx + 14} ry={plato.ry + 14} fill="rgba(0,0,0,0)" role="button" tabIndex={0} aria-expanded={abierta}
        aria-label={`${alertas.length === 1 ? "1 alerta" : `${alertas.length} alertas`} del departamento. Ver la lista`} style={{ cursor: "pointer", pointerEvents: "auto", outline: "none" }}
        onClick={abrir} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(e) } }} />
      {abierta && (
        <g className="nv-antena-lista" style={{ pointerEvents: "auto" }}>
          <rect x={rotulo.x - 16} y={rotulo.y - 6} width={380} height={alto + 22} rx={14} fill="#0e0c0a" fillOpacity={0.96} stroke={ROJO} strokeOpacity={0.85} />
          <text x={rotulo.x} y={rotulo.y + 22} fontFamily={FUENTE} fontSize={18} fontWeight={700} fill="#fecaca">{alertas.length === 1 ? "1 alerta" : `${alertas.length} alertas`}</text>
          {filas.map(({ a, lineas, y: y0 }) => (
            <g key={a.clave} data-alerta={a.tipo} style={{ cursor: a.abre ? "pointer" : "default" }} onClick={(e) => { e.stopPropagation(); if (a.abre) onAbrir(a.abre) }}>
              {lineas.map((l, i) => <text key={i} x={rotulo.x} y={y0 + i * 19} fontFamily={FUENTE} fontSize={15} fill="#f5e9e9">{l}</text>)}
            </g>
          ))}
        </g>
      )}
    </g>
  )
}
