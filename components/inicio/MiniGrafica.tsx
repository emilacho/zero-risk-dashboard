/** Mini-gráficas de Inicio: SVG puro, sin animación. El color lo pone la tarjeta (--hue). */

/** línea con área: tendencia de una serie (p. ej. el gasto de 30 días) */
export function Tendencia({ valores, ancho = 240, alto = 44, etiqueta }: { valores: number[]; ancho?: number; alto?: number; etiqueta: string }) {
  if (valores.length < 2) return null
  const max = Math.max(...valores, 0.0001)
  const paso = ancho / (valores.length - 1)
  const y = (v: number) => alto - 3 - (v / max) * (alto - 8)
  const puntos = valores.map((v, i) => `${(i * paso).toFixed(1)},${y(v).toFixed(1)}`)
  return (
    <svg role="img" aria-label={etiqueta} viewBox={`0 0 ${ancho} ${alto}`} className="mt-3 block h-11 w-full" preserveAspectRatio="none">
      <polygon points={`0,${alto} ${puntos.join(" ")} ${ancho},${alto}`} fill="hsl(var(--hue) / 0.16)" />
      <polyline points={puntos.join(" ")} fill="none" stroke="hsl(var(--hue))" strokeWidth="1.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** barras: una por período (p. ej. piezas por semana); la última (la actual) más fuerte */
export function Barras({ items, etiqueta }: { items: Array<{ etiqueta: string; valor: number }>; etiqueta: string }) {
  const max = Math.max(...items.map((i) => i.valor), 1)
  return (
    <div role="img" aria-label={etiqueta} className="mt-3 flex h-11 items-end gap-1.5">
      {items.map((i, k) => (
        <div key={k} className="flex h-full flex-1 flex-col justify-end" title={`${i.etiqueta}: ${i.valor}`}>
          <div className="w-full rounded-sm" style={{ height: `${Math.max(i.valor > 0 ? 12 : 4, (i.valor / max) * 100)}%`, background: `hsl(var(--hue) / ${k === items.length - 1 ? 0.9 : 0.4})` }} />
        </div>
      ))}
    </div>
  )
}
