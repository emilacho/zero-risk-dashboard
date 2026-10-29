/** Respuesta inmediata al tocar el menú o una tarjeta: esqueleto mientras llega la pantalla (las lecturas tardan ~1 s). */
export function Cargando() {
  return (
    <div role="status" aria-label="Cargando" className="mx-auto max-w-[1100px] px-6 pb-16 pl-24 pt-10">
      <div className="h-9 w-48 animate-pulse rounded-lg bg-white/[0.06]" />
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-white/[0.04]" />)}
      </div>
      <div className="mt-6 h-64 animate-pulse rounded-xl bg-white/[0.04]" />
    </div>
  )
}
