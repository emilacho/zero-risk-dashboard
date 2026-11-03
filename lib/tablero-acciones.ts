/**
 * LO QUE EMILIO MANEJA DESDE EL TABLERO (30-oct · «el dashboard se maneja, no solo se mira»).
 * Regla de oro: el tablero NO escribe la base. Cada botón es una acción con nombre que pasa por una sola puerta del tablero (`/api/acciones/{accion}`, solo administrador con sesión)
 * y de ahí a la ruta de la plataforma `POST /api/tablero/{accion}` con la llave interna; la plataforma hace el cambio y deja el rastro en `eventos_de_emilio`.
 * Si la plataforma todavía no tiene la ruta responde 404/405 y aquí se dice «todavía no disponible» (501): nunca se simula un cambio.
 * Una acción que GASTA dinero exige `confirmo_gasto: true` (el botón lo manda solo después de mostrar el tope) y se rechaza sin él.
 */
import { vaciarCache } from "@/lib/cache-corta"
import { TOPE_DEL_TEXTO_DEL_MANUAL } from "@/lib/manual"

export type NombreDeAccion =
  | "rehacer-pieza"
  | "archivo-recuperar-pieza"
  | "plan-aprobar" | "plan-cambios" | "plan-responder"
  | "firmar-tablero"
  | "cliente-editar" | "cliente-nuevo" | "cliente-baja" | "cliente-tope"
  | "oficina-estado" | "oficina-tope"
  | "revision-resolver"
  | "manual-campos" | "manual-validar" | "manual-palabra" | "manual-validar-campo" | "manual-cambios"

type Cuerpo = Record<string, unknown>
export type Validacion = { ok: true; cuerpo: Cuerpo } | { ok: false; error: string; detalle: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const esObjeto = (v: unknown): v is Cuerpo => !!v && typeof v === "object" && !Array.isArray(v)
const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "")
const mal = (detalle: string): Validacion => ({ ok: false, error: "pedido_invalido", detalle })

/** las que tienen interruptor propio; el cerebro y su portero se manejan por sus pausas, no desde aquí */
export const OFICINAS_MANEJABLES = ["creativa", "financiera", "jefatura", "planeacion"] as const
export const REDES = ["instagram", "facebook", "tiktok", "linkedin", "youtube"] as const
/** tope de un pedido de cambios al plan (contrato CC1: ≤ 8 · el panel lo muestra y lo confirma) */
export const TOPE_PEDIR_CAMBIOS_USD = 8
/** el tope de un pedido de cambios al manual (CC1 02-nov, provisional): el mismo valor que manda el panel (`lib/manual-ciclo.ts`) */
export const TOPE_PEDIR_CAMBIOS_AL_MANUAL_USD = 5
/** lo que el dueño escribe en un pedido (texto libre + observaciones): el mismo techo que la plataforma (CC1 #869 · `plan_cambios_texto_check` · Lenovo 16:57Z: se queda en 100.000) */
export const TOPE_DEL_TEXTO_DEL_DUENO = 100_000
/** tope por pieza de la mesa creativa (firma de Emilio, 30-oct): se muestra antes de confirmar */
export const TOPE_POR_PIEZA_USD = 5

export interface DefinicionDeAccion {
  /** cuánto puede costar como máximo; si hay valor, el botón muestra el tope y exige confirmar */
  gasta: null | { tope_usd: number }
  validar: (c: Cuerpo) => Validacion
  /** ruta de la plataforma; por omisión `/api/tablero/{accion}` */
  ruta?: (c: Cuerpo) => string
  metodo?: "POST" | "PATCH"
}

const conId = (c: Cuerpo, campo: string): string | null => (typeof c[campo] === "string" && UUID.test(c[campo] as string) ? (c[campo] as string) : null)
const comentario = (c: Cuerpo, min: number, max = 2000): string | null => { const t = texto(c.comentario); return t.length >= min && t.length <= max ? t : null }

export const ACCIONES: Record<NombreDeAccion, DefinicionDeAccion> = {
  // CC6 · 03-nov · ruta de CC1 (#852): devuelve UNA pieza archivada de una campaña anterior a la bandeja; no gasta. Fuera del archivo la plataforma da 409
  "archivo-recuperar-pieza": {
    gasta: null,
    validar: (c) => { const id = conId(c, "hitl_id"); return id ? { ok: true, cuerpo: { hitl_id: id } } : mal("falta la pieza que se recupera") },
    ruta: () => "/api/cadena/archivo/recuperar-pieza",
  },
  "rehacer-pieza": {
    gasta: { tope_usd: TOPE_POR_PIEZA_USD },
    validar: (c) => { const id = conId(c, "encargo_id"); return id ? { ok: true, cuerpo: { encargo_id: id, ...(texto(c.comentario) ? { comentario: texto(c.comentario).slice(0, 2000) } : {}) } } : mal("falta la pieza que se rehace") },
  },
  // CICLO DEL PLAN (CC6 · 01-nov · contrato certificado de CC1 §2): con `plan_id` van las puertas nuevas. Sin él queda la forma vieja (`campana_id`, la ficha del
  // cliente en el tablero de siempre), tal cual estaba: esa página no se toca y la plataforma la rechaza con 400 sin cambiar nada (ADENDA 1 de CC1).
  "plan-aprobar": {
    gasta: null,
    validar: (c) => {
      const plan = conId(c, "plan_id")
      if (plan) { const t = texto(c.comentario); return t.length > 1000 ? mal("el comentario pasa de 1.000 caracteres") : { ok: true, cuerpo: { plan_id: plan, ...(t ? { comentario: t } : {}) } } }
      const id = conId(c, "campana_id"); return id ? { ok: true, cuerpo: { campana_id: id } } : mal("falta el plan")
    },
  },
  "plan-cambios": {
    // GASTA cuando va con `plan_id` (el jefe de marketing reescribe y la jefatura revisa): el servidor exige la confirmación y el tope, no solo la pantalla
    gasta: null,
    validar: (c) => {
      const plan = conId(c, "plan_id")
      if (plan) {
        const t = texto(c.texto), tope = Number(c.tope_usd)
        if (t.length < 5 || t.length > 4000) return mal("cuenta qué debe cambiar (de 5 a 4.000 caracteres)")
        if (c.confirmo_gasto !== true) return { ok: false, error: "falta_confirmar_gasto", detalle: `pedir cambios gasta (tope hasta US$ ${TOPE_PEDIR_CAMBIOS_USD}): confírmalo antes` }
        if (!Number.isFinite(tope) || tope <= 0) return mal("falta el tope del gasto")
        if (tope > TOPE_PEDIR_CAMBIOS_USD) return mal(`el tope pasa de US$ ${TOPE_PEDIR_CAMBIOS_USD}`)
        return { ok: true, cuerpo: { plan_id: plan, texto: t, confirmo_gasto: true, tope_usd: tope } }
      }
      const id = conId(c, "campana_id"), t = comentario(c, 5); return !id ? mal("falta el plan") : !t ? mal("cuenta qué quieres cambiar (de 5 a 2.000 caracteres)") : { ok: true, cuerpo: { campana_id: id, comentario: t } }
    },
  },
  "plan-responder": {
    gasta: null,
    validar: (c) => { const id = conId(c, "espera_id"), t = texto(c.respuesta); return !id ? mal("falta la pregunta que se contesta") : t.length < 1 || t.length > 2000 ? mal("escribe la respuesta (hasta 2.000 caracteres)") : { ok: true, cuerpo: { espera_id: id, respuesta: t } } },
  },
  "firmar-tablero": { gasta: null, validar: (c) => { const id = conId(c, "tablero_id"); return id ? { ok: true, cuerpo: { tablero_id: id } } : mal("falta el tablero que se firma") } },
  "cliente-editar": {
    gasta: null,
    validar: (c) => {
      const id = conId(c, "client_id")
      if (!id) return mal("falta el cliente")
      if (!esObjeto(c.campos)) return mal("faltan los datos que cambian")
      const campos: Cuerpo = {}
      for (const k of ["rubro", "ciudad", "sitio", "redes"]) {
        const v = (c.campos as Cuerpo)[k]
        if (v === undefined) continue
        if (k === "presupuesto") { const n = Number(v); if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return mal("el presupuesto debe ser un número positivo"); campos[k] = n; continue }
        if (k === "redes") { if (!esObjeto(v)) return mal("las redes deben ir como lista de usuarios"); campos[k] = Object.fromEntries(Object.entries(v).filter(([r]) => (REDES as readonly string[]).includes(r)).map(([r, u]) => [r, texto(u).slice(0, 120)])); continue }
        const t = texto(v); if (t.length > 300) return mal(`«${k}» es demasiado largo`); campos[k] = t
      }
      return Object.keys(campos).length ? { ok: true, cuerpo: { client_id: id, campos } } : mal("no cambió nada")
    },
  },
  "cliente-tope": {
    gasta: null,
    validar: (c) => {
      const id = conId(c, "client_id"), n = Number(c.tope_usd)
      if (!id) return mal("falta el cliente")
      return !Number.isFinite(n) || n <= 0 || n > 1000 ? mal("el tope debe estar entre 0,01 y 1.000 dólares") : { ok: true, cuerpo: { client_id: id, tope_usd: Math.round(n * 100) / 100 } }
    },
  },
  "cliente-nuevo": {
    gasta: null,
    validar: (c) => {
      const nombre = texto(c.nombre), rubro = texto(c.rubro)
      if (nombre.length < 2 || nombre.length > 120) return mal("escribe el nombre del cliente")
      if (rubro.length < 3 || rubro.length > 200) return mal("cuenta de qué rubro es")
      const out: Cuerpo = { nombre, rubro }
      if (texto(c.ciudad)) out.ciudad = texto(c.ciudad).slice(0, 120)
      if (texto(c.sitio)) out.sitio = texto(c.sitio).slice(0, 300)
      if (c.presupuesto !== undefined && c.presupuesto !== "") { const n = Number(c.presupuesto); if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return mal("el presupuesto debe ser un número positivo"); out.presupuesto = n }
      return { ok: true, cuerpo: out }
    },
  },
  "cliente-baja": {
    gasta: null,
    validar: (c) => { const id = conId(c, "client_id"), t = comentario(c, 5, 500); return !id ? mal("falta el cliente") : !t ? mal("cuenta por qué se da de baja (mínimo 5 caracteres)") : { ok: true, cuerpo: { client_id: id, comentario: t } } },
  },
  "oficina-estado": {
    gasta: null,
    validar: (c) => { const o = texto(c.oficina), e = texto(c.estado); return !(OFICINAS_MANEJABLES as readonly string[]).includes(o) ? mal("oficina desconocida") : e !== "encendida" && e !== "apagada" ? mal("el estado es «encendida» o «apagada»") : { ok: true, cuerpo: { oficina: o, estado: e } } },
  },
  "oficina-tope": {
    gasta: null,
    validar: (c) => { const o = texto(c.oficina), n = Number(c.tope_usd); return !(OFICINAS_MANEJABLES as readonly string[]).includes(o) ? mal("oficina desconocida") : !Number.isFinite(n) || n <= 0 || n > 1000 ? mal("el tope debe estar entre 0,01 y 1.000 dólares") : { ok: true, cuerpo: { oficina: o, tope_usd: Math.round(n * 100) / 100 } } },
  },
  "revision-resolver": {
    gasta: null,
    validar: (c) => {
      const id = conId(c, "hitl_id"), d = texto(c.decision)
      if (!id) return mal("falta la revisión")
      if (d !== "aprobar" && d !== "rechazar") return mal("la decisión es «aprobar» o «rechazar»")
      const t = texto(c.comentario)
      if (d === "rechazar" && t.length < 5) return mal("cuenta por qué se rechaza (mínimo 5 caracteres)")
      return { ok: true, cuerpo: { hitl_id: id, decision: d, ...(t ? { comentario: t.slice(0, 2000) } : {}) } }
    },
  },
  "manual-campos": {
    gasta: null, metodo: "PATCH",
    ruta: (c) => `/api/manual/${String(c.client_id)}/campos`,
    validar: (c) => {
      const id = conId(c, "client_id")
      if (!id) return mal("falta el cliente")
      if (!esObjeto(c.campos)) return mal("faltan los campos que cambian")
      const campos: Cuerpo = {}
      let porque = texto(c.comentario)
      // RETIRAR UN CAMPO ENTERO (CC6 · 03-nov · contrato CC1 #864): vacío = el dueño lo retira. Solo si el pedido lo nombra en `retirar`:
      // un cuadro que llega en blanco por accidente (o desde el tablero viejo) sigue rechazado (condición A de CC3)
      const retirar = new Set(Array.isArray(c.retirar) ? c.retirar.filter((x): x is string => typeof x === "string") : [])
      for (const [k, v] of Object.entries(c.campos)) {
        if (k === "comentario_porque") { porque = texto(v) || porque; continue }
        if (!CAMPOS_DEL_MANUAL.some((x) => x.clave === k)) return mal(`«${k}» no es un campo que se pueda editar`)
        const t = texto(v)
        if (t.length === 0 && retirar.has(k)) { campos[k] = ""; continue }
        if (t.length === 0 || t.length > TOPE_DEL_TEXTO_DEL_MANUAL) return mal(`«${k}» no puede quedar vacío ni pasar de ${TOPE_DEL_TEXTO_DEL_MANUAL.toLocaleString("es-EC")} caracteres`); campos[k] = t
      }
      for (const k of retirar) if (campos[k] !== "") return mal(`«${k}» se pidió retirar pero no viene vacío`)
      if (!Object.keys(campos).length) return mal("no cambió nada")
      return { ok: true, cuerpo: { client_id: id, campos, ...(porque ? { comentario: porque.slice(0, 1000) } : {}) } }
    },
  },
  "manual-validar": {
    gasta: null,
    validar: (c) => { const id = conId(c, "client_id"); return id ? { ok: true, cuerpo: { client_id: id } } : mal("falta el cliente") },
  },
  // TABLERO DEL DUEÑO · palabras del manual (CC6 · 01-nov · contrato de CC1 #815): prohibir, dejar como estilo o quitar. US$ 0; versión nueva del manual.
  // VALIDAR UN CAMPO sin versión nueva (CC6 · 02-nov · contrato CC1 `254b94f`, certificado por CC3): el dueño lo da por bueno o le quita la validación. US$ 0
  // PEDIR CAMBIOS AL MANUAL (CC6 · 02-nov · contrato CC1): como «plan-cambios», GASTA en la plataforma (el equipo del manual reescribe y la jefatura revisa);
  // el servidor exige la confirmación y el tope (US$ 5 provisional), no solo la pantalla. Sin aviso de gasto en /nuevo (Emilio, 01-nov): se manda por código
  "manual-cambios": {
    gasta: null,
    // UN SOLO PEDIDO (CC6 · 03-nov · opción B de Lenovo, contrato CC1 #869): en la misma puerta van lo directo (`campos` como objeto · `retirar[]`),
    // las observaciones por campo y el texto libre. Lo directo solo no gasta ni reescribe; el gasto se confirma solo si hay observaciones o texto.
    // `campos` como LISTA sigue siendo lo de siempre: los campos de la sección que se liberan
    validar: (c) => {
      const id = conId(c, "client_id"), t = texto(c.texto)
      if (!id) return mal("falta el cliente")
      const clave = (x: unknown) => typeof x === "string" && /^[a-z_]{2,40}$/.test(x)
      // lo directo
      const directos: Cuerpo = {}
      const retirar = Array.isArray(c.retirar) ? c.retirar : []
      if (retirar.length > 60 || !retirar.every(clave)) return mal("los campos para retirar no son válidos")
      if (esObjeto(c.campos)) {
        for (const [k, v] of Object.entries(c.campos)) {
          if (!CAMPOS_DEL_MANUAL.some((x) => x.clave === k)) return mal(`«${k}» no es un campo que se pueda editar`)
          const v2 = texto(v)
          if (!v2 && !retirar.includes(k)) return mal(`«${k}» llega vacío sin pedir retirarlo`)
          if (v2.length > TOPE_DEL_TEXTO_DEL_MANUAL) return mal(`«${k}» pasa de ${TOPE_DEL_TEXTO_DEL_MANUAL.toLocaleString("es-EC")} caracteres`)
          directos[k] = v2
        }
      }
      for (const k of retirar as string[]) if (directos[k] === undefined) directos[k] = ""
      // las observaciones
      const obsCrudas = Array.isArray(c.observaciones_por_campo) ? c.observaciones_por_campo : []
      if (obsCrudas.length > 60) return mal("demasiadas observaciones")
      const observaciones: Array<{ campo: string; texto: string }> = []
      for (const o of obsCrudas) {
        if (!esObjeto(o) || !clave(o.campo) || !texto(o.texto)) return mal("una observación no es válida")
        observaciones.push({ campo: String(o.campo), texto: texto(o.texto) })
      }
      const largo = t.length + observaciones.reduce((n, o) => n + o.texto.length, 0)
      if (largo > TOPE_DEL_TEXTO_DEL_DUENO) return mal(`lo escrito pasa de ${TOPE_DEL_TEXTO_DEL_DUENO.toLocaleString("es-EC")} caracteres`)
      const reescribe = largo > 0
      if (!reescribe && !Object.keys(directos).length) return mal("no hay cambios para pedir")
      if (reescribe && !observaciones.length && t.length < 5) return mal("cuenta qué debe cambiar (al menos 5 letras)")
      const seccion = texto(c.seccion)
      if (seccion.length > 80) return mal("la sección es demasiado larga")
      const liberar = Array.isArray(c.campos) ? c.campos : []
      if (liberar.length > 30 || !liberar.every(clave)) return mal("los campos de la sección no son válidos")
      let gasto: Cuerpo = {}
      if (reescribe) {
        const tope = Number(c.tope_usd)
        if (c.confirmo_gasto !== true) return { ok: false, error: "falta_confirmar_gasto", detalle: `pedir cambios al manual gasta (tope hasta US$ ${TOPE_PEDIR_CAMBIOS_AL_MANUAL_USD}): confírmalo antes` }
        if (!Number.isFinite(tope) || tope <= 0) return mal("falta el tope del gasto")
        if (tope > TOPE_PEDIR_CAMBIOS_AL_MANUAL_USD) return mal(`el tope pasa de US$ ${TOPE_PEDIR_CAMBIOS_AL_MANUAL_USD}`)
        gasto = { confirmo_gasto: true, tope_usd: tope }
      }
      return { ok: true, cuerpo: {
        client_id: id,
        ...(Object.keys(directos).length ? { campos: directos } : seccion ? { campos: liberar } : {}),
        ...(retirar.length ? { retirar } : {}),
        ...(observaciones.length ? { observaciones_por_campo: observaciones } : {}),
        ...(t ? { texto: t } : {}),
        ...(seccion ? { seccion } : {}),
        ...gasto,
      } }
    },
  },
  "manual-validar-campo": {
    gasta: null,
    validar: (c) => {
      const id = conId(c, "client_id"), campo = texto(c.campo)
      if (!id) return mal("falta el cliente")
      if (!/^[a-z_]{2,40}$/.test(campo)) return mal("falta el campo")
      if (c.validado !== undefined && typeof c.validado !== "boolean") return mal("«validado» es verdadero o falso")
      return { ok: true, cuerpo: { client_id: id, campo, validado: c.validado !== false } }
    },
  },
  "manual-palabra": {
    gasta: null,
    validar: (c) => {
      const id = conId(c, "client_id"), t = texto(c.texto), d = texto(c.decision), com = texto(c.comentario)
      if (!id) return mal("falta el cliente")
      if (!t || t.length > 200) return mal("la palabra debe tener entre 1 y 200 caracteres")
      if (d !== "prohibir" && d !== "contexto" && d !== "quitar") return mal("la decisión es «prohibir», «contexto» o «quitar»")
      if (com.length > 1000) return mal("el porqué pasa de 1.000 caracteres")
      return { ok: true, cuerpo: { client_id: id, texto: t, decision: d, ...(com ? { comentario: com } : {}) } }
    },
  },
}

/** los campos del manual que Emilio puede escribir: desde CC1 `0934662` (02-nov, ADENDA 1 de Lenovo) son TODOS los que muestra el panel */
export const CAMPOS_DEL_MANUAL: Array<{ clave: string; etiqueta: string; largo: boolean }> = [
  { clave: "proposito", etiqueta: "Propósito", largo: true },
  { clave: "mision", etiqueta: "Misión", largo: true },
  { clave: "vision", etiqueta: "Visión", largo: true },
  { clave: "eslogan", etiqueta: "Eslogan", largo: false },
  { clave: "voz", etiqueta: "Voz", largo: true },
  { clave: "posicionamiento", etiqueta: "Posicionamiento", largo: true },
  { clave: "publico", etiqueta: "Público", largo: true },
  { clave: "valores", etiqueta: "Valores", largo: true },
  { clave: "nunca", etiqueta: "Lo que la marca nunca dice o hace", largo: true },
  { clave: "personalidad", etiqueta: "Personalidad", largo: true },
  { clave: "mensajes_clave", etiqueta: "Mensajes clave", largo: true },
  { clave: "propuestas_de_valor", etiqueta: "Propuestas de valor", largo: true },
  { clave: "tono_por_canal", etiqueta: "Tono según el canal", largo: true },
  { clave: "reglas_de_escritura", etiqueta: "Reglas de escritura", largo: true },
  { clave: "direccion_de_fotografia", etiqueta: "Dirección de fotografía", largo: true },
  { clave: "uso_del_logo", etiqueta: "Uso del logo", largo: true },
  { clave: "jerarquia_tipografica", etiqueta: "Jerarquía tipográfica", largo: true },
  { clave: "historia_y_origen", etiqueta: "Historia y origen", largo: true },
]

export interface RespuestaDeAccion { status: number; cuerpo: Record<string, unknown> }
export interface DepsDeAccion { revisor: string; plataformaUrl?: string; llave?: string; fetchImpl?: typeof fetch }

const sinBarra = (u: string) => u.replace(/\/+$/, "")

export function esNombreDeAccion(n: string): n is NombreDeAccion { return Object.prototype.hasOwnProperty.call(ACCIONES, n) }

export async function ejecutarAccion(nombre: string, raw: unknown, d: DepsDeAccion): Promise<RespuestaDeAccion> {
  if (!esNombreDeAccion(nombre)) return { status: 404, cuerpo: { ok: false, error: "accion_desconocida" } }
  const def = ACCIONES[nombre]
  const c = esObjeto(raw) ? raw : {}
  const v = def.validar(c)
  if (!v.ok) return { status: 400, cuerpo: { ok: false, error: v.error, detalle: v.detalle } }
  // un botón que gasta no puede gastar sin que Emilio haya visto el tope: el servidor lo exige, no solo la pantalla
  if (def.gasta && c.confirmo_gasto !== true) return { status: 400, cuerpo: { ok: false, error: "falta_confirmar_gasto", detalle: `esta acción puede costar hasta US$ ${def.gasta.tope_usd}: confírmalo antes`, tope_usd: def.gasta.tope_usd } }
  const base = sinBarra(d.plataformaUrl ?? process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "https://zero-risk-platform.vercel.app")
  const llave = d.llave ?? (process.env.PLATFORM_INTERNAL_KEY || process.env.INTERNAL_API_KEY || "")
  if (!llave) return { status: 503, cuerpo: { ok: false, error: "llave_interna_sin_poner", detalle: "el tablero no tiene la llave con la que llama a la plataforma" } }
  const ruta = def.ruta ? def.ruta(v.cuerpo) : `/api/tablero/${nombre}`
  const cuerpoFinal = nombre === "manual-campos" ? { ...v.cuerpo, client_id: undefined } : v.cuerpo
  try {
    const r = await (d.fetchImpl ?? fetch)(`${base}${ruta}`, {
      method: def.metodo ?? "POST",
      headers: { "Content-Type": "application/json", "x-api-key": llave },
      body: JSON.stringify({ ...cuerpoFinal, reviewer: d.revisor, origen: "dashboard", ...(def.gasta ? { confirmo_gasto: true, tope_usd: def.gasta.tope_usd } : {}) }),
    })
    vaciarCache() // después de una acción la próxima lectura es fresca (el reflejo inmediato manda sobre la caché corta)
    // se LEE la respuesta entera (CC6 · 03-nov): cortarla antes de leerla perdía `despertado: false` en una respuesta larga y el panel decía «listo»;
    // solo el texto plano que se muestra se acorta
    const crudo = await r.text().catch(() => "")
    const t = crudo.slice(0, 600)
    let datos: Record<string, unknown> = {}
    try { const j = JSON.parse(crudo); if (esObjeto(j)) datos = j } catch { /* texto plano */ }
    // un 404 CON motivo de la plataforma (p. ej. `plan_inexistente` del ciclo del plan) no es «la ruta no existe»: se pasa con su motivo (CC6 · 01-nov)
    if (r.status === 404 && typeof datos.error === "string" && /^[a-z_]+$/.test(datos.error) && datos.error !== "not_found") return { status: 404, cuerpo: { ok: false, error: "no_encontrado", detalle: String(datos.detalle ?? datos.error), plataforma: datos } }
    if (r.status === 404 || r.status === 405) return { status: 501, cuerpo: { ok: false, error: "todavia_no_disponible", detalle: "la plataforma todavía no tiene esta acción: no se hizo ningún cambio" } }
    if (r.status === 401 || r.status === 403) return { status: 502, cuerpo: { ok: false, error: "la_plataforma_no_acepto_la_llave", plataforma_status: r.status, detalle: "el tablero no pudo identificarse ante la plataforma" } }
    if (r.status === 409) return { status: 409, cuerpo: { ok: false, error: "conflicto", detalle: String(datos.detalle ?? datos.error ?? "otra decisión se adelantó: recarga"), plataforma: datos } }
    // `plataforma_error` = el código de la plataforma tal cual (p. ej. `planes_error` del ciclo del plan antes de la «ventana»): la pantalla lo traduce sin mostrar el detalle técnico
    // `directo` (contrato CC1 #869): lo directo de un pedido de cambios YA quedó guardado aunque la reescritura fallara; el panel lo dice y reintenta solo lo que falta
    if (!r.ok) return { status: 502, cuerpo: { ok: false, error: "la_plataforma_rechazo", plataforma_status: r.status, ...(typeof datos.error === "string" ? { plataforma_error: datos.error } : {}), ...(datos.directo ? { directo: true } : {}), detalle: String(datos.detalle ?? datos.error ?? t) } }
    return { status: 200, cuerpo: { ok: true, accion: nombre, plataforma_status: r.status, resultado: datos } }
  } catch (e) {
    return { status: 502, cuerpo: { ok: false, error: "plataforma_sin_respuesta", detalle: e instanceof Error ? e.message : String(e) } }
  }
}
