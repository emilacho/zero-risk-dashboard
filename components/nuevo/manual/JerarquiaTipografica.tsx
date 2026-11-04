"use client"

import { urlDeLasTipografias } from "@/lib/manual-barra"
import { leerJerarquia, moverDeNivel, textoDeLaJerarquia, usoCortoDelNivel, usoNombraUnaLetra, usoPracticoDelNivel } from "@/lib/jerarquia-tipografica"

/**
 * LA JERARQUÍA TIPOGRÁFICA, UNA SOLA VEZ y en el cuerpo del manual (CC4 · 03-nov · corrección de Emilio, afinada con la de CC3 y con #217 de CC6).
 * Cada letra con su nivel; ▲ / ▼ la suben o la bajan; el rótulo y el uso de cada nivel se quedan en su nivel (solo viaja la letra) y las reglas sueltas se
 * conservan tal cual. El cambio queda en espera y se guarda con «Guardar cambios» del panel (un solo botón de guardar en todo el manual).
 * Solo se pinta si el texto se entendió entero (`puedeMoverNiveles`); si no, el panel muestra el texto de siempre.
 */
export function JerarquiaTipografica({ texto, onCambiar }: {
  /** el campo como está ahora (el cambio en espera, si lo hay, o lo guardado) */
  texto: string
  onCambiar: (texto: string) => void
}) {
  const j = leerJerarquia(texto)
  const niveles = j.lineas.flatMap((x) => (x.tipo === "nivel" ? [x] : []))
  const reglas = j.lineas.flatMap((x) => (x.tipo === "regla" ? [x.texto] : []))
  const letras = [...new Set(niveles.map((n) => n.familia))]
  const fuentes = urlDeLasTipografias(letras)
  if (!niveles.length) return null
  return (
    <div data-jerarquia-tipografica>
      {fuentes && <link rel="stylesheet" href={fuentes} />}
      <ol className="space-y-2">
        {niveles.map((n, i) => (
          <li key={i} data-nivel={i + 1} className="flex items-center gap-3 rounded-md border border-white/[0.06] bg-black/20 px-3 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-400/50 text-[13px] font-semibold text-amber-200" aria-label={`Nivel ${i + 1}`}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="break-words text-[22px] leading-tight text-zinc-50" style={{ fontFamily: `"${n.familia}", system-ui, sans-serif` }}>{n.familia}</p>
              <p data-uso-del-nivel className="mt-0.5 text-[12.5px] leading-snug text-zinc-300"><span className="font-medium text-zinc-100">{n.rotulo || usoCortoDelNivel(i + 1)}.</span> {n.uso === null ? usoPracticoDelNivel(i + 1) : usoNombraUnaLetra(n.uso, letras) ? "" : n.uso}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              <button type="button" data-accion="subir-nivel" disabled={i === 0} onClick={() => onCambiar(textoDeLaJerarquia(moverDeNivel(j, i, -1)))} aria-label={`Subir ${n.familia} de nivel`} title="Subir de nivel" className="flex h-8 w-8 items-center justify-center rounded-md border border-white/15 text-[13px] text-zinc-200 hover:border-amber-400/60 hover:text-amber-200 disabled:opacity-25">▲</button>
              <button type="button" data-accion="bajar-nivel" disabled={i === niveles.length - 1} onClick={() => onCambiar(textoDeLaJerarquia(moverDeNivel(j, i, 1)))} aria-label={`Bajar ${n.familia} de nivel`} title="Bajar de nivel" className="flex h-8 w-8 items-center justify-center rounded-md border border-white/15 text-[13px] text-zinc-200 hover:border-amber-400/60 hover:text-amber-200 disabled:opacity-25">▼</button>
            </div>
          </li>
        ))}
      </ol>
      {reglas.length > 0 && <ul data-reglas-de-letras className="mt-3 list-disc space-y-1 pl-5 text-[12.5px] leading-snug text-zinc-300">{reglas.map((r, i) => <li key={i}>{r}</li>)}</ul>}
    </div>
  )
}
