"use client"

/**
 * EL ESTUDIO DE LA CÁMARA (dpto de marketing · boceto aprobado por Emilio, GO de Lenovo 05-nov). Se abre ENCIMA al tocar la cámara del trípode.
 * Estructura copiada de Higgsfield (una caja de texto, modelo y formato como chips, el costo en el botón), Krea (pestañas por tipo, galería con filtros) y
 * Runway (imagen de partida, pasos de un pedido largo, resultado con descargar / otra versión). Lo nuestro es solo la fachada.
 * Sin tope de gasto (firma de Emilio): el costo se cotiza ANTES de crear y el botón lo muestra; sin cotización (p. ej. video sin precio) el botón no se enciende.
 * Toda llamada pasa por `/api/estudio/*` (solo administrador): las llaves de los proveedores nunca llegan aquí.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { guardarClienteDeTrabajo, leerClienteDeTrabajo } from "@/lib/cliente-de-trabajo"
import { claveNueva, cuerpoDeCotizacion, cuerpoDelPedido, dolares, estadoDelBoton, NOMBRE_DEL_TIPO, textoListo as hayTexto, type Catalogo, type Cotizacion, type Pieza, type TipoDePieza } from "@/lib/estudio"

const AMBAR = "#e8731a"
const TIPOS: TipoDePieza[] = ["imagen", "video", "3d"]
const CADA_MS = 4000
/** la foto de partida se achica en el navegador antes de subir (lado largo 1536 px, JPEG): cabe de sobra en el límite de las rutas */
const LADO_MAXIMO = 1536

type Cliente = { id: string; nombre: string }
type Foto = { b64: string; vista: string } | { pieza: Pieza }

const ESTILO = `
.es-chip{border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:6px 12px;font-size:12.5px;color:#d4d4d8;white-space:nowrap}
.es-chip[aria-pressed="true"]{border-color:${AMBAR};color:#f0a04b;background:#2a2016}
.es-chip:disabled{opacity:.4}
.es-caja{background:#1d1d1d;border:1px solid rgba(255,255,255,.1);border-radius:12px}
.es-eti{font-size:11px;color:#a1a1aa;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
.es-pieza{position:relative;aspect-ratio:1;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,.1);background:#141414}
.es-pieza:focus-visible{outline:1px solid ${AMBAR}}
.es-cargando:before{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(232,115,26,.18) 50%,transparent 70%);background-size:250% 100%;animation:esBarrido 1.6s linear infinite}
@keyframes esBarrido{from{background-position:120% 0}to{background-position:-120% 0}}
@media (prefers-reduced-motion:reduce){.es-cargando:before{animation:none}}
`

async function leerJson<T>(r: Response): Promise<T & { ok?: boolean; error?: string; detalle?: string }> {
  return ((await r.json().catch(() => ({ ok: false, error: `respuesta ${r.status}` }))) as T & { ok?: boolean; error?: string; detalle?: string })
}

/** achica la foto en el navegador y la devuelve en base64 (JPEG) */
async function fotoAchicada(archivo: File): Promise<{ b64: string; vista: string }> {
  const url = URL.createObjectURL(archivo)
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error("No pude leer esa imagen.")); i.src = url })
    const k = Math.min(1, LADO_MAXIMO / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement("canvas")
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k)
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height)
    const vista = c.toDataURL("image/jpeg", 0.9)
    return { b64: vista.split(",")[1] ?? "", vista }
  } finally { URL.revokeObjectURL(url) }
}

function Visor3D({ src, poster }: { src: string; poster: string | null }) {
  const [listo, setListo] = useState(false)
  const visor = useRef<HTMLElement>(null)
  useEffect(() => { let vivo = true; void import("@google/model-viewer").then(() => vivo && setListo(true)).catch(() => vivo && setListo(false)); return () => { vivo = false } }, [])
  // React 19 pasa `src` a un elemento web como propiedad y el visor no la toma (medido 05-nov: src nulo, nunca carga): se fija como atributo
  useEffect(() => {
    const v = visor.current
    if (!listo || !v) return
    v.setAttribute("src", src)
    if (poster) v.setAttribute("poster", poster); else v.removeAttribute("poster")
  }, [listo, src, poster])
  if (!listo) return <div className="flex h-full items-center justify-center text-[13px] text-zinc-500">Preparando el visor 3D…</div>
  return (
    <model-viewer ref={visor} data-visor-3d alt="El modelo 3D creado" camera-controls="" auto-rotate="" auto-rotate-delay="0" rotation-per-second="18deg"
      touch-action="pan-y" interaction-prompt="none" shadow-intensity="1" exposure="1.05" environment-image="neutral"
      style={{ width: "100%", height: "100%", background: "radial-gradient(ellipse at 50% 60%,#2a2016,#0c0c0c 70%)", ["--poster-color" as string]: "transparent" }} />
  )
}

function Vista({ pieza }: { pieza: Pieza }) {
  if (pieza.estado === "creando") return <div className="es-cargando relative flex h-full items-center justify-center text-[13px] text-zinc-400">Creando…</div>
  if (pieza.estado === "fallida" || !pieza.archivo_url) return <div className="flex h-full items-center justify-center p-6 text-center text-[13px] text-red-300">No se pudo crear: {pieza.error ?? "sin archivo"}</div>
  if (pieza.tipo === "video") return <video src={pieza.archivo_url} poster={pieza.miniatura_url ?? undefined} controls playsInline className="h-full w-full bg-black object-contain" />
  if (pieza.tipo === "3d" && pieza.archivo_tipo === "glb") return <Visor3D src={pieza.archivo_url} poster={pieza.miniatura_url} />
  if (pieza.tipo === "3d") return <div className="flex h-full items-center justify-center p-6 text-center text-[13px] text-zinc-400">El modelo salió en formato {pieza.archivo_tipo}: se descarga, pero el visor solo gira GLB.</div>
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={pieza.archivo_url} alt={pieza.prompt} className="h-full w-full object-contain" />
}

function Miniatura({ p, alAbrir }: { p: Pieza; alAbrir: () => void }) {
  const img = p.miniatura_url ?? (p.tipo === "imagen" ? p.archivo_url : null) ?? p.foto_partida_url
  return (
    <button type="button" onClick={alAbrir} data-pieza={p.id} data-estado={p.estado} className={`es-pieza text-left ${p.estado === "creando" ? "es-cargando" : ""}`} aria-label={`${NOMBRE_DEL_TIPO[p.tipo]}: ${p.prompt || "sin texto"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {img && p.estado !== "creando" && <img src={img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
      {p.tipo === "video" && p.estado === "lista" && <span aria-hidden className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/60 text-white">▶</span>}
      <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10.5px]" style={{ color: "#f0a04b" }}>{NOMBRE_DEL_TIPO[p.tipo]}</span>
      <span className="absolute inset-x-0 bottom-0 flex justify-between gap-2 bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-5 text-[11.5px] text-zinc-200">
        <span className="truncate">{p.prompt || "desde una foto"}</span>
        <span className="shrink-0 text-zinc-400">{p.estado === "creando" ? "creando" : p.estado === "fallida" ? "falló" : dolares(p.costo_usd)}</span>
      </span>
    </button>
  )
}

function Chips<T extends string>({ valores, valor, alElegir, nombre }: { valores: readonly T[]; valor: T; alElegir: (v: T) => void; nombre?: (v: T) => ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{valores.map((v) => <button key={v} type="button" className="es-chip" aria-pressed={v === valor} onClick={() => alElegir(v)}>{nombre ? nombre(v) : v}</button>)}</div>
}

export function PanelEstudio({ onCerrar, fetchImpl = fetch, catalogoInicial = null, piezasIniciales = null, clientesIniciales = null, abiertaInicial = null }: {
  onCerrar: () => void
  fetchImpl?: typeof fetch
  /** solo pruebas y el arnés de imágenes */
  catalogoInicial?: Catalogo | null
  piezasIniciales?: Pieza[] | null
  clientesIniciales?: Cliente[] | null
  abiertaInicial?: string | null
}) {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(catalogoInicial)
  const [clientes, setClientes] = useState<Cliente[] | null>(clientesIniciales)
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [piezas, setPiezas] = useState<Pieza[]>(piezasIniciales ?? [])
  const [filtro, setFiltro] = useState<TipoDePieza | "todo">("todo")
  const [abierta, setAbierta] = useState<string | null>(abiertaInicial)
  const [tipo, setTipo] = useState<TipoDePieza>("imagen")
  const [texto, setTexto] = useState("")
  const [formato, setFormato] = useState("1:1")
  const [modelo3d, setModelo3d] = useState("tripo-h3.1")
  const [calidad, setCalidad] = useState<"normal" | "alta">("normal")
  const [modeloVideo, setModeloVideo] = useState("bytedance/seedance-2.5")
  const [segundos, setSegundos] = useState(5)
  const [resolucion, setResolucion] = useState("720p")
  const [foto, setFoto] = useState<Foto | null>(null)
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null)
  const [cotizando, setCotizando] = useState(false)
  const [sinPrecio, setSinPrecio] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cerrar = useRef<HTMLButtonElement>(null)
  const archivo = useRef<HTMLInputElement>(null)
  const cuerpo = useRef<HTMLDivElement>(null)
  // al abrir una pieza, arriba (en el teléfono el visor queda primero)
  useEffect(() => { if (abierta) cuerpo.current?.scrollTo?.({ top: 0 }) }, [abierta])

  useEffect(() => { cerrar.current?.focus() }, [])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key !== "Escape") return; e.stopPropagation(); e.preventDefault(); if (abierta) setAbierta(null); else onCerrar() }
    window.addEventListener("keydown", tecla, true)
    return () => window.removeEventListener("keydown", tecla, true)
  }, [onCerrar, abierta])

  // catálogo y clientes (una vez)
  useEffect(() => {
    if (!catalogo) void fetchImpl("/api/estudio/catalogo", { cache: "no-store" }).then(leerJson<Catalogo>).then((j) => { if (j.ok) setCatalogo(j); else setError(j.error === "sin_sesion" || j.error === "sin_permiso" ? "Necesitas una sesión de administrador." : `El estudio no está disponible (${j.error ?? "sin respuesta"}).`) }).catch(() => setError("La plataforma no responde."))
    if (!clientes) void fetchImpl("/api/estudio/clientes", { cache: "no-store" }).then(leerJson<{ clientes: Cliente[] }>).then((j) => { if (j.ok) setClientes(j.clientes) }).catch(() => undefined)
  }, [catalogo, clientes, fetchImpl])
  // el cliente con el que Emilio está trabajando (el mismo de los demás paneles)
  useEffect(() => {
    if (!clientes || clienteId) return
    const r = leerClienteDeTrabajo()
    const elegido = (r?.id && clientes.find((c) => c.id === r.id)) || (r?.nombre && clientes.find((c) => c.nombre === r.nombre)) || clientes[0]
    if (elegido) setClienteId(elegido.id)
  }, [clientes, clienteId])
  const cliente = clientes?.find((c) => c.id === clienteId) ?? null

  const leerGaleria = useCallback(async (id: string) => {
    const j = await fetchImpl(`/api/estudio/piezas?client_id=${encodeURIComponent(id)}`, { cache: "no-store" }).then(leerJson<{ piezas: Pieza[] }>).catch(() => null)
    if (j?.ok) setPiezas(j.piezas)
  }, [fetchImpl])
  useEffect(() => { if (clienteId && !piezasIniciales) void leerGaleria(clienteId) }, [clienteId, leerGaleria, piezasIniciales])

  // lo que se está creando se pregunta cada pocos segundos (la plataforma avanza la pieza al preguntar)
  const enCurso = piezas.filter((p) => p.estado === "creando").map((p) => p.id).join(",")
  useEffect(() => {
    if (!enCurso) return
    const t = setInterval(() => {
      for (const id of enCurso.split(",")) {
        void fetchImpl(`/api/estudio/pieza?id=${id}`, { cache: "no-store" }).then(leerJson<{ pieza: Pieza }>).then((j) => { if (j.ok && j.pieza) setPiezas((ps) => ps.map((p) => (p.id === j.pieza.id ? j.pieza : p))) }).catch(() => undefined)
      }
    }, CADA_MS)
    return () => clearInterval(t)
  }, [enCurso, fetchImpl])

  const pedido = useMemo(() => cuerpoDelPedido(clienteId, tipo, texto, { formato, modelo3d, calidad, modeloVideo, segundos, resolucion }, foto ? ("b64" in foto ? { b64: foto.b64 } : { pieza_id: foto.pieza.id }) : null),
    [clienteId, tipo, texto, formato, modelo3d, calidad, modeloVideo, segundos, resolucion, foto])

  // la cotización: cada vez que cambia algo que mueve el precio (no el texto, salvo que esté vacío)
  const textoListo = hayTexto(tipo, texto, !!foto)
  useEffect(() => {
    setCotizacion(null); setSinPrecio(null)
    if (!clienteId || !textoListo) return
    let vivo = true
    setCotizando(true)
    const t = setTimeout(() => {
      void fetchImpl("/api/estudio/cotizar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpoDeCotizacion(pedido)) })
        .then(leerJson<Cotizacion>).then((j) => { if (!vivo) return; if (j.ok) setCotizacion({ total_usd: j.total_usd, partes: j.partes }); else setSinPrecio(j.detalle ?? j.error ?? "sin precio") })
        .catch(() => vivo && setSinPrecio("la plataforma no responde"))
        .finally(() => vivo && setCotizando(false))
    }, 350)
    return () => { vivo = false; clearTimeout(t) }
    // el texto no cambia el precio: solo importa si ya hay texto suficiente
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, tipo, formato, modelo3d, calidad, modeloVideo, segundos, resolucion, !!foto, textoListo, fetchImpl])

  const boton = estadoDelBoton({ clienteId, textoListo, listo: catalogo ? catalogo.listos[tipo] : null, cotizacion, cotizando, sinPrecio, creando })
  const puedeCrear = boton.habilitado

  async function crear() {
    if (!puedeCrear) return
    setCreando(true); setError(null)
    try {
      const r = await fetchImpl("/api/estudio/crear", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...pedido, clave: claveNueva() }) })
      const j = await leerJson<{ pieza: Pieza }>(r)
      if (!j.ok || !j.pieza) { setError(j.detalle ?? j.error ?? `No se pudo crear (${r.status}).`); return }
      setPiezas((ps) => [j.pieza, ...ps.filter((p) => p.id !== j.pieza.id)])
      setAbierta(j.pieza.id)
    } catch { setError("La plataforma no responde.") } finally { setCreando(false) }
  }

  async function alSubir(f: File | undefined) {
    if (!f) return
    try { setFoto(await fotoAchicada(f)) } catch (e) { setError(e instanceof Error ? e.message : "No pude leer esa imagen.") }
  }

  const pieza = abierta ? piezas.find((p) => p.id === abierta) ?? null : null
  const visibles = filtro === "todo" ? piezas : piezas.filter((p) => p.tipo === filtro)
  const formatos = tipo === "imagen" ? catalogo?.imagen.formatos ?? ["1:1", "9:16", "16:9"] : catalogo?.video.formatos ?? ["9:16", "16:9", "1:1"]
  const nombreFormato = (f: string) => ({ "1:1": "Cuadrado 1:1", "9:16": "Vertical 9:16", "16:9": "Horizontal 16:9" }[f] ?? f)
  const vistaFoto = foto ? ("vista" in foto ? foto.vista : foto.pieza.archivo_url) : null
  const enProceso = pieza?.estado === "creando" ? pieza : null

  return (
    <div className="nv-panel fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-2 backdrop-blur-[2px] sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <style>{ESTILO}</style>
      <section role="dialog" aria-modal="true" aria-labelledby="estudio-titulo" data-seccion="estudio" className="relative flex h-full max-h-full w-full max-w-[1500px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#171717] text-zinc-200 shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <h2 id="estudio-titulo" className="font-display text-[15px] font-light uppercase tracking-[0.28em]" style={{ color: AMBAR }}>Estudio</h2>
          <p className="hidden text-[12px] text-zinc-500 lg:block">Crea imágenes, videos y modelos 3D</p>
          <label className="flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-[12.5px]">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: AMBAR }} />
            <span className="sr-only">Para el cliente</span>
            <span className="hidden text-zinc-400 sm:inline">Para:</span>
            <select data-cliente value={clienteId ?? ""} onChange={(e) => { const c = clientes?.find((x) => x.id === e.target.value); setClienteId(e.target.value); setAbierta(null); setFoto(null); if (c) guardarClienteDeTrabajo({ id: c.id, nombre: c.nombre }) }}
              className="max-w-[180px] bg-transparent text-zinc-100 outline-none">
              {(clientes ?? []).map((c) => <option key={c.id} value={c.id} className="bg-[#171717]">{c.nombre}</option>)}
            </select>
          </label>
          <button ref={cerrar} type="button" onClick={onCerrar} aria-label="Cerrar el estudio" className="ml-auto rounded-md border border-white/15 px-2.5 py-1 text-[12px] text-zinc-300 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">Cerrar · Esc</button>
        </header>

        <div ref={cuerpo} className="flex min-h-0 flex-1 flex-col overflow-y-auto md:grid md:grid-cols-[400px_1fr] md:overflow-hidden">
          {/* lo que se pide */}
          <div className="flex shrink-0 flex-col gap-3.5 border-white/10 p-4 md:overflow-y-auto md:border-r sm:p-5">
            <div role="tablist" aria-label="Qué crear" className="grid grid-cols-3 rounded-xl border border-white/10 bg-[#111] p-1">
              {TIPOS.map((t) => <button key={t} type="button" role="tab" aria-selected={tipo === t} data-tab={t} onClick={() => { setTipo(t); setFormato(t === "video" ? "9:16" : "1:1") }}
                className={`rounded-lg py-2 text-[14px] ${tipo === t ? "bg-[#2a2016] font-semibold text-[#f0a04b]" : "text-zinc-400"}`}>{NOMBRE_DEL_TIPO[t]}</button>)}
            </div>
            <div>
              <div className="es-eti">{tipo === "3d" && foto ? "Qué quieres (opcional)" : "Qué quieres crear"}</div>
              <textarea data-texto value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} maxLength={4000}
                placeholder={tipo === "video" ? "Describe la toma: qué pasa, la cámara, la luz…" : tipo === "3d" ? "Describe un objeto: forma, material, color…" : "Describe la escena: qué se ve, la luz, el ambiente…"}
                className="es-caja w-full resize-none p-3 text-[14px] leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-[#e8731a]/60 focus:outline-none" />
              {tipo === "3d" && !foto && /\b(logo|logotipo|marca)\b/i.test(texto) && <p className="mt-1 text-[11.5px] text-amber-300/90">Sin imagen de partida, el modelo inventa el logo. Para la marca real, sube una foto del producto.</p>}
            </div>
            <div>
              <div className="es-eti">Imagen de partida (opcional)</div>
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/20 p-2.5 text-[13px] text-zinc-400">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {vistaFoto ? <img src={vistaFoto} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <span className="h-12 w-12 rounded-lg border border-white/10 bg-[#222]" />}
                <div className="min-w-0 flex-1">{foto ? "Se parte de esta imagen" : tipo === "3d" ? "Ninguna: primero se crea la imagen y luego se convierte en 3D" : "Sube una foto o elige una imagen de la galería"}</div>
                {foto ? <button type="button" className="es-chip" onClick={() => setFoto(null)}>Quitar</button> : <button type="button" className="es-chip" onClick={() => archivo.current?.click()}>Subir</button>}
                <input ref={archivo} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { void alSubir(e.target.files?.[0]); e.target.value = "" }} />
              </div>
            </div>
            {tipo === "3d" && (
              <div>
                <div className="es-eti">Modelo</div>
                <div className="flex flex-col gap-1.5">
                  {(catalogo?.["3d"].modelos ?? []).map((m) => (
                    <button key={m.id} type="button" aria-pressed={modelo3d === m.id} onClick={() => setModelo3d(m.id)} className={`es-caja flex items-center justify-between px-3 py-2 text-left text-[13.5px] ${modelo3d === m.id ? "border-[#e8731a]/70" : ""}`}>
                      <span>{m.nombre} <span className="text-[12px] text-zinc-500">· {m.nota}</span></span><span className="shrink-0 whitespace-nowrap pl-2 text-[12px] text-zinc-400">{dolares(m.precio[calidad])}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {tipo === "video" && (
              <div>
                <div className="es-eti">Modelo</div>
                <Chips valores={(catalogo?.video.modelos ?? []).map((m) => m.id)} valor={modeloVideo} alElegir={setModeloVideo} nombre={(id) => catalogo?.video.modelos.find((m) => m.id === id)?.nombre ?? id} />
              </div>
            )}
            {tipo !== "3d" && <div><div className="es-eti">Formato</div><Chips valores={formatos} valor={formato} alElegir={setFormato} nombre={nombreFormato} /></div>}
            {tipo === "3d" && <div><div className="es-eti">Calidad</div><Chips valores={["normal", "alta"] as const} valor={calidad} alElegir={setCalidad} nombre={(c) => (c === "normal" ? "Normal" : "Alta")} /></div>}
            {tipo === "video" && (
              <div className="flex flex-wrap gap-4">
                <div><div className="es-eti">Duración</div><Chips valores={["5", "8", "10", "15"]} valor={String(segundos)} alElegir={(v) => setSegundos(Number(v))} nombre={(v) => `${v} s`} /></div>
                <div><div className="es-eti">Resolución</div><Chips valores={catalogo?.video.resoluciones ?? ["720p"]} valor={resolucion} alElegir={setResolucion} /></div>
              </div>
            )}
            {enProceso && (
              <div data-pasos className="es-caja flex flex-col gap-2 p-3 text-[13px]">
                {enProceso.tipo === "3d" && <Paso hecho={enProceso.paso === "3d"} activo={enProceso.paso === "imagen"} texto={enProceso.foto_partida_url ? "Imagen de partida lista" : "Creando la imagen"} />}
                <Paso hecho={false} activo texto={enProceso.tipo === "3d" ? "Convirtiendo en 3D" : enProceso.tipo === "video" ? "Creando el video" : "Creando la imagen"} nota={enProceso.tipo === "3d" ? (enProceso.modelo === "meshy-6" ? "5 a 10 min" : "≈ 1-3 min") : enProceso.tipo === "video" ? "unos minutos" : undefined} />
                <Paso hecho={false} activo={false} texto={`Guardar en la galería de ${cliente?.nombre ?? "este cliente"}`} />
              </div>
            )}
            <button type="button" data-crear onClick={() => void crear()} disabled={!puedeCrear}
              className="mt-auto flex items-center justify-between rounded-xl px-4 py-3.5 text-[15px] font-bold transition-opacity disabled:cursor-not-allowed"
              style={{ background: puedeCrear ? AMBAR : "#3a2a1a", color: puedeCrear ? "#1a0d02" : "#f0a04b" }}>
              <span>{creando ? "Creando…" : "Crear"}</span>
              <span data-costo className="text-[12.5px] font-medium opacity-90">
                {boton.costo}
              </span>
            </button>
            {cotizacion && cotizacion.partes.length > 1 && <p data-desglose className="-mt-2 text-right text-[11.5px] text-zinc-500">{cotizacion.partes.map((x) => `${x.que} ${dolares(x.usd)}`).join(" + ")}</p>}
            {error && <p role="alert" className="text-[12.5px] text-red-300">{error}</p>}
            <p className="text-[11.5px] leading-snug text-zinc-500">El costo se ve antes de crear y el real se anota en el libro de costos de {cliente?.nombre ?? "este cliente"}.</p>
          </div>

          {/* la galería o la pieza abierta */}
          {/* en el teléfono, con una pieza abierta, el visor va primero (arriba del pedido) */}
          <div data-derecha className={`flex min-h-[420px] shrink-0 flex-col gap-3 p-4 md:order-none md:min-h-0 sm:p-5 ${pieza ? "order-first" : ""}`}>
            {pieza ? (
              <>
                <div className="flex items-baseline gap-2">
                  <h3 className="truncate text-[16px] font-semibold">{pieza.prompt || "Desde una foto"}</h3>
                  <span className="shrink-0 text-[12.5px] text-zinc-500">{NOMBRE_DEL_TIPO[pieza.tipo]}{pieza.estado === "creando" ? " · creando" : ""}</span>
                  <button type="button" className="es-chip ml-auto" onClick={() => setAbierta(null)}>← Galería</button>
                </div>
                <div data-visor className="relative min-h-[280px] flex-1 overflow-hidden rounded-xl border border-white/10 bg-[#0c0c0c]">
                  <Vista pieza={pieza} />
                  {pieza.tipo === "3d" && pieza.estado === "lista" && pieza.archivo_tipo === "glb" && <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-black/65 px-3 py-1.5 text-[12px] text-zinc-200">Arrastra con el mouse o el dedo para girarlo</span>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-zinc-500">
                  <span>Modelo <b className="font-medium text-zinc-300">{pieza.modelo}</b></span>
                  {pieza.archivo_tipo && <span>Archivo <b className="font-medium text-zinc-300">.{pieza.archivo_tipo === "image" ? "png" : pieza.archivo_tipo === "video" ? "mp4" : pieza.archivo_tipo}</b></span>}
                  <span>Para <b className="font-medium text-zinc-300">{cliente?.nombre}</b></span>
                  {pieza.aviso && <span className="text-amber-300/80">{pieza.aviso}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {pieza.archivo_url && pieza.estado === "lista" && <a href={pieza.archivo_url} download target="_blank" rel="noreferrer" className="rounded-lg px-3.5 py-2 text-[13.5px] font-semibold" style={{ background: AMBAR, color: "#1a0d02" }}>Descargar</a>}
                  {pieza.tipo === "imagen" && pieza.estado === "lista" && <button type="button" className="rounded-lg border border-white/15 px-3.5 py-2 text-[13.5px]" onClick={() => { setFoto({ pieza }); setAbierta(null) }}>Usar como imagen de partida</button>}
                  <button type="button" className="rounded-lg border border-white/15 px-3.5 py-2 text-[13.5px]" onClick={() => { setTipo(pieza.tipo); setTexto(pieza.prompt); setAbierta(null) }}>Crear otra versión</button>
                  <span className="ml-auto text-[12.5px] text-zinc-500">{pieza.estado === "creando" ? `Costará ≈ ${dolares(pieza.costo_estimado_usd)}` : <>Costó <b className="text-zinc-200">{dolares(pieza.costo_usd)}</b> · anotado en el libro</>}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="text-[16px] font-semibold">Galería</h3>
                  <span className="text-[12.5px] text-zinc-500">Lo creado para {cliente?.nombre ?? "este cliente"}</span>
                  <div className="ml-auto flex gap-1.5">
                    {(["todo", ...TIPOS] as const).map((f) => <button key={f} type="button" className="es-chip" aria-pressed={filtro === f} onClick={() => setFiltro(f)}>{f === "todo" ? "Todo" : NOMBRE_DEL_TIPO[f]}</button>)}
                  </div>
                </div>
                {visibles.length ? (
                  <div data-galeria className="grid grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
                    {visibles.map((p) => <Miniatura key={p.id} p={p} alAbrir={() => setAbierta(p.id)} />)}
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/10 p-8 text-center text-[13px] text-zinc-500">Todavía no hay nada creado para {cliente?.nombre ?? "este cliente"}. Lo que crees aparece aquí.</div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function Paso({ hecho, activo, texto, nota }: { hecho: boolean; activo: boolean; texto: string; nota?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden className="h-[18px] w-[18px] shrink-0 rounded-full border-2" style={{ borderColor: hecho || activo ? AMBAR : "#444", background: hecho ? AMBAR : "transparent", borderRightColor: activo && !hecho ? "transparent" : undefined }} />
      <span className={hecho || activo ? "text-zinc-100" : "text-zinc-500"}>{texto}</span>
      {nota && <span className="ml-auto text-[11.5px] text-zinc-500">{nota}</span>}
    </div>
  )
}
