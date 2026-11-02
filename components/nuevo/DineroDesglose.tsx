"use client"
/**
 * DINERO · PARTE 2 (6.37): sección 4 «desglose» (Ramp: cliente · equipo y departamento · empleado · modelo · proveedor · corrida, exportable a CSV, con el
 * freno de 24 h con su cifra, el margen y el tope suave sugerido) y sección 5 «proveedores» (Vercel Usage: consumo contra saldo o crédito, fecha de corte,
 * aviso de saldo bajo). SOLO LECTURA: el tope suave se SUGIERE; fijarlo escribe en la base y llega con su certificación.
 */
import { Fragment, useMemo, useState } from "react"
import type { Saldo, Tope } from "@/lib/direccion-riesgos"
import { colorDelMedidor, diaDelCiclo } from "@/lib/direccion-dinero"
import { aCsv, desglose, EXPLICACION_INTERNO, grupoDeCliente, PRUEBAS_Y_FICHAS_VIEJAS, TRABAJO_INTERNO, fechaCorta, NOMBRE_DE_VISTA, topeSugerido, usdCorto, type Dinero, type FilaDeDesglose, type Movimiento, type Vista } from "@/lib/dinero-completo"

const SIN_DATO = <span data-sin-dato-todavia className="italic text-zinc-500">sin dato todavía</span>
const TH = "px-2 py-2 text-left whitespace-nowrap text-[11px] font-normal uppercase tracking-[0.1em] text-zinc-500"
const TD = "px-2 py-2.5 align-middle whitespace-nowrap"

function Variacion({ v }: { v: number | null }) {
  if (v == null) return <span className="text-zinc-600">—</span>
  return <span className="tabular-nums" style={{ color: v > 0 ? "#f5a524" : v < 0 ? "#7fc99a" : "#9c948b" }}>{v > 0 ? "▲" : v < 0 ? "▼" : "•"} {Math.abs(v)} %</span>
}
function FrenoEnLinea({ t }: { t: Tope | undefined }) {
  if (!t) return <span className="text-zinc-600">—</span>
  const p = t.pct == null ? null : Math.max(0, Math.min(100, t.pct))
  return (
    <div data-freno={t.cliente ?? "sin-cliente"} className="min-w-[130px]">
      <span data-cifra-del-freno className="tabular-nums text-zinc-200">{t.gastado_24h_usd == null ? "sin dato" : usdCorto(t.gastado_24h_usd)} de {t.techo_usd == null ? "sin dato" : usdCorto(t.techo_usd)}</span>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full" style={{ width: `${p ?? 0}%`, background: colorDelMedidor(p) }} /></div>
    </div>
  )
}

function descargar(nombre: string, texto: string) {
  const url = URL.createObjectURL(new Blob(["﻿" + texto], { type: "text/csv;charset=utf-8" }))
  const a = document.createElement("a"); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}

export function Desglose({ datos, rango, anterior, hoy, alAbrirCorrida }: { datos: Dinero; rango: { desde: string; hasta: string }; anterior?: { desde: string; hasta: string }; hoy: string; alAbrirCorrida?: (id: string) => void }) {
  const [vista, setVista] = useState<Vista>("cliente")
  const filas = useMemo(() => desglose(datos.movimientos, vista, rango, anterior), [datos, vista, rango, anterior])
  const [verPruebas, setVerPruebas] = useState(false)
  const topes = useMemo(() => new Map(datos.topes.filter((t) => t.client_id).map((t) => [t.client_id as string, t])), [datos])
  const esAparte = (clave: string) => clave === TRABAJO_INTERNO || clave === PRUEBAS_Y_FICHAS_VIEJAS
  /** 6.39 · un cliente juntado de varias fichas muestra el freno de la ficha que más gastó en 24 h; pruebas e interno no llevan freno */
  const frenoDe = (f: FilaDeDesglose): Tope | undefined => (esAparte(f.clave) ? undefined : (f.ids ?? []).map((id) => topes.get(id)).filter((t): t is Tope => !!t).sort((a, b) => (b.gastado_24h_usd ?? 0) - (a.gastado_24h_usd ?? 0))[0])
  // 6.39 · orden: los clientes de verdad por gasto, luego el trabajo interno y al final la fila de pruebas; los clientes con freno y sin gasto también aparecen
  const lista: FilaDeDesglose[] = useMemo(() => {
    if (vista !== "cliente") return filas.slice(0, vista === "corrida" ? 60 : 200)
    const vistos = new Set(filas.map((f) => f.clave)), extra: FilaDeDesglose[] = []
    for (const t of datos.topes) {
      const g = grupoDeCliente(t.cliente, t.client_id).cliente
      if (vistos.has(g) || esAparte(g)) { const f = filas.find((x) => x.clave === g); if (f && t.client_id && !(f.ids ?? []).includes(t.client_id)) f.ids = [...(f.ids ?? []), t.client_id]; continue }
      vistos.add(g); extra.push({ clave: g, nombre: g, usd: 0, pct: 0, anterior: 0, variacion_pct: null, llamadas: 0, client_id: t.client_id, ids: t.client_id ? [t.client_id] : [] })
    }
    const rango = (f: FilaDeDesglose) => (f.clave === PRUEBAS_Y_FICHAS_VIEJAS ? 2 : f.clave === TRABAJO_INTERNO ? 1 : 0)
    return [...filas, ...extra].sort((a, b) => rango(a) - rango(b) || b.usd - a.usd)
  }, [filas, vista, datos])
  const sugerido = (f: FilaDeDesglose) => (esAparte(f.clave) ? null : topeSugerido(datos.movimientos, (x: Movimiento) => vista === "cliente" && x.cliente === f.clave, hoy))
  const exportar = () => descargar(`gasto-por-${vista}-${rango.desde}-a-${rango.hasta}.csv`, aCsv(lista.map((f) => ({
    [NOMBRE_DE_VISTA[vista]]: vista === "corrida" ? `${f.dia} · ${f.detalle} · ${f.nombre}` : f.nombre, "Gasto (US$)": f.usd.toFixed(4), "% del total": f.pct, "Período anterior (US$)": f.anterior.toFixed(4), "Variación %": f.variacion_pct ?? "", Llamadas: f.llamadas,
    ...(vista === "cliente" ? { "Freno 24 h gastado (US$)": frenoDe(f)?.gastado_24h_usd ?? "", "Freno 24 h techo (US$)": frenoDe(f)?.techo_usd ?? "", "Tope suave sugerido (US$/mes)": sugerido(f) ?? "" } : {}),
  }))))
  const sinEquipo = vista === "equipo" && datos.movimientos.every((x) => !x.equipo)
  return (
    <section data-dinero="desglose" className="rounded-xl border border-white/[0.09] bg-[#1b1815] p-4 sm:p-5">
      <div role="tablist" aria-label="Desglose" className="-mt-1 mb-3 flex flex-wrap items-center gap-1 border-b border-white/[0.09]">
        {(Object.keys(NOMBRE_DE_VISTA) as Vista[]).map((v) => (
          <button key={v} type="button" role="tab" data-vista={v} aria-selected={vista === v} onClick={() => setVista(v)}
            className={`px-2.5 py-2 text-[12.5px] ${vista === v ? "text-zinc-100 shadow-[inset_0_-2px_0_#e8731a]" : "text-zinc-400 hover:text-zinc-200"}`}>{NOMBRE_DE_VISTA[v]}</button>
        ))}
        <button type="button" data-csv onClick={exportar} disabled={!lista.length} className="ml-auto rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] disabled:opacity-40">Exportar CSV</button>
      </div>
      {sinEquipo ? <p className="py-3 text-[13px]">{SIN_DATO}</p> : (
        <div className="max-h-[420px] overflow-auto [scrollbar-width:thin]">
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 bg-[#1b1815]"><tr className="border-b border-white/[0.09]">
              <th className={TH}>{NOMBRE_DE_VISTA[vista]}</th><th className={TH}>Gasto</th><th className={TH}>%</th><th className={TH}>vs anterior</th>
              {vista === "cliente" && <><th className={TH}>Freno 24 h</th><th className={TH}>Margen</th><th className={TH}>Tope suave</th></>}
              {vista === "corrida" && <th className={TH} />}
            </tr></thead>
            <tbody>
              {lista.map((f) => (
                <Fragment key={f.clave}>
                <tr data-fila={f.clave} className="border-b border-white/[0.05] hover:bg-white/[0.02]">
                  <td className={`${TD} !whitespace-normal min-w-[150px]`}>{vista === "corrida" ? <><span className="text-zinc-100">{f.nombre}</span><span className="block text-[11.5px] text-zinc-500">{fechaCorta(f.dia!)} · {f.detalle}</span></>
                    : vista === "cliente" && f.clave === PRUEBAS_Y_FICHAS_VIEJAS ? <button type="button" data-desplegar-pruebas aria-expanded={verPruebas} onClick={() => setVerPruebas((v) => !v)} className="text-left text-zinc-300 hover:text-zinc-100"><span className="inline-block w-4 text-zinc-500">{verPruebas ? "▾" : "▸"}</span>{f.nombre}<span className="block pl-4 text-[11.5px] text-zinc-500">{f.fichas?.length ?? 0} {(f.fichas?.length ?? 0) === 1 ? "ficha" : "fichas"} · se ordena solo cuando se limpien los datos</span></button>
                    : vista === "cliente" && f.clave === TRABAJO_INTERNO ? <><span className="text-zinc-100">{f.nombre}</span><span data-explicacion-interno className="block max-w-[260px] text-[11.5px] text-zinc-500">{EXPLICACION_INTERNO}</span></>
                    : <span className="text-zinc-100">{f.nombre}</span>}</td>
                  <td className={`${TD} tabular-nums text-zinc-100`}>{usdCorto(f.usd)}</td>
                  <td className={TD}><span className="inline-flex items-center gap-2"><span className="h-1 w-16 overflow-hidden rounded-full bg-white/[0.07]"><span className="block h-full bg-[#e8731a]" style={{ width: `${Math.min(100, f.pct)}%` }} /></span><span className="tabular-nums text-zinc-400">{f.pct.toLocaleString("es-EC")} %</span></span></td>
                  <td className={TD}><Variacion v={f.variacion_pct} /></td>
                  {vista === "cliente" && <>
                    <td className={TD}><FrenoEnLinea t={frenoDe(f)} /></td>
                    <td data-margen className={TD}>{esAparte(f.clave) ? <span className="text-zinc-600">—</span> : SIN_DATO}</td>
                    <td className={TD}>{(() => { const s = sugerido(f); return s == null ? <span className="text-zinc-600">—</span> : <span data-tope-sugerido className="text-zinc-300">sugerido {usdCorto(s)}/mes</span> })()}</td>
                  </>}
                  {vista === "corrida" && <td className={TD}>{alAbrirCorrida && <button type="button" onClick={() => alAbrirCorrida(f.corrida!)} className="text-[12px] text-zinc-200 underline decoration-amber-600/60 underline-offset-2 hover:decoration-amber-400">Ver la corrida →</button>}</td>}
                </tr>
                {vista === "cliente" && f.clave === PRUEBAS_Y_FICHAS_VIEJAS && verPruebas && (f.fichas ?? []).map((x) => (
                  <tr key={x.nombre} data-ficha={x.nombre} className="border-b border-white/[0.04] bg-black/20 text-[12.5px]">
                    <td className={`${TD} !whitespace-normal pl-8 text-zinc-400`}>{x.nombre}</td>
                    <td className={`${TD} tabular-nums text-zinc-300`}>{usdCorto(x.usd)}</td>
                    <td className={TD} colSpan={5} />
                  </tr>
                ))}
                </Fragment>
              ))}
              {!lista.length && <tr><td className={`${TD} text-zinc-500`} colSpan={7}>Sin gasto en este período</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[12px] text-zinc-500">
        {vista === "cliente" && "Las fichas repetidas de un mismo cliente se suman en una fila. El freno es el mismo con que se detiene a los empleados de ese cliente. El tope suave solo avisa (no bloquea) y sale de la tendencia de 30 días; fijarlo desde aquí llega con su certificación. El margen aparece cuando exista lo que se cobra a cada cliente."}
        {vista === "equipo" && "Base del panel de gastos de cada oficina: el equipo sale del organigrama vivo."}
        {vista === "corrida" && "Las 60 corridas que más gastaron en el período; cada una abre su detalle en Observabilidad."}
      </p>
    </section>
  )
}

/** sección 5 · proveedores, como el Usage de Vercel: una barra por recurso (consumo contra saldo o crédito), fecha de corte y aviso de saldo bajo */
export const PROVEEDORES = ["Anthropic", "GPT (OpenAI)", "Apify", "Higgsfield", "Railway", "Vercel", "Supabase"] as const
export function Proveedores({ datos, rango }: { datos: Dinero; rango: { desde: string; hasta: string } }) {
  const consumo = useMemo(() => { const m = new Map<string, number>(); for (const x of datos.movimientos) if (x.d >= rango.desde && x.d <= rango.hasta) m.set(x.proveedor, (m.get(x.proveedor) ?? 0) + x.usd); return m }, [datos, rango])
  const saldoDe = (p: string): Saldo | undefined => datos.saldos.find((s) => s.proveedor.toLowerCase() === p.toLowerCase() || p.toLowerCase().startsWith(s.proveedor.toLowerCase()))
  const extra = [...consumo.keys()].filter((p) => !(PROVEEDORES as readonly string[]).includes(p))
  return (
    <section data-dinero="proveedores" className="rounded-xl border border-white/[0.09] bg-[#1b1815] p-4 sm:p-5">
      <h3 className="mb-3 text-[12px] uppercase tracking-[0.2em] text-[#ffb86b]">Proveedores · consumo contra saldo</h3>
      <div className="divide-y divide-white/[0.05]">
        {[...PROVEEDORES, ...extra].map((p) => {
          const s = saldoDe(p), c = consumo.get(p) ?? null
          const pct = s?.pct == null ? null : Math.max(0, Math.min(100, s.pct)), color = colorDelMedidor(pct), cierra = diaDelCiclo(s?.ciclo_hasta ?? null)
          const bajo = pct != null && pct >= 85
          return (
            <div key={p} data-saldo={p} className="grid grid-cols-[130px_1fr] items-center gap-3 py-2.5 text-[13px]">
              <span className="text-zinc-100">{p}{bajo && <span data-saldo-bajo className="ml-2 rounded-full border border-rose-400/40 px-1.5 text-[10.5px] text-rose-300">saldo bajo</span>}</span>
              <div className="min-w-0">
                {s ? <>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full" style={{ width: `${pct ?? 0}%`, background: color }} /></div>
                  <p className="mt-1 text-[12px] text-zinc-400"><span className="tabular-nums text-zinc-200">{s.usado_usd == null ? "sin dato" : usdCorto(s.usado_usd)} de {s.credito_usd == null ? "sin dato" : usdCorto(s.credito_usd)}</span>{s.plan ? ` · plan ${s.plan}` : ""}{cierra ? ` · corte el ${cierra}` : ""}{s.credito_usd != null && s.usado_usd != null ? ` · quedan ${usdCorto(Math.max(0, s.credito_usd - s.usado_usd))}` : ""}</p>
                </> : <p className="text-[12px] text-zinc-400">saldo: {SIN_DATO}{c != null && <> · <span className="text-zinc-300">consumo del período <span className="tabular-nums">{usdCorto(c)}</span></span></>}{c == null && ["Railway", "Vercel", "Supabase"].includes(p) && <> · plan fijo mensual</>}</p>}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
