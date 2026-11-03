"use client"

import type { ManualDelCliente } from "@/lib/manual-datos"
import type { CampoLeido } from "@/lib/manual-lector"
import { contrasteDelTexto, rolDeLaLetraLegible, rolDelColorLegible } from "@/lib/manual"
import { frasesDelCliente, personalidadCorta, urlDeLasTipografias } from "@/lib/manual-barra"
import { soloLaFrase } from "@/lib/manual-limpio"

const AMBAR = "#f5a524"
type Manual = NonNullable<ManualDelCliente["manual"]>

function Bloque({ titulo, children, nota, id }: { titulo: string; children: React.ReactNode; nota?: string | null; id: string }) {
  return (
    <section data-barra={id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3.5">
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em]" style={{ color: AMBAR }}>{titulo}</h3>
      {children}
      {nota && <p className="mt-1.5 text-[10.5px] text-zinc-500">{nota}</p>}
    </section>
  )
}
const Chip = ({ children, tono = "neutro" }: { children: React.ReactNode; tono?: "neutro" | "marca" }) => (
  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11.5px] ${tono === "marca" ? "border-emerald-400/50 text-emerald-200" : "border-white/15 text-zinc-300"}`}>{children}</span>
)

/**
 * LA BARRA LATERAL DEL MANUAL (CC6 · 02-nov · boceto aprobado por Emilio tal cual): fija al bajar, con lo esencial del manual a la vista mientras se lee.
 * Datos reales: si algo no existe, se dice que falta. Los textos largos siguen en sus tarjetas de la izquierda; aquí va lo corto.
 */
export function BarraDelManual({ m, nombre, campos, faltan, huecos, irA }: {
  m: Manual
  /** el nombre del cliente: la primera tipografía lo escribe con su letra */
  nombre: string | null
  campos: Map<string, CampoLeido>
  /** si un campo lo validó o escribió el dueño */
  delDueno: (c: CampoLeido) => boolean
  /** las etiquetas de lo que falta */
  faltan: string[]
  /** las claves de lo que falta, en el mismo orden que `faltan` (campos de siempre + secciones nuevas) */
  huecos?: string[]
  /** llevar a la tarjeta de un campo (al tocar un faltante) */
  irA: (clave: string) => void
}) {
  const fuentes = urlDeLasTipografias(m.tipografias.map((t) => t.familia))
  const personalidad = personalidadCorta(campos.get("personalidad")?.valor ?? null)
  // 03-nov · manual limpio: la frase sola, sin la justificación que el empleado deja pegada («… — responde a la objeción…»)
  const frases = [...new Set(frasesDelCliente(campos.get("eslogan")?.valor ?? null, m.opciones_eslogan).map(soloLaFrase).filter(Boolean))]
  const aEvitar = (m.palabras ?? []).map((p) => p.texto)
  const barra = m.barra ?? { logo: null, fotos: [], sedes: [], canales: [] }
  return (
    <aside aria-label="Lo esencial del manual" data-barra-del-manual className="mn-seccion space-y-3 lg:sticky lg:top-0 lg:max-h-[calc(100vh-10rem)] lg:self-start lg:overflow-y-auto lg:pr-1" style={{ animationDelay: "120ms" }}>
      {fuentes && <link rel="stylesheet" href={fuentes} />}

      {/* 03-nov 08:20Z · Emilio: lo que falta, para él, en UNA línea discreta (no en el documento) */}
      {faltan.length > 0 && (
        <p data-barra="estado" className="px-1 text-[12px] leading-relaxed text-zinc-500">
          <span className="text-zinc-400">Por completar: </span>
          {(huecos ?? m.lector.huecos).map((k, i) => <span key={k}>{i > 0 && " · "}<button type="button" data-ir-campo={k} onClick={() => irA(k)} className="underline decoration-dotted underline-offset-2 hover:text-amber-200">{faltan[i]}</button></span>)}
        </p>
      )}

      {m.colores.length > 0 && <Bloque id="colores" titulo="Colores">
        {(
          <ul className="grid grid-cols-6 gap-1.5" aria-label="La paleta">
            {m.colores.map((c, i) => (
              <li key={`${c.hex}-${i}`} aria-label={`${c.hex} · ${rolDelColorLegible(c.rol)}`}>
                <div className="mn-color flex h-10 items-end rounded-md p-0.5 ring-1 ring-white/10" style={{ background: c.hex }} data-color={c.hex}><span className="font-mono text-[8.5px]" style={{ color: contrasteDelTexto(c.hex) }}>{c.hex.replace("#", "")}</span></div>
              </li>
            ))}
          </ul>
        )}
        {m.colores.some((c) => c.rol) && <p className="mt-1 text-[10.5px] text-zinc-400">{m.colores.filter((c) => c.rol).map((c) => rolDelColorLegible(c.rol)).join(" · ")}{m.colores.filter((c) => !c.rol).length ? ` · ${m.colores.filter((c) => !c.rol).length} más` : ""}</p>}
      </Bloque>}

      {m.tipografias.length > 0 && <Bloque id="tipografias" titulo="Tipografías">
        {(
          <ul className="space-y-1.5">
            {m.tipografias.map((t, i) => (
              <li key={`${t.familia}-${i}`} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[19px] leading-tight text-zinc-50" style={{ fontFamily: `"${t.familia}", system-ui, sans-serif` }}>{i === 0 && nombre ? nombre : t.familia}</span>
                <span className="shrink-0 text-[10.5px] text-zinc-500">{t.familia}{t.rol ? ` · ${rolDeLaLetraLegible(t.rol)}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </Bloque>}

      {(m.jerarquia_tipografica ?? []).length > 0 && (
        <Bloque id="jerarquia" titulo="Jerarquía tipográfica">
          <ul className="space-y-1">{m.jerarquia_tipografica!.map((j) => <li key={j.uso} className="flex items-baseline justify-between gap-3"><span className="text-[11.5px] text-zinc-400">{j.uso}</span><span className="truncate text-[15px] text-zinc-100" style={{ fontFamily: `"${j.familia}", system-ui, sans-serif` }}>{j.familia}</span></li>)}</ul>
        </Bloque>
      )}

      {(barra.logo || barra.fotos.length > 0) && <Bloque id="logo-y-fotos" titulo="Logo y estilo de fotos">
        {(
          <div className="grid grid-cols-4 gap-1.5">
            {barra.logo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={barra.logo.url} alt="Logo" className="aspect-square w-full rounded-md bg-white object-contain p-1" loading="lazy" />
              : null}
            {barra.fotos.slice(0, barra.logo ? 7 : 8).map((f) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={f.url} src={f.url} alt={f.que_muestra ?? "Foto del cliente"} title={f.que_muestra ?? undefined} className="aspect-square w-full rounded-md object-cover" loading="lazy" />
            ))}
          </div>
        )}
      </Bloque>}

      {personalidad.length > 0 && <Bloque id="personalidad" titulo="Personalidad en pocas palabras">
        <div className="flex flex-wrap gap-1.5">{personalidad.map((p) => <Chip key={p}>{p}</Chip>)}</div>
      </Bloque>}

      {frases.length > 0 && <Bloque id="frases" titulo="Frases de la marca">
        {frases.map((f) => <p key={f} className="text-[13px] italic leading-snug text-zinc-100">«{f}»</p>)}
      </Bloque>}

      {(m.terminos_propios.length > 0 || aEvitar.length > 0) && <Bloque id="palabras" titulo="Palabras">
        {m.terminos_propios.length > 0 && <><p className="text-[10.5px] text-zinc-500">de la marca</p>
        <div className="mb-1.5 mt-0.5 flex flex-wrap gap-1.5">{m.terminos_propios.slice(0, 8).map((t) => <Chip key={t} tono="marca">{t}</Chip>)}{m.terminos_propios.length > 8 && <Chip>+{m.terminos_propios.length - 8}</Chip>}</div></>}
        {aEvitar.length > 0 && <><p className="text-[10.5px] text-zinc-500">a evitar</p>
        <div className="mt-0.5 flex flex-wrap gap-1.5">{aEvitar.slice(0, 8).map((t) => <Chip key={t}>{t}</Chip>)}{aEvitar.length > 8 && <Chip>+{aEvitar.length - 8}</Chip>}</div></>}
      </Bloque>}

      {(barra.sedes.length > 0 || barra.canales.length > 0) && <Bloque id="sedes-y-canales" titulo="Sedes y horarios · canales">
        {barra.sedes.length > 0 && (
          <ul className="space-y-1.5">
            {barra.sedes.map((s) => (
              <li key={s.ciudad} className="text-[12.5px] leading-snug">
                <span className="font-medium text-zinc-100">{s.ciudad}</span>{s.estado && <span className="text-zinc-300"> · {s.estado}</span>}{s.atencion && <span className="text-zinc-400"> · {s.atencion}</span>}
                {s.horario && <span className="block text-zinc-300">{s.horario}</span>}
                {s.direccion && <span className="block text-[11.5px] text-zinc-400">{s.direccion}</span>}
              </li>
            ))}
          </ul>
        )}
        {barra.canales.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{barra.canales.map((c) => c.url ? <a key={c.red + c.cuenta} href={c.url} target="_blank" rel="noreferrer" className="rounded-full border border-white/15 px-2 py-0.5 text-[11.5px] text-zinc-300 hover:border-amber-400/60 hover:text-amber-100">{c.red} · {c.cuenta}</a> : <Chip key={c.red + c.cuenta}>{c.red} · {c.cuenta}</Chip>)}</div>}
      </Bloque>}
    </aside>
  )
}
