import type { DiaDeActividad } from "@/lib/actividad"

/** barras apiladas por día: lo que salió bien (verde) y lo que falló (rojo). Sin animación; sin datos de más. */
export function ActividadChart({ dias }: { dias: DiaDeActividad[] }) {
  const max = Math.max(...dias.map((d) => d.ok + d.fallo), 1)
  const corto = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`
  return (
    <div>
      <div role="img" aria-label="Tareas de los empleados por día, últimos 14 días" className="flex h-24 items-end gap-1">
        {dias.map((d) => {
          const total = d.ok + d.fallo
          return (
            <div key={d.dia} className="flex h-full flex-1 flex-col justify-end" title={`${corto(d.dia)}: ${d.ok} bien, ${d.fallo} con problema`}>
              {total === 0 ? <div className="h-px w-full bg-white/10" /> : (
                <div className="flex w-full flex-col overflow-hidden rounded-sm" style={{ height: `${Math.max(6, (total / max) * 100)}%` }}>
                  {d.fallo > 0 && <div className="bg-rose-500/80" style={{ flex: d.fallo }} />}
                  <div className="bg-emerald-400/80" style={{ flex: d.ok || 0.0001 }} />
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-[hsl(var(--muted-foreground))]"><span>{corto(dias[0].dia)}</span><span>{corto(dias[Math.floor(dias.length / 2)].dia)}</span><span>{corto(dias[dias.length - 1].dia)}</span></div>
      <p className="mt-2 flex gap-3 text-[10px] text-[hsl(var(--muted-foreground))]"><span><i className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />Salieron bien</span><span><i className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />Con problema</span></p>
    </div>
  )
}
