/**
 * «Plan de 90 días» → «Plan de Marketing» en todo texto del tablero que ve Emilio
 * (Lenovo por Emilio, 10-nov 00:30Z · aviso de CC1 en #969). La plataforma ya manda «Plan de Marketing: …»;
 * los nombres de procesos en n8n y los títulos de los planes viejos siguen diciendo «90 días»: los dos se leen igual.
 */
import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { sinPrefijoDelPlan } from "@/lib/plan-barra"
import { procesoDe } from "@/lib/observabilidad"
import { tituloPorElPedido } from "@/lib/escena-sala"
import { NOMBRE_DEL_TIPO, tituloLimpio } from "@/lib/direccion-decisiones"
import { APLICACIONES } from "@/lib/aplicaciones-marketing"
import { PROCESO_DEL_PLAN } from "@/lib/dinero-completo"
import { nombreDelGrupo } from "@/lib/direccion-pedidos"

describe("Plan de Marketing · el nombre que ve Emilio", () => {
  it("el tipo de decisión, el cuadro de aplicaciones y el proceso de dinero se llaman «Plan de Marketing»", () => {
    expect(NOMBRE_DEL_TIPO.plan.nombre).toBe("Plan de Marketing")
    expect(APLICACIONES.find((a) => a.clave === "plan")?.nombre).toBe("Plan de Marketing")
    expect(PROCESO_DEL_PLAN).toBe("Planeación del Plan de Marketing")
  })

  it("el pedido en curso: cambios, planeación y revisión dicen «Plan de Marketing»", () => {
    const base = { revisiones: new Map(), encargos: new Map(), cambioDe: new Set<string>() } as never as Parameters<typeof nombreDelGrupo>[1]
    const id = "11111111-1111-1111-1111-111111111111"
    const conRev = { ...base, revisiones: new Map([[id, { artifact_type: "plan" }]]) } as never as Parameters<typeof nombreDelGrupo>[1]
    expect(nombreDelGrupo(`pedido:${id}`, { ...base, cambioDe: new Set([id]) } as never)).toBe("Cambios al Plan de Marketing · pedido del dueño")
    expect(nombreDelGrupo(`pedido:${id}`, { ...conRev, planeacionDe: new Map([[id, "x"]]) } as never)).toBe("Plan de Marketing · investigación, redacción y revisión")
    expect(nombreDelGrupo(`pedido:${id}`, conRev)).toBe("Revisión del Plan de Marketing")
  })

  it("dentro del plan, el título de un aviso no repite el nombre, venga con el nombre nuevo o con el viejo", () => {
    expect(sinPrefijoDelPlan("Plan de Marketing: revisa estos avisos antes de aprobar")).toBe("revisa estos avisos antes de aprobar")
    expect(sinPrefijoDelPlan("Plan de 90 días: revisa estos avisos antes de aprobar")).toBe("revisa estos avisos antes de aprobar")
    expect(sinPrefijoDelPlan("plan de 90 dias:  sin tilde")).toBe("sin tilde")
    expect(sinPrefijoDelPlan("Un aviso sin prefijo")).toBe("Un aviso sin prefijo")
  })

  it("un proceso o un pedido con el nombre viejo o el nuevo se muestra como «Plan de Marketing»", () => {
    expect(procesoDe({ nombre: "Planeación · Plan de 90 días · Náufrago" })).toBe("Plan de Marketing")
    expect(procesoDe({ nombre: "Planeación · Plan de Marketing · Náufrago" })).toBe("Plan de Marketing")
    expect(tituloPorElPedido(["Escribe el plan de 90 días de Náufrago"])).toBe("Plan de Marketing")
    expect(tituloPorElPedido(["Escribe el plan de marketing de Náufrago"])).toBe("Plan de Marketing")
  })

  it("el título de una decisión no muestra los asteriscos de formato (gran idea v3)", () => {
    expect(tituloLimpio("Gran idea · **El oro que nunca buscaste** · campaña Náufrago")).toBe("Gran idea · El oro que nunca buscaste · campaña Náufrago")
    expect(tituloLimpio("**Plan de Marketing**: revisa estos avisos")).toBe("Plan de Marketing: revisa estos avisos")
  })

  it("ningún texto que se muestra en el tablero dice «Plan de 90 días» (comentarios y patrones de lectura aparte)", () => {
    const archivos: string[] = []
    const recorrer = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) recorrer(p); else if (/\.tsx?$/.test(n)) archivos.push(p) } }
    for (const d of ["lib", "components", "app"]) recorrer(d)
    const malos: string[] = []
    for (const f of archivos) {
      readFileSync(f, "utf8").split(/\r?\n/).forEach((linea, i) => {
        if (/^\s*(?:\/\*|\*|\/\/)/.test(linea)) return // línea de comentario
        const sinComentario = linea.replace(/\/\*.*?\*\//g, "").replace(/\/\/.*$/, "")
        // el nombre escrito tal cual (entre comillas o suelto en la pantalla); un patrón que lee lo viejo lo escribe «d[ií]as» y no cuenta
        if (/plan de 90 d(?:í|i)as/i.test(sinComentario)) malos.push(`${f}:${i + 1}`)
      })
    }
    expect(malos).toEqual([])
  })
})
