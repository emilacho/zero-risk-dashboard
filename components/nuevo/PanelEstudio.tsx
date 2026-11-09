"use client"

/**
 * EL ESTUDIO DE LA CÁMARA (dpto de marketing · boceto aprobado por Emilio, GO de Lenovo 05-nov). Se abre ENCIMA al tocar la cámara del trípode.
 * Estructura copiada de Higgsfield (una caja de texto, modelo y formato como chips, el costo en el botón), Krea (pestañas por tipo, galería con filtros) y
 * Runway (imagen de partida, pasos de un pedido largo, resultado con descargar / otra versión). Lo nuestro es solo la fachada.
 * Sin tope de gasto (firma de Emilio): el costo se cotiza ANTES de crear y el botón lo muestra; sin cotización (p. ej. video sin precio) el botón no se enciende.
 * Toda llamada pasa por `/api/estudio/*` (solo administrador): las llaves de los proveedores nunca llegan aquí.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { leerClienteDeTrabajo } from "@/lib/cliente-de-trabajo"
import { NotaDeTodos, useAlCambiarElCliente } from "@/components/nuevo/ClienteComoTexto"
import { agregarImagenes, avisoDeUnaSola, diasQueQuedan, enOrden, lineaDeLoQueNoSubio, lineaDeReferencias, quitarImagen, revisarArchivos, rutaDePapelera, sePuedeQuitar, textoDeDias, MAXIMO_DE_IMAGENES, type ImagenAdjunta, alternarMovimiento, buscarMovimientos, clipsDe, cotizarAnimacion, cuerpoDeAnimacion, cuerpoDeCotizacion, cuerpoDeCreacion, cuerpoDelPedido, dolares, esAnimable, estadoDeAnimar, estadoDelBoton, respuestaDeAnimar, MODELO_DE_ANIMACION, NOMBRE_DEL_TIPO, claseDelCentrado, claseDelCosto, nombreDelMovimiento, piezasDelCliente, rutaDeGaleria, tardaMasDeLoNormal, textoListo as hayTexto, type Catalogo, type Cotizacion, type Pieza, type TipoDePieza } from "@/lib/estudio"

const AMBAR = "#e8731a"
const TIPOS: TipoDePieza[] = ["imagen", "video", "3d"]
const CADA_MS = 4000
/** la foto de partida se achica en el navegador antes de subir (lado largo 1536 px, JPEG): cabe de sobra en el límite de las rutas */
const LADO_MAXIMO = 1536

type Cliente = { id: string; nombre: string }
type Foto = { b64: string; vista: string } | { pieza: Pieza }
/** una imagen adjunta con su número fijo (quitar una no renumera las otras) */
type Adjunta = Foto & { numero: number }
/** con 2 o más imágenes viajan juntas en el pedido: cada una se vuelve a achicar (lado 1024) para que el pedido no pase del límite */
const LADO_EN_VARIAS = 1024

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

/** vuelve a achicar una imagen ya leída (de su vista) para mandarla junto a otras */
async function reachicar(vista: string, lado: number): Promise<string> {
  const img = await new Promise<HTMLImageElement>((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error("No pude leer una de las imágenes.")); i.src = vista })
  const k = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight))
  const c = document.createElement("canvas")
  c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k)
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL("image/jpeg", 0.85).split(",")[1] ?? ""
}

/** lo que va al pedido de cada imagen adjunta */
const comoAdjunta = (a: Adjunta): ImagenAdjunta => ("pieza" in a ? { numero: a.numero, pieza_id: a.pieza.id } : { numero: a.numero, b64: a.b64 })
const vistaDe = (a: Adjunta) => ("vista" in a ? a.vista : a.pieza.archivo_url)

type VisorAnimable = HTMLElement & { play?: () => void; pause?: () => void }

function Visor3D({ src, poster, animado = false }: { src: string; poster: string | null; animado?: boolean }) {
  const [listo, setListo] = useState(false)
  const [enPausa, setEnPausa] = useState(false)
  const visor = useRef<VisorAnimable>(null)
  useEffect(() => { let vivo = true; void import("@google/model-viewer").then(() => vivo && setListo(true)).catch(() => vivo && setListo(false)); return () => { vivo = false } }, [])
  // React 19 pasa `src` a un elemento web como propiedad y el visor no la toma (medido 05-nov: src nulo, nunca carga): se fija como atributo
  useEffect(() => {
    const v = visor.current
    if (!listo || !v) return
    v.setAttribute("src", src)
    if (poster) v.setAttribute("poster", poster); else v.removeAttribute("poster")
    // una animación arranca sola (cada movimiento es su propio archivo: al cambiarlo vuelve a sonar)
    if (animado) { v.setAttribute("autoplay", ""); setEnPausa(false) } else v.removeAttribute("autoplay")
  }, [listo, src, poster, animado])
  if (!listo) return <div className="flex h-full items-center justify-center text-[13px] text-zinc-500">Preparando el visor 3D…</div>
  const alternar = () => { const v = visor.current; if (!v) return; if (enPausa) v.play?.(); else v.pause?.(); setEnPausa(!enPausa) }
  return (
    <>
      <model-viewer ref={visor} data-visor-3d alt={animado ? "El modelo 3D animado" : "El modelo 3D creado"} camera-controls="" auto-rotate={animado ? undefined : ""} auto-rotate-delay="0" rotation-per-second="18deg"
        touch-action="pan-y" interaction-prompt="none" shadow-intensity="1" exposure="1.05" environment-image="neutral"
        style={{ width: "100%", height: "100%", background: "radial-gradient(ellipse at 50% 60%,#2a2016,#0c0c0c 70%)", ["--poster-color" as string]: "transparent" }} />
      {animado && <button type="button" data-reproducir aria-pressed={!enPausa} onClick={alternar} className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/70 px-3 py-1.5 text-[12.5px] text-zinc-100">{enPausa ? "▶ Reproducir" : "❚❚ Pausa"}</button>}
    </>
  )
}

function Vista({ pieza, glb }: { pieza: Pieza; glb?: string | null }) {
  if (pieza.estado === "creando" && tardaMasDeLoNormal(pieza, Date.now())) return <div data-tarda className="flex h-full items-center justify-center p-6 text-center text-[13px] text-amber-200">Tarda más de lo normal. Sigue en el proveedor: puedes cerrar y volver más tarde.</div>
  if (pieza.estado === "creando") return <div className="es-cargando relative flex h-full items-center justify-center text-[13px] text-zinc-400">Creando…</div>
  if (pieza.estado === "fallida" || !pieza.archivo_url) return <div className="flex h-full items-center justify-center p-6 text-center text-[13px] text-red-300">No se pudo crear: {pieza.error ?? "sin archivo"}</div>
  if (pieza.tipo === "video") return <video src={pieza.archivo_url} poster={pieza.miniatura_url ?? undefined} controls playsInline className="h-full w-full bg-black object-contain" />
  if (pieza.tipo === "3d" && pieza.archivo_tipo === "glb") return <Visor3D src={glb ?? pieza.archivo_url} poster={pieza.miniatura_url} animado={pieza.modelo === MODELO_DE_ANIMACION} />
  if (pieza.tipo === "3d") return <div className="flex h-full items-center justify-center p-6 text-center text-[13px] text-zinc-400">El modelo salió en formato {pieza.archivo_tipo}: se descarga, pero el visor solo gira GLB.</div>
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={pieza.archivo_url} alt={pieza.prompt} className="h-full w-full object-contain" />
}

function Miniatura({ p, alAbrir, alQuitar, enPapelera }: { p: Pieza; alAbrir: () => void; alQuitar?: () => void; enPapelera?: { dias: number; alRecuperar: () => void; recuperando: boolean } }) {
  return (
    <div className="relative" data-tarjeta={p.id}>
      <Tarjeta p={p} alAbrir={alAbrir} pie={enPapelera ? textoDeDias(enPapelera.dias) : undefined} />
      {/* decisión B de Emilio (09-nov): la ✕ pequeña arriba a la derecha manda la pieza a la papelera por 30 días; nunca borra en el acto */}
      {alQuitar && sePuedeQuitar(p) && (
        <button type="button" data-quitar={p.id} onClick={alQuitar} title="Quitar de la galería (queda 30 días en la papelera)" aria-label={`Quitar de la galería: ${p.prompt || NOMBRE_DEL_TIPO[p.tipo]}. Queda 30 días en la papelera`}
          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-black/70 text-[13px] leading-none text-zinc-100 hover:bg-black/90 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">✕</button>
      )}
      {enPapelera && (
        <button type="button" data-recuperar={p.id} onClick={enPapelera.alRecuperar} disabled={enPapelera.recuperando}
          className="absolute right-1.5 top-1.5 rounded-full border border-white/20 bg-black/75 px-2.5 py-1 text-[12px] text-zinc-100 hover:bg-black/90 disabled:opacity-50">{enPapelera.recuperando ? "Recuperando…" : "Recuperar"}</button>
      )}
    </div>
  )
}

function Tarjeta({ p, alAbrir, pie }: { p: Pieza; alAbrir: () => void; pie?: string }) {
  const img = p.miniatura_url ?? (p.tipo === "imagen" ? p.archivo_url : null) ?? p.foto_partida_url
  return (
    <button type="button" onClick={alAbrir} data-pieza={p.id} data-estado={p.estado} className={`es-pieza text-left ${p.estado === "creando" ? "es-cargando" : ""}`} aria-label={`${NOMBRE_DEL_TIPO[p.tipo]}: ${p.prompt || "sin texto"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {img && p.estado !== "creando" && <img src={img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
      {p.tipo === "video" && p.estado === "lista" && <span aria-hidden className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/60 text-white">▶</span>}
      <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10.5px]" style={{ color: "#f0a04b" }}>{p.modelo === MODELO_DE_ANIMACION ? "Animado" : NOMBRE_DEL_TIPO[p.tipo]}</span>
      <span className="absolute inset-x-0 bottom-0 flex justify-between gap-2 bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-5 text-[11.5px] text-zinc-200">
        <span className="truncate">{p.prompt || "desde una foto"}</span>
        <span className="shrink-0 text-zinc-400">{pie ?? (p.estado === "creando" ? (tardaMasDeLoNormal(p, Date.now()) ? "tarda más" : "creando") : p.estado === "fallida" ? "falló" : dolares(p.costo_usd))}</span>
      </span>
    </button>
  )
}

function Chips<T extends string>({ valores, valor, alElegir, nombre }: { valores: readonly T[]; valor: T; alElegir: (v: T) => void; nombre?: (v: T) => ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{valores.map((v) => <button key={v} type="button" className="es-chip" aria-pressed={v === valor} onClick={() => alElegir(v)}>{nombre ? nombre(v) : v}</button>)}</div>
}

export function PanelEstudio({ onCerrar, fetchImpl = fetch, catalogoInicial = null, piezasIniciales = null, clientesIniciales = null, abiertaInicial = null, animarInicial = null, clipInicial = 0, adjuntasIniciales = null, textoInicial = "", papeleraInicial = null }: {
  onCerrar: () => void
  fetchImpl?: typeof fetch
  /** solo pruebas y el arnés de imágenes */
  catalogoInicial?: Catalogo | null
  piezasIniciales?: Pieza[] | null
  clientesIniciales?: Cliente[] | null
  abiertaInicial?: string | null
  /** solo pruebas y el arnés: el cajón de animar abierto con estos movimientos */
  animarInicial?: number[] | null
  /** solo pruebas y el arnés: qué movimiento de una animación se ve */
  clipInicial?: number
  /** solo pruebas y el arnés de imágenes: imágenes ya adjuntas y el texto escrito */
  adjuntasIniciales?: Adjunta[] | null
  textoInicial?: string
  /** solo pruebas y el arnés: la papelera abierta con estas piezas */
  papeleraInicial?: Pieza[] | null
}) {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(catalogoInicial)
  const [clientes, setClientes] = useState<Cliente[] | null>(clientesIniciales)
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [piezas, setPiezas] = useState<Pieza[]>(piezasIniciales ?? [])
  const [filtro, setFiltro] = useState<TipoDePieza | "todo" | "papelera">(papeleraInicial ? "papelera" : "todo")
  const [papelera, setPapelera] = useState<Pieza[] | null>(papeleraInicial)
  const [movida, setMovida] = useState<Pieza | null>(null)
  const [recuperando, setRecuperando] = useState<string | null>(null)
  const [errorGaleria, setErrorGaleria] = useState<string | null>(null)
  const [abierta, setAbierta] = useState<string | null>(abiertaInicial)
  const [tipo, setTipo] = useState<TipoDePieza>("imagen")
  const [texto, setTexto] = useState(textoInicial)
  const [formato, setFormato] = useState("1:1")
  const [modelo3d, setModelo3d] = useState("tripo-h3.1")
  const [calidad, setCalidad] = useState<"normal" | "alta">("normal")
  const [modeloVideo, setModeloVideo] = useState("bytedance/seedance-2.5")
  const [segundos, setSegundos] = useState(5)
  const [resolucion, setResolucion] = useState("720p")
  const [adjuntas, setAdjuntas] = useState<Adjunta[]>(adjuntasIniciales ?? [])
  const [noSubio, setNoSubio] = useState<string | null>(null)
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null)
  const [cotizando, setCotizando] = useState(false)
  const [sinPrecio, setSinPrecio] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // animar un modelo 3D de la galería (GO 06-nov)
  const [animando, setAnimando] = useState(!!animarInicial)
  const [movimientos, setMovimientos] = useState<number[]>(animarInicial ?? [])
  const [busca, setBusca] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [errorAnimar, setErrorAnimar] = useState<string | null>(null)
  const [clip, setClip] = useState(clipInicial)
  // otra pieza abierta: lo de animar empieza de cero
  const abiertaAntes = useRef(abierta)
  useEffect(() => {
    if (abiertaAntes.current === abierta) return
    abiertaAntes.current = abierta
    setAnimando(false); setMovimientos([]); setBusca(""); setErrorAnimar(null); setClip(0)
  }, [abierta])
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
  // 06-nov · selector único: si se elige otro cliente arriba con el estudio abierto, se pasa a ese (lo que estaba abierto o adjunto era del otro)
  useAlCambiarElCliente(clienteId, (id) => { if (!clientes?.some((c) => c.id === id)) return; setClienteId(id); setAbierta(null); setAdjuntas([]); setNoSubio(null); setPapelera(null); setMovida(null); setFiltro((f) => (f === "papelera" ? "todo" : f)) })

  // el cliente que está a la vista: lo que llega tarde de otro cliente no entra a su galería
  const clienteVisto = useRef<string | null>(clienteId)
  clienteVisto.current = clienteId
  const leerGaleria = useCallback(async (id: string) => {
    const j = await fetchImpl(rutaDeGaleria(id), { cache: "no-store" }).then(leerJson<{ piezas: Pieza[] }>).catch(() => null)
    if (j?.ok && clienteVisto.current === id) setPiezas(piezasDelCliente(id, [], j.piezas, true))
  }, [fetchImpl])
  useEffect(() => {
    if (!clienteId || piezasIniciales) return
    // al cambiar de cliente la galería anterior se vacía en el acto (si la lectura falla, no queda la de otro cliente)
    setPiezas([]); setAbierta(null)
    void leerGaleria(clienteId)
  }, [clienteId, leerGaleria, piezasIniciales])

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

  const pedido = useMemo(() => cuerpoDelPedido(clienteId, tipo, texto, { formato, modelo3d, calidad, modeloVideo, segundos, resolucion }, adjuntas.map(comoAdjunta)),
    [clienteId, tipo, texto, formato, modelo3d, calidad, modeloVideo, segundos, resolucion, adjuntas])
  const foto = adjuntas.length ? enOrden(adjuntas)[0] : null
  // con 2 o más imágenes la cotización cambia de modelo; solo en Imagen (Video y 3D usan la 1)
  const nParaElPrecio = tipo === "imagen" && adjuntas.length >= 2 ? adjuntas.length : adjuntas.length ? 1 : 0

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
  }, [clienteId, tipo, formato, modelo3d, calidad, modeloVideo, segundos, resolucion, nParaElPrecio, textoListo, fetchImpl])

  const boton = estadoDelBoton({ clienteId, textoListo, listo: catalogo ? catalogo.listos[tipo] : null, cotizacion, cotizando, sinPrecio, creando })
  const puedeCrear = boton.habilitado

  async function crear() {
    if (!puedeCrear) return
    setCreando(true); setError(null)
    try {
      let cuerpo = pedido
      if (Array.isArray(pedido.fotos)) {
        // varias imágenes viajan juntas: cada subida se achica otra vez para que el pedido no pase del límite
        const fotos = await Promise.all(enOrden(adjuntas).map(async (a) => ("pieza" in a ? comoAdjunta(a) : { numero: a.numero, b64: await reachicar(a.vista, LADO_EN_VARIAS) })))
        cuerpo = { ...pedido, fotos }
      }
      const r = await fetchImpl("/api/estudio/crear", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpoDeCreacion(cuerpo)) })
      const j = await leerJson<{ pieza: Pieza }>(r)
      if (!j.ok || !j.pieza) { setError(j.detalle ?? j.error ?? `No se pudo crear (${r.status}).`); return }
      // si Emilio cambió de cliente mientras se creaba, la pieza no entra en la galería del otro
      if (j.pieza.client_id !== clienteVisto.current) return
      setPiezas((ps) => piezasDelCliente(clienteVisto.current, ps, [j.pieza], false))
      setAbierta(j.pieza.id)
    } catch (e) { setError(e instanceof Error && e.message.startsWith("No pude") ? e.message : "La plataforma no responde.") } finally { setCreando(false) }
  }

  // ── la ✕ y la papelera ──
  const leerPapelera = useCallback(async (id: string) => {
    const j = await fetchImpl(rutaDePapelera(id), { cache: "no-store" }).then(leerJson<{ piezas: Pieza[] }>).catch(() => null)
    if (clienteVisto.current !== id) return
    if (j?.ok) setPapelera(j.piezas.filter((p) => p.client_id === id)); else setErrorGaleria("No pude leer la papelera.")
  }, [fetchImpl])
  useEffect(() => { if (filtro === "papelera" && clienteId && !papeleraInicial) void leerPapelera(clienteId) }, [filtro, clienteId, leerPapelera, papeleraInicial])
  async function quitar(p: Pieza) {
    if (!clienteId || !sePuedeQuitar(p)) return
    setErrorGaleria(null)
    const r = await fetchImpl("/api/estudio/mover-a-papelera", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: clienteId, id: p.id }) }).then(leerJson<{ pieza: Pieza }>).catch(() => null)
    if (!r?.ok || !r.pieza) { setErrorGaleria(r?.detalle ?? "No se pudo quitar: la plataforma no responde."); return }
    setPiezas((ps) => ps.filter((x) => x.id !== p.id))
    setPapelera((ps) => (ps ? [r.pieza, ...ps.filter((x) => x.id !== p.id)] : ps))
    setMovida(r.pieza)
  }
  async function devolver(p: Pieza) {
    if (!clienteId) return
    setRecuperando(p.id); setErrorGaleria(null)
    try {
      const r = await fetchImpl("/api/estudio/recuperar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: clienteId, id: p.id }) }).then(leerJson<{ pieza: Pieza }>).catch(() => null)
      if (!r?.ok || !r.pieza) { setErrorGaleria(r?.detalle ?? "No se pudo recuperar: la plataforma no responde."); return }
      if (r.pieza.client_id !== clienteVisto.current) return
      setPapelera((ps) => (ps ? ps.filter((x) => x.id !== p.id) : ps))
      setPiezas((ps) => piezasDelCliente(clienteVisto.current, ps, [r.pieza], false).sort((a, b) => b.creado_en.localeCompare(a.creado_en)))
      setMovida((m) => (m?.id === p.id ? null : m))
    } finally { setRecuperando(null) }
  }

  const catAnimar = catalogo?.animar
  const puedeAnimar = !!catAnimar && catalogo?.listos.animar === true
  const cotizacionAnimar = catAnimar && movimientos.length ? cotizarAnimacion(catAnimar.precio, movimientos.length) : null
  const botonAnimar = estadoDeAnimar({ clienteId, conectado: puedeAnimar, cotizacion: cotizacionAnimar, enviando })
  const listoParaAnimar = botonAnimar.habilitado

  async function animar(origen: Pieza) {
    if (!listoParaAnimar || !clienteId) return
    setEnviando(true); setErrorAnimar(null)
    try {
      const r = await fetchImpl("/api/estudio/animar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpoDeAnimacion(clienteId, origen.id, movimientos)) })
      const x = respuestaDeAnimar(await leerJson<{ pieza: Pieza }>(r), r.status, clienteVisto.current)
      if ("error" in x) { setErrorAnimar(x.error); return }
      if ("otroCliente" in x) return
      setPiezas((ps) => piezasDelCliente(clienteVisto.current, ps, [x.pieza], false))
      setAbierta(x.pieza.id)
    } catch { setErrorAnimar("La plataforma no responde.") } finally { setEnviando(false) }
  }

  async function alSubir(lista: FileList | null) {
    const archivos = lista ? Array.from(lista) : []
    if (!archivos.length) return
    const rev = revisarArchivos(archivos, MAXIMO_DE_IMAGENES - adjuntas.length)
    const leidas: Foto[] = []
    const fallidas: string[] = []
    for (const f of rev.suben) { try { leidas.push(await fotoAchicada(f)) } catch { fallidas.push(f.name) } }
    // el cupo ya se revisó arriba: todas las leídas caben
    setAdjuntas(agregarImagenes<Adjunta>(adjuntas, leidas).lista)
    setNoSubio(lineaDeLoQueNoSubio({ formato: rev.formato, sinCupo: rev.sinCupo, fallidas }))
  }
  function usarDeLaGaleria(p: Pieza) {
    if (adjuntas.length >= MAXIMO_DE_IMAGENES) { setNoSubio(`Ya hay ${MAXIMO_DE_IMAGENES} imágenes: quita una para sumar esta.`); return }
    if (adjuntas.some((a) => "pieza" in a && a.pieza.id === p.id)) { setAbierta(null); return }
    setAdjuntas((actuales) => agregarImagenes<Adjunta>(actuales, [{ pieza: p }]).lista)
    setNoSubio(null); setTipo("imagen"); setAbierta(null)
  }

  const pieza = abierta ? piezas.find((p) => p.id === abierta) ?? null : null
  const visibles = filtro === "todo" ? piezas : filtro === "papelera" ? papelera ?? [] : piezas.filter((p) => p.tipo === filtro)
  const formatos = tipo === "imagen" ? catalogo?.imagen.formatos ?? ["1:1", "9:16", "16:9"] : catalogo?.video.formatos ?? ["9:16", "16:9", "1:1"]
  const nombreFormato = (f: string) => ({ "1:1": "Cuadrado 1:1", "9:16": "Vertical 9:16", "16:9": "Horizontal 16:9" }[f] ?? f)
  const unaSola = avisoDeUnaSola(tipo, adjuntas)
  const referencias = tipo === "imagen" && adjuntas.length >= 2 ? lineaDeReferencias(cotizacion) : null
  const enProceso = pieza?.estado === "creando" ? pieza : null

  return (
    <div className="nv-panel fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-2 backdrop-blur-[2px] sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <style>{ESTILO}</style>
      <section role="dialog" aria-modal="true" aria-labelledby="estudio-titulo" data-seccion="estudio" className="relative flex h-full max-h-full w-full max-w-[1500px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#171717] text-zinc-200 shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <h2 id="estudio-titulo" className="font-display text-[15px] font-light uppercase tracking-[0.28em]" style={{ color: AMBAR }}>Estudio</h2>
          <p className="hidden text-[12px] text-zinc-500 lg:block">Crea imágenes, videos y modelos 3D</p>
          <div data-para-el-cliente className="flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-[12.5px]">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: AMBAR }} />
            <span className="sr-only">Para el cliente</span>
            <span className="hidden text-zinc-400 sm:inline">Para:</span>
            {/* 06-nov · selector único: el cliente se elige arriba; aquí solo se dice para quién */}
            <span data-cliente className="max-w-[220px] truncate text-zinc-100">{cliente?.nombre ?? (clientes ? "sin elegir" : "Leyendo…")}</span>
          </div>
          <NotaDeTodos />
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
              {/* boceto aprobado 09-nov: las imágenes van sobre la caja, numeradas y cada una con su ✕; el mismo «Subir» acepta varias */}
              <div data-caja-pedido className="es-caja flex flex-col focus-within:border-[#e8731a]/60">
                {adjuntas.length > 0 && (
                  <div data-adjuntas className="flex flex-wrap gap-2 px-3 pt-3">
                    {enOrden(adjuntas).map((a) => (
                      <div key={a.numero} data-adjunta={a.numero} className="relative h-[72px] w-[72px] overflow-hidden rounded-lg border border-white/10 bg-[#222]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {vistaDe(a) && <img src={vistaDe(a)!} alt={`Imagen ${a.numero}`} className="h-full w-full object-cover" />}
                        <span aria-hidden className="absolute bottom-1 left-1 rounded bg-black/75 px-1 text-[10.5px] leading-[15px] text-zinc-100">{a.numero}</span>
                        <button type="button" data-quitar-adjunta={a.numero} aria-label={`Quitar la imagen ${a.numero}`} onClick={() => { setAdjuntas((x) => quitarImagen(x, a.numero)); setNoSubio(null) }}
                          className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-black/70 text-[12px] leading-none text-zinc-100 hover:bg-black/90">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <textarea data-texto value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} maxLength={4000}
                  placeholder={tipo === "video" ? "Describe la toma: qué pasa, la cámara, la luz…" : tipo === "3d" ? "Describe un objeto: forma, material, color…" : adjuntas.length >= 2 ? "Nombra las imágenes por su número: «el personaje de la imagen 2…»" : "Describe la escena: qué se ve, la luz, el ambiente…"}
                  className="w-full resize-none bg-transparent p-3 text-[14px] leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:outline-none" />
                <div className="mx-3 flex items-center gap-3 border-t border-white/10 py-2.5 text-[12.5px] text-zinc-400">
                  <button type="button" data-subir className="es-chip" disabled={adjuntas.length >= MAXIMO_DE_IMAGENES} onClick={() => archivo.current?.click()}>+ Subir</button>
                  <span data-cupo>{adjuntas.length ? `${adjuntas.length} de ${MAXIMO_DE_IMAGENES} imágenes` : tipo === "3d" ? "Sin imagen: primero se crea una y luego se convierte en 3D" : "Opcional · hasta 6 imágenes"} · png, jpg o webp</span>
                  <input ref={archivo} type="file" multiple accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { void alSubir(e.target.files); e.target.value = "" }} />
                </div>
              </div>
              {noSubio && <p data-no-subio role="status" className="mt-1 text-[11.5px] text-amber-300/90">{noSubio}</p>}
              {unaSola && <p data-una-sola className="mt-1 text-[11.5px] text-amber-300/90">{unaSola}</p>}
              {tipo === "3d" && !foto && /\b(logo|logotipo|marca)\b/i.test(texto) && <p className="mt-1 text-[11.5px] text-amber-300/90">Sin imagen de partida, el modelo inventa el logo. Para la marca real, sube una foto del producto.</p>}
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
                {enProceso.tipo === "3d" && enProceso.modelo !== MODELO_DE_ANIMACION && <Paso hecho={enProceso.paso === "3d"} activo={enProceso.paso === "imagen"} texto={enProceso.foto_partida_url ? "Imagen de partida lista" : "Creando la imagen"} />}
                <Paso hecho={false} activo texto={enProceso.modelo === MODELO_DE_ANIMACION ? "Poniendo esqueleto y movimientos" : enProceso.tipo === "3d" ? "Convirtiendo en 3D" : enProceso.tipo === "video" ? "Creando el video" : "Creando la imagen"} nota={enProceso.modelo === MODELO_DE_ANIMACION ? "≈ 1-3 min" : enProceso.tipo === "3d" ? (enProceso.modelo === "meshy-6" ? "5 a 10 min" : "≈ 1-3 min") : enProceso.tipo === "video" ? "unos minutos" : undefined} />
                <Paso hecho={false} activo={false} texto={`Guardar en la galería de ${cliente?.nombre ?? "este cliente"}`} />
              </div>
            )}
            <button type="button" data-crear onClick={() => void crear()} disabled={!puedeCrear}
              className={`mt-auto flex items-center justify-between rounded-control px-4 py-3.5 text-boton font-medio transition-opacity disabled:cursor-not-allowed ${claseDelCentrado(boton.costo)}`}
              style={{ background: puedeCrear ? AMBAR : "#3a2a1a", color: puedeCrear ? "#1a0d02" : "#f0a04b" }}>
              <span>{creando ? "Creando…" : "Crear"}</span>
              {/* en escritorio «Crear» va centrado: el costo o el aviso queda a la derecha sin empujarlo, y la pista «escribe qué quieres» no se muestra */}
              <span data-costo className={claseDelCosto(boton.costo)}>
                {boton.costo}
              </span>
            </button>
            {referencias && <p data-referencias className="-mt-2 text-right text-[11.5px] text-zinc-500">{referencias}</p>}
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
                  <span className="shrink-0 text-[12.5px] text-zinc-500">{NOMBRE_DEL_TIPO[pieza.tipo]}{pieza.modelo === MODELO_DE_ANIMACION ? " · animado" : ""}{pieza.estado === "creando" ? " · creando" : ""}</span>
                  <button type="button" className="es-chip ml-auto" onClick={() => setAbierta(null)}>← Galería</button>
                </div>
                <div data-visor className="relative min-h-[280px] flex-1 overflow-hidden rounded-xl border border-white/10 bg-[#0c0c0c]">
                  <Vista pieza={pieza} glb={clipsDe(pieza)[clip]?.glb ?? null} />
                  {pieza.tipo === "3d" && pieza.estado === "lista" && pieza.archivo_tipo === "glb" && pieza.modelo !== MODELO_DE_ANIMACION && <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-black/65 px-3 py-1.5 text-[12px] text-zinc-200">Arrastra con el mouse o el dedo para girarlo</span>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-zinc-500">
                  <span>Modelo <b className="font-medium text-zinc-300">{pieza.modelo}</b></span>
                  {pieza.archivo_tipo && <span>Archivo <b className="font-medium text-zinc-300">.{pieza.archivo_tipo === "image" ? "png" : pieza.archivo_tipo === "video" ? "mp4" : pieza.archivo_tipo}</b></span>}
                  <span>Para <b className="font-medium text-zinc-300">{cliente?.nombre}</b></span>
                  {pieza.aviso && <span className="text-amber-300/80">{pieza.aviso}</span>}
                </div>
                {clipsDe(pieza).length > 1 && (
                  <div data-clips className="flex flex-wrap gap-1.5">
                    {clipsDe(pieza).map((c, i) => <button key={c.action_id} type="button" className="es-chip" aria-pressed={clip === i} onClick={() => setClip(i)}>{nombreDelMovimiento(catAnimar, c.action_id)}</button>)}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {pieza.estado === "lista" && clipsDe(pieza).length > 0 && [["GLB", clipsDe(pieza)[clip]?.glb], ["FBX", clipsDe(pieza)[clip]?.fbx]].map(([que, url]) => url && <a key={que} data-bajar={que} href={url} download target="_blank" rel="noreferrer" className={que === "GLB" ? "rounded-lg px-3.5 py-2 text-[13.5px] font-semibold" : "rounded-lg border border-white/15 px-3.5 py-2 text-[13.5px]"} style={que === "GLB" ? { background: AMBAR, color: "#1a0d02" } : undefined}>Descargar {que}</a>)}
                  {pieza.archivo_url && pieza.estado === "lista" && clipsDe(pieza).length === 0 && <a data-descargar href={pieza.archivo_url} download target="_blank" rel="noreferrer" className={animando ? "rounded-lg border border-white/15 px-3.5 py-2 text-[13.5px]" : "rounded-lg px-3.5 py-2 text-[13.5px] font-semibold"} style={animando ? undefined : { background: AMBAR, color: "#1a0d02" }}>Descargar</a>}
                  {pieza.tipo === "imagen" && pieza.estado === "lista" && <button type="button" className="rounded-lg border border-white/15 px-3.5 py-2 text-[13.5px]" onClick={() => usarDeLaGaleria(pieza)}>Usar como imagen de partida</button>}
                  {esAnimable(pieza) && puedeAnimar && <button type="button" data-animar aria-expanded={animando} className="rounded-lg border border-white/15 px-3.5 py-2 text-[13.5px]" onClick={() => setAnimando(!animando)}>Animar</button>}
                  {pieza.modelo !== MODELO_DE_ANIMACION && <button type="button" className="rounded-lg border border-white/15 px-3.5 py-2 text-[13.5px]" onClick={() => { setTipo(pieza.tipo); setTexto(pieza.prompt); setAbierta(null) }}>Crear otra versión</button>}
                  <span className="ml-auto text-[12.5px] text-zinc-500">{pieza.estado === "creando" ? `Costará ≈ ${dolares(pieza.costo_estimado_usd)}` : <>Costó <b className="text-zinc-200">{dolares(pieza.costo_usd)}</b> · anotado en el libro</>}</span>
                </div>
                {animando && catAnimar && esAnimable(pieza) && (
                  <div data-cajon-animar className="es-caja flex flex-col gap-3 p-3.5">
                    <div>
                      <div className="es-eti">Movimiento</div>
                      <div className="flex flex-wrap gap-1.5">
                        {catAnimar.comunes.map((m) => <button key={m.id} type="button" data-movimiento={m.id} className="es-chip" aria-pressed={movimientos.includes(m.id)} disabled={!movimientos.includes(m.id) && movimientos.length >= catAnimar.maximo} onClick={() => setMovimientos((x) => alternarMovimiento(x, m.id, catAnimar.maximo))}>{m.nombre}</button>)}
                      </div>
                    </div>
                    <div>
                      <div className="es-eti">Buscar</div>
                      <input data-buscar value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={`${catAnimar.biblioteca.length} movimientos: dance, jump, sit…`} className="es-caja w-full px-3 py-2 text-[13.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-[#e8731a]/60 focus:outline-none" />
                      {busca.trim().length >= 2 && (
                        <div data-resultados className="mt-2 flex max-h-[150px] flex-wrap gap-1.5 overflow-y-auto">
                          {buscarMovimientos(catAnimar.biblioteca, busca).map(([id, nombre]) => <button key={id} type="button" data-movimiento={id} className="es-chip" aria-pressed={movimientos.includes(id)} disabled={!movimientos.includes(id) && movimientos.length >= catAnimar.maximo} onClick={() => setMovimientos((x) => alternarMovimiento(x, id, catAnimar.maximo))}>{nombre.replace(/_/g, " ")}</button>)}
                          {buscarMovimientos(catAnimar.biblioteca, busca).length === 0 && <span className="text-[12px] text-zinc-500">Nada con ese nombre.</span>}
                        </div>
                      )}
                    </div>
                    {movimientos.length > 0 && <p data-elegidos className="text-[12.5px] text-zinc-400">Elegidos ({movimientos.length} de {catAnimar.maximo}): <span className="text-zinc-200">{movimientos.map((id) => nombreDelMovimiento(catAnimar, id)).join(", ")}</span></p>}
                    <p className="text-[11.5px] leading-snug text-zinc-500">Solo se anima una figura humana con brazos y piernas. Si no lo es, se avisa y no se cobra.</p>
                    {errorAnimar && <p role="alert" className="text-[12.5px] text-red-300">{errorAnimar}</p>}
                    <div className="flex items-center justify-end gap-3">
                      {cotizacionAnimar && <span data-desglose-animar className="text-[11.5px] text-zinc-500">{cotizacionAnimar.partes.map((x) => `${x.que} ${dolares(x.usd)}`).join(" + ")}</span>}
                      <button type="button" data-animar-crear onClick={() => void animar(pieza)} disabled={!listoParaAnimar}
                        className="flex items-center gap-3 rounded-control px-4 py-2.5 text-boton font-medio disabled:cursor-not-allowed"
                        style={{ background: listoParaAnimar ? AMBAR : "#3a2a1a", color: listoParaAnimar ? "#1a0d02" : "#f0a04b" }}>
                        <span>{enviando ? "Animando…" : "Animar"}</span>
                        <span data-costo-animar className="text-dato font-medio opacity-90">{botonAnimar.costo}</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="text-[16px] font-semibold">Galería</h3>
                  <span className="text-[12.5px] text-zinc-500">Lo creado para {cliente?.nombre ?? "este cliente"}</span>
                  <div className="ml-auto flex gap-1.5">
                    {(["todo", ...TIPOS] as const).map((f) => <button key={f} type="button" className="es-chip" aria-pressed={filtro === f} onClick={() => setFiltro(f)}>{f === "todo" ? "Todo" : NOMBRE_DEL_TIPO[f]}</button>)}
                    <button type="button" data-ver-papelera className="es-chip" aria-pressed={filtro === "papelera"} onClick={() => setFiltro("papelera")}>Papelera</button>
                  </div>
                </div>
                {movida && filtro !== "papelera" && (
                  <p data-movida role="status" className="-mt-1 text-[12.5px] text-zinc-400">Se movió a la papelera por 30 días. <button type="button" data-deshacer className="text-[#f0a04b] underline-offset-2 hover:underline" onClick={() => void devolver(movida)}>Deshacer</button></p>
                )}
                {filtro === "papelera" && <p className="-mt-1 text-[12.5px] text-zinc-500">Lo que quitaste de la galería. Se recupera durante 30 días; después se borra solo, con sus archivos.</p>}
                {errorGaleria && <p role="alert" className="-mt-1 text-[12.5px] text-red-300">{errorGaleria}</p>}
                {visibles.length ? (
                  <div data-galeria className="grid grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
                    {visibles.map((p) => filtro === "papelera"
                      ? <Miniatura key={p.id} p={p} alAbrir={() => undefined} enPapelera={{ dias: diasQueQuedan(p.en_papelera_desde, Date.now()), alRecuperar: () => void devolver(p), recuperando: recuperando === p.id }} />
                      : <Miniatura key={p.id} p={p} alAbrir={() => setAbierta(p.id)} alQuitar={() => void quitar(p)} />)}
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/10 p-8 text-center text-[13px] text-zinc-500">{filtro === "papelera" ? (papelera ? "La papelera está vacía." : "Leyendo la papelera…") : `Todavía no hay nada creado para ${cliente?.nombre ?? "este cliente"}. Lo que crees aparece aquí.`}</div>
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
