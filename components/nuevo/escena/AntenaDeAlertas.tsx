"use client"
/**
 * LA ANTENA (CC4 · 04-nov · Emilio eligió la opción 3 con animación sutil, 15:19Z): la parabólica de la plataforma de arriba a la izquierda avisa las alertas del departamento.
 * Sin alertas: las dos lucecitas de la foto se APAGAN (regla de Emilio 09-nov, ver `LucesApagadas`) y no hay número. Con alguna: la luz de la punta mayor respira en rojo con un aura suave, CENTRADA en la lucecita de la foto (505,257 medido en la foto de 2560 px),
 * y el borde de la plataforma queda COMO EN LA FOTO (su línea naranja de siempre): solo un tramo corto de luz roja viaja por dentro de esa línea, en sentido del reloj. Al tocarla se abre un panel con la lista (mismo marco que los demás).
 * Luces pequeñas y realistas sobre la foto: nada de formas planas.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { ANTENA, BORDE_DE_LA_ANTENA, esNuevaEnLaAntena, nuevasDeLaAntena, numeroDeLaAntena, renglonesDeLaAntena, type AlertaDeLaAntena } from "@/lib/escena-alertas"
import { BotonRevisar } from "@/components/nuevo/BotonRevisar"
import { PanelPiezas } from "@/components/nuevo/PanelPiezas"
import { marcarRevisada } from "@/lib/revisar-alerta"
import type { FilaDeLaLista } from "@/lib/piezas-datos"
import { ConNombres } from "@/components/nuevo/FichaDeDecision"
import type { PanelDelMarco } from "@/lib/buscador"
import { haceCuanto } from "@/lib/direccion-decisiones"
/** «Hace 9 horas», como en la imagen aprobada (CC6 #296) */
const conMayuscula = (s: string) => s.charAt(0).toLocaleUpperCase("es") + s.slice(1)
import { PanelBase } from "@/components/nuevo/EstiloBase"

export const CSS_DE_LA_ANTENA = `
@keyframes nvAntPulso{0%,100%{opacity:.5;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}
@keyframes nvAntCorre{from{stroke-dashoffset:0}to{stroke-dashoffset:-100}}
.nv-antena .nv-antena-pulso{animation:nvAntPulso 2.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.nv-antena .nv-antena-corre{animation:nvAntCorre 4.2s linear infinite}
@media (prefers-reduced-motion:reduce){.nv-antena .nv-antena-pulso,.nv-antena .nv-antena-corre{animation:none}}`
// la animación vive en la hoja (NO inline): un estilo inline le ganaría a «reducir movimiento» (CC3 04-nov)

/**
 * 09-nov (regla de Emilio): la luz de la antena SOLO se prende cuando hay una alerta. La foto trae encendidas sus dos lucecitas
 * (las puntas, medidas en marketing-2560: 505,257 y 369,342, con brillo de ~18 px) y un brillo cálido en el centro del plato (446,338); se apagan SIEMPRE dibujando encima una bombilla
 * apagada (gris oscuro) con un velo oscuro que se desvanece. Con alertas, solo la punta mayor se prende, en rojo, encima.
 */
export const LUCES_DE_LA_FOTO = [
  { clave: "mayor", ...ANTENA.punta2, r: 20, fondo: "#070605" },
  { clave: "menor", ...ANTENA.punta1, r: 15, fondo: "#070605" },
  { clave: "plato", x: 446, y: 338, r: 9, fondo: "#423f3c" }, // dentro del plato el fondo es gris, no negro
] as const
export function LucesApagadas() {
  return (
    <g data-luces-apagadas aria-hidden style={{ pointerEvents: "none" }}>
      <defs>
        {LUCES_DE_LA_FOTO.map((l) => (
          <radialGradient key={l.clave} id={`nvAntApaga-${l.clave}`} cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor={l.fondo} /><stop offset=".55" stopColor={l.fondo} stopOpacity=".92" /><stop offset="1" stopColor={l.fondo} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      {LUCES_DE_LA_FOTO.map((l) => (
        <g key={l.clave} data-luz-apagada={l.clave}>
          <circle cx={l.x} cy={l.y} r={l.r} fill={`url(#nvAntApaga-${l.clave})`} />
          <circle cx={l.x} cy={l.y} r={3.2} fill="#24221f" />
        </g>
      ))}
    </g>
  )
}

export function AntenaDeAlertas({ alertas, onAbrir }: { alertas: AlertaDeLaAntena[] | undefined; onAbrir: () => void }) {
  if (!alertas?.length) return <LucesApagadas />
  const { punta2 } = ANTENA
  const n = numeroDeLaAntena(alertas)
  const abrir = (e: { stopPropagation: () => void }) => { e.stopPropagation(); onAbrir() }
  return (
    <g className="nv-antena" data-alertas={n}>
      <LucesApagadas />
      <style>{CSS_DE_LA_ANTENA}</style>
      <defs>
        <radialGradient id="nvAntRojo" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff1ee" /><stop offset=".18" stopColor="#ff5a4a" /><stop offset=".55" stopColor="#d81a10" stopOpacity=".55" /><stop offset="1" stopColor="#d81a10" stopOpacity="0" />
        </radialGradient>
        <filter id="nvAntDifumina"><feGaussianBlur stdDeviation="1.6" /></filter>
      </defs>
      {/* el borde NO se enciende: la línea naranja de la foto queda como está y solo un tramo corto de luz roja viaja por dentro de ella (mismo trazo que la línea) */}
      <g filter="url(#nvAntDifumina)" fill="none" strokeLinejoin="round" strokeLinecap="round">
        <path className="nv-antena-corre" d={BORDE_DE_LA_ANTENA} pathLength={100} stroke="#ff3b2a" strokeWidth={2.6} strokeDasharray="5 95" />
      </g>
      {/* 06-nov (Emilio 01:51 local): el número de avisos va SOLO, en rojo, sin círculo ni fondo (el fondo de la foto ya es negro), arriba a la derecha de la luz */}
      <text data-numero-antena x={punta2.x + 30} y={punta2.y - 26} className="fill-alarma font-medio" fontSize={40} aria-hidden style={{ fontVariantNumeric: "tabular-nums" }}>{n}</text>
      {/* la luz de la punta mayor: aura suave que respira, sin círculo plano */}
      <g className="nv-antena-pulso">
        <circle cx={punta2.x} cy={punta2.y} r={28} fill="url(#nvAntRojo)" />
        <circle cx={punta2.x} cy={punta2.y} r={4} fill="#fff4f0" />
      </g>
      <ellipse cx={ANTENA.plato.x} cy={ANTENA.plato.y} rx={ANTENA.plato.rx + 14} ry={ANTENA.plato.ry + 14} fill="rgba(0,0,0,0)" role="button" tabIndex={0}
        aria-label={`${typeof n === "string" ? "Alertas sin dato de revisión" : n === 1 ? "1 alerta" : `${n} alertas`} del departamento. Ver la lista`} style={{ cursor: "pointer", pointerEvents: "auto", outline: "none" }}
        onClick={abrir} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(e) } }} />
    </g>
  )
}

/** a dónde lleva cada aviso, en palabras del menú */
const NOMBRE_DEL_LUGAR: Partial<Record<PanelDelMarco, string>> = { envivo: "En vivo", observabilidad: "Observabilidad", decisiones: "Decisiones", riesgos: "Riesgos", piezas: "Piezas", aplicaciones: "Centro de campaña", organizacion: "Organización" }

/**
 * LA LISTA DE LA ANTENA EN ESTILO BASE (boceto aprobado por Emilio 06-nov 01:51 local): se abre encima y sigues en Dept. Marketing.
 * Título ALERTAS en oro con la ✕, «Dept. Marketing», un recuadro con el número en rojo y cada aviso con su punto rojo, cuándo pasó y qué abre.
 */
/** tocar un aviso (CC6 06-nov, prueba del clic): si tiene lugar, cierra la lista y abre ese lugar; sin lugar no hace nada */
export function alTocarElAviso(a: AlertaDeLaAntena, h: { cerrar: () => void; abrir: (panel: PanelDelMarco) => void }): boolean {
  if (!a.abre) return false
  h.cerrar(); h.abrir(a.abre)
  return true
}

/** Esc cierra SOLO la lista (en captura, sin que llegue a la oficina); devuelve cómo soltarlo al cerrar */
export function escucharEsc(w: Pick<Window, "addEventListener" | "removeEventListener">, onCerrar: () => void): () => void {
  const tecla = (e: KeyboardEvent) => { if (e.key !== "Escape") return; e.stopPropagation(); e.preventDefault(); onCerrar() }
  w.addEventListener("keydown", tecla as EventListener, true)
  return () => w.removeEventListener("keydown", tecla as EventListener, true)
}

/** 11-nov (boceto v2 aprobado por Emilio 20:47 Zúrich) · el botón del visor abierto desde aquí */
export const VOLVER_A_LAS_ALERTAS = "Volver a las alertas"

/** la línea corta de estado de una pieza en el renglón desplegado (sin precios, sin códigos) */
export function estadoCortoDeLaPieza(f: Pick<FilaDeLaLista, "tiene_dibujo" | "incompleta"> | null | undefined): string {
  if (!f) return "Espera tu aprobación"
  if (!f.tiene_dibujo) return "Sin dibujo: la decide una persona"
  if (f.incompleta) return "La revisión no terminó"
  return "Lista para tu aprobación"
}

/**
 * 11-nov · LA LISTA ABRE EN EL LUGAR (Emilio 20:30: «que no me lleve a Decisiones en mi oficina, sino que abra esa instancia in situ»).
 * Tocar una pieza abre su visor encima; cerrarlo deja la lista como estaba (desplegada). Abrirla la marca como vista (lo que hacía «✓ Revisar», boceto v2).
 * Los nombres y miniaturas salen de la bandeja (`/api/bandeja`, la misma lectura del visor); si no llega, el renglón dice lo que trae el aviso.
 */
export function PanelDeLasAlertas(p: PropsDeLaLista) {
  const { onCerrar, fetchImpl, revisadasAqui = {}, alRevisar } = p
  const [abierta, setAbierta] = useState<AlertaDeLaAntena | null>(null)
  const [desplegados, setDesplegados] = useState<Record<string, boolean>>({})
  const [piezas, setPiezas] = useState<Record<string, FilaDeLaLista> | null>(null)
  // con el visor abierto, Esc es del visor (cierra un diálogo o vuelve a la lista); la lista no se cierra por debajo
  useEffect(() => escucharEscDeLaLista(window, onCerrar, !!abierta), [onCerrar, abierta])
  const hayPiezas = (p.alertas ?? []).some((a) => a.pieza)
  useEffect(() => {
    if (!hayPiezas || piezas) return
    let vivo = true
    void leerLasPiezas(fetchImpl ?? fetch).then((m) => { if (vivo && m) setPiezas(m) })
    return () => { vivo = false }
  }, [hayPiezas, piezas, fetchImpl])
  const alAbrirPieza = useCallback((a: AlertaDeLaAntena) => {
    setAbierta(a)
    void marcarVistaAlAbrir(a, { revisadasAqui, fetchImpl: fetchImpl ?? fetch, alRevisar })
  }, [fetchImpl, revisadasAqui, alRevisar])
  return enElCuerpo(
    <>
      {ListaDeLasAlertas({ ...p, desplegados, alDesplegar: (clave) => setDesplegados((m) => ({ ...m, [clave]: !m[clave] })), alAbrirPieza, piezas })}
      {abierta?.pieza && <PanelPiezas key={abierta.pieza} piezaInicial={abierta.pieza} soloLaPieza={{ volverA: VOLVER_A_LAS_ALERTAS }} onCerrar={() => setAbierta(null)} fetchImpl={fetchImpl} />}
    </>,
  )
}

/** Esc de la lista: solo mientras NO hay una pieza abierta encima (entonces es del visor). Devuelve cómo soltarlo, o nada */
export function escucharEscDeLaLista(w: Pick<Window, "addEventListener" | "removeEventListener">, onCerrar: () => void, hayPiezaAbierta: boolean): (() => void) | undefined {
  return hayPiezaAbierta ? undefined : escucharEsc(w, onCerrar)
}

/** abrir una pieza NUEVA la marca como vista (boceto v2: reemplaza al «✓ Revisar» del grupo); una ya vista no se vuelve a guardar. true si se guardó */
export async function marcarVistaAlAbrir(a: AlertaDeLaAntena, h: { revisadasAqui: Record<string, string>; fetchImpl: typeof fetch; alRevisar?: (clave: string, en: string) => void }): Promise<boolean> {
  const r = a.revisar
  if (!r || !esNuevaEnLaAntena(a, h.revisadasAqui)) return false
  const x = await marcarRevisada(h.fetchImpl, r.clave)
  if (!x.ok) return false
  h.alRevisar?.(r.clave, x.en)
  return true
}

/** los nombres legibles y lo que hace falta para la miniatura, de la bandeja de piezas por aprobar; null si no se pudo leer */
export async function leerLasPiezas(fetchImpl: typeof fetch): Promise<Record<string, FilaDeLaLista> | null> {
  try {
    const r = await fetchImpl("/api/bandeja?estado=pendiente", { cache: "no-store" })
    const j = (await r.json().catch(() => null)) as { ok?: boolean; piezas?: FilaDeLaLista[] } | null
    if (!r.ok || !j?.ok || !Array.isArray(j.piezas)) return null
    return Object.fromEntries(j.piezas.map((f) => [f.id, f]))
  } catch { return null }
}

/**
 * 09-nov (CORRECCIÓN de Lenovo, Emilio en producción): la lista va al <body>, como los demás paneles. Dentro de la escena heredaba
 * `.nv-av{pointer-events:none}`: la ✕ no cerraba y el clic en un aviso caía en la mesa de abajo (abría el plantel de Estrategia).
 * Sin documento (servidor y pruebas sin navegador) se dibuja en el lugar.
 */
export function enElCuerpo(lista: ReactNode) {
  return typeof document === "undefined" ? lista : createPortal(lista, document.body)
}

/** lo que se dibuja (sin ganchos de React: se puede probar el clic llamándola) */
interface PropsDeLaLista {
  alertas: AlertaDeLaAntena[] | undefined; onAbrir: (a: AlertaDeLaAntena) => void; onCerrar: () => void; ahora?: number
  /** 10-nov · las decisiones que marcaste en esta visita (clave → cuándo), para que el número baje sin esperar la próxima lectura */
  revisadasAqui?: Record<string, string>
  /** «✓ Revisar» guardó: la escena lo anota y la antena deja de contarla */
  alRevisar?: (clave: string, en: string) => void
  fetchImpl?: typeof fetch
  /** 11-nov · qué renglones agrupados están desplegados (clave del grupo → sí) */
  desplegados?: Record<string, boolean>
  alDesplegar?: (clave: string) => void
  /** 11-nov · abrir la pieza EN EL LUGAR; sin esto, la pieza va a su lugar como los demás avisos */
  alAbrirPieza?: (a: AlertaDeLaAntena) => void
  /** 11-nov · la bandeja de piezas por aprobar (id → fila), para el nombre legible y la miniatura */
  piezas?: Record<string, FilaDeLaLista> | null
}

const NUMERO = "inline-flex h-6 min-w-9 items-center justify-center rounded-control border px-2 text-cuerpo leading-none font-medio tabular-nums"

/** la miniatura de una pieza: un cuadro de su video o su primera lámina; sin dibujo, el recuadro punteado */
function Miniatura({ id, fila }: { id: string; fila: FilaDeLaLista | null }) {
  const caja = "h-[78px] w-[44px] shrink-0 overflow-hidden rounded-[6px] border border-linea bg-carbon"
  if (fila && !fila.tiene_dibujo) return <span data-miniatura="sin-dibujo" className="flex h-[78px] w-[44px] shrink-0 items-center justify-center rounded-[6px] border border-dashed border-linea text-center text-[10px] leading-tight text-gris">Sin dibujo</span>
  if (!fila) return <span data-miniatura="sin-dato" aria-hidden className={caja} />
  return fila.es_video
    // un cuadro del video (el segundo 1): el navegador lo dibuja sin bajar el archivo entero
    ? <video data-miniatura="video" aria-hidden muted playsInline preload="metadata" src={`/api/piezas/${encodeURIComponent(id)}/video#t=1`} className={`${caja} object-cover`} />
    // eslint-disable-next-line @next/next/no-img-element
    : <img data-miniatura="lamina" alt="" src={`/api/piezas/${encodeURIComponent(id)}/lamina/1`} className={`${caja} object-cover`} />
}

export function ListaDeLasAlertas({ alertas, onAbrir, onCerrar, ahora, revisadasAqui = {}, alRevisar, fetchImpl, desplegados = {}, alDesplegar, alAbrirPieza, piezas = null }: PropsDeLaLista) {
  const lista = alertas ?? []
  // 10-nov (Lenovo 23:46Z): el número cuenta solo las Nuevas; las revisadas siguen en la lista con su sello hasta que se resuelven
  const nuevas = numeroDeLaAntena(nuevasDeLaAntena(lista, revisadasAqui))
  // una pieza se abre en el lugar si el panel lo permite; si no, va a su lugar como antes
  const tocar = (a: AlertaDeLaAntena) => (a.pieza && alAbrirPieza ? alAbrirPieza(a) : onAbrir(a))
  const enElLugar = (a: AlertaDeLaAntena) => !!(a.pieza && alAbrirPieza)
  return (
    // 09-nov · boceto aprobado: cabecera de una línea (ALERTAS + el número en un recuadro chico), sin «Dept. Marketing» ni el recuadro grande;
    // el aviso es lo principal y el panel se ensancha lo justo para que su texto quepa en una línea (hasta 720 px)
    <PanelBase titulo="Alertas" id="alertas-antena-titulo" seccion="alertas-antena" onCerrar={onCerrar} etiquetaCerrar="Cerrar las alertas" ancho="max-w-[min(720px,100%)] sm:w-auto sm:min-w-[540px]"
      junto={<span data-numero aria-label={typeof nuevas === "string" ? "Avisos nuevos: sin dato de revisión" : nuevas === 1 ? "1 aviso nuevo" : `${nuevas} avisos nuevos`} className={`${NUMERO} ${nuevas ? "border-linea-alarma text-alarma" : "border-linea text-gris"}`}>{nuevas}</span>}>
      <div data-panel-alertas className="mt-2 flex flex-col">
        {lista.length === 0 && <p data-todo-en-orden className="border-t border-linea py-4 text-center text-cuerpo text-gris">Todo en orden</p>}
        <ul>
          {renglonesDeLaAntena(lista).map((r) => {
            if (r.tipo === "grupo") {
              // 11-nov · las iguales en UN renglón: el rótulo, el número de cuántas son y la frase en plural; se despliega ahí mismo
              const abierto = !!desplegados[r.clave]
              const nueva = r.alertas.some((a) => esNuevaEnLaAntena(a, revisadasAqui))
              const masReciente = r.alertas[0]
              return (
                <li key={r.clave} data-grupo={r.clave} data-alerta={masReciente.tipo} data-nueva={nueva || undefined} className="border-t border-linea">
                  <button type="button" data-desplegar={r.clave} aria-expanded={abierto} onClick={() => alDesplegar?.(r.clave)} className="grid min-h-11 w-full min-w-0 grid-cols-[20px_1fr_auto] items-center gap-3 py-5 text-left hover:text-hueso">
                    <span aria-hidden className={`h-2 w-2 rounded-full ${nueva ? "bg-alarma" : "border border-gris"}`} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-3">
                        {masReciente.tipo === "decision" && <span data-rotulo className="text-dato uppercase tracking-widest text-oro">Decisión</span>}
                        <span data-cuantas aria-label={`${r.alertas.length} iguales`} className={`${NUMERO} ${nueva ? "border-linea-alarma text-alarma" : "border-linea text-gris"}`}>{r.alertas.length}</span>
                      </span>
                      <span className="block text-titulo text-hueso"><ConNombres texto={r.texto} /></span>
                      <span data-cuando className="mt-1 block text-cuerpo text-gris">{masReciente.cliente ? `${masReciente.cliente} · ` : ""}la última {haceCuanto(masReciente.cuando, ahora)}</span>
                    </span>
                    <span aria-hidden className="text-titulo text-gris">{abierto ? "⌄" : "›"}</span>
                  </button>
                  {abierto && (
                    <ul data-desplegado={r.clave} className="mb-4 ml-8 flex flex-col gap-1 border-l border-linea pl-4">
                      {r.alertas.map((a) => {
                        const fila = a.pieza ? piezas?.[a.pieza] ?? null : null
                        const vista = !esNuevaEnLaAntena(a, revisadasAqui)
                        return (
                          <li key={a.clave} data-miembro={a.clave}>
                            <button type="button" data-abre-pieza={a.pieza} disabled={!a.pieza && !a.abre} onClick={() => tocar(a)} className={`grid w-full items-center gap-3 rounded-control px-2 py-2 text-left hover:bg-white/[0.04] disabled:cursor-default ${a.pieza ? "grid-cols-[44px_1fr_auto]" : "grid-cols-[1fr_auto]"}`}>
                              {a.pieza && <Miniatura id={a.pieza} fila={fila} />}
                              <span className="min-w-0">
                                <span className="block text-cuerpo text-hueso">{fila?.titulo_legible ?? <ConNombres texto={a.texto} />}</span>
                                <span className="mt-0.5 block text-dato text-gris">{a.pieza ? `${estadoCortoDeLaPieza(fila)} · ` : ""}{haceCuanto(a.cuando, ahora)}{vista ? " · ya la viste" : ""}</span>
                              </span>
                              {(a.pieza || a.abre) && <span aria-hidden className="text-titulo text-gris">›</span>}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            }
            const a = r.alerta
            const lugar = enElLugar(a) ? null : a.abre ? NOMBRE_DEL_LUGAR[a.abre] ?? null : null
            const nueva = esNuevaEnLaAntena(a, revisadasAqui)
            return (
              <li key={a.clave} data-alerta={a.tipo} data-nueva={nueva || undefined} className="flex items-start gap-3 border-t border-linea">
                <button type="button" data-abre-pieza={enElLugar(a) ? a.pieza : undefined} disabled={!a.abre && !enElLugar(a)} onClick={() => tocar(a)} className="grid min-h-11 min-w-0 flex-1 grid-cols-[20px_1fr_auto] items-center gap-3 py-5 text-left hover:text-hueso disabled:cursor-default">
                  {/* Nueva: punto rojo; Revisada: círculo hueco (boceto aprobado) */}
                  <span aria-hidden className={`h-2 w-2 rounded-full ${nueva ? "bg-alarma" : "border border-gris"}`} />
                  <span className="min-w-0">
                    {a.tipo === "decision" && <span data-rotulo className="block text-dato uppercase tracking-widest text-oro">Decisión</span>}
                    {/* los nombres propios (Campaña de Marketing, Plan de Marketing…) con su línea dorada, como en la ficha (§4.10) */}
                    <span className="block text-titulo text-hueso"><ConNombres texto={a.texto} /></span>
                    <span data-cuando className="mt-1 block text-cuerpo text-gris">{a.cliente ? `${a.cliente} · ` : ""}{a.cliente ? haceCuanto(a.cuando, ahora) : conMayuscula(haceCuanto(a.cuando, ahora))}{lugar ? ` · abre ${lugar}` : ""}</span>
                  </span>
                  {(a.abre || enElLugar(a)) && <span aria-hidden className="text-titulo text-gris">›</span>}
                </button>
                {/* 10-nov · «✓ Revisar», la MISMA pieza que el panel de Decisiones (CC4 #316): solo para avisar que ya lo viste; no decide nada */}
                {a.revisar && (
                  <span data-fila-revisar className="shrink-0 pt-4">
                    <BotonRevisar key={`${a.revisar.clave}:${revisadasAqui[a.revisar.clave] ? "vista" : ""}`} clave={a.revisar.clave} fetchImpl={fetchImpl}
                      revisadaEn={revisadasAqui[a.revisar.clave] ?? (a.revisar.estado === "revisada" ? a.revisar.revisada_en ?? a.revisar.clave : null)}
                      alRevisar={alRevisar} />
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </PanelBase>
  )
}
