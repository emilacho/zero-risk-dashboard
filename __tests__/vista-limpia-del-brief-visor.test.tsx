/** 18-nov · vista limpia del brief (GO Lenovo 13:08Z · CC5) · condición d14 de CC7 (22:50Z): el VISOR de la bandeja de Piezas se DIBUJA
 *  con el brief real de Náufrago `36e66179` v1 y lo que ve Emilio no trae ninguna marca del sistema. Prueba de conducta, no de texto del archivo. */
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import { renderToString } from "react-dom/server"
import { detalleDelConcepto, TIPO_CONCEPTO } from "@/lib/concepto-datos"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }))

const REAL = fs.readFileSync(path.join(process.cwd(), "__tests__/fixtures/brief-real-36e66179-v1.md"), "utf8").replace(/\r\n/g, "\n")
const CAMP = "36e66179-0000-4000-8000-000000000000"
const hitl = {
  id: "6f1c2a7e-0b1d-4c3e-9a8f-1234567890ab", client_id: "0a2ffbd4-957c-4315-a37f-b9e4fbbbb312", agent_name: "cadena · concepto", risk_type: "strategic_decision", type: TIPO_CONCEPTO,
  status: "pending", priority: "high", payload: {}, decision: null, title: "Gran idea · campaña Náufrago", output_preview: "", created_at: "2026-11-18T21:00:00.000Z", expires_at: null,
  metadata: { origen: "cadena", tipo: "concepto", campana_id: CAMP, version: 1, brief_version: 1, seco: true, costo_usd: 0.1, vueltas_restantes: 2, avisos: [], resumen_del_banco: {} },
}
const concepto = {
  campana_id: CAMP, version: 1, estado: "lista", aprobacion: "pendiente", costo_usd: "0.1000", nota_de_emilio: null, apunta_a: null, decidido_en: null, seco: true,
  leido: { contrato: "concepto.v1", gran_idea: { nombre: "La mesa", frase: "Hay mesa" }, capitulos: [], banco: [], ideas_descartadas: [], ideas_que_salen: [], citas: "", fotos_citadas: [], banco_parcial: [], avisos: [], bloqueos: [], estado: "ok" },
}
const brief = { version: 1, estado: "validada", texto_md: REAL }
/** solo el texto que se ve, sin etiquetas */
const loQueSeVe = (html: string) => html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")

describe("vista limpia del brief · el visor de Piezas DIBUJADO con el brief real", () => {
  it("🔴 Emilio ve el brief sin «Citas», sin «De qué parte del plan sale», sin id, sin marcas de fuente ni códigos de aporte", async () => {
    // el brief real sí las trae: si el dato de prueba cambia, esto lo dice
    for (const m of ["## Citas", "## De qué parte del plan sale", "brf-", "*(fuente", "(A6)"]) expect(REAL).toContain(m)
    const { VisorDeConcepto } = await import("@/app/piezas/VisorDeConcepto")
    const visto = loQueSeVe(renderToString(<VisorDeConcepto concepto={detalleDelConcepto({ hitl, concepto, brief, cliente: "Náufrago" })} />))
    expect(visto).toContain("Brief de campaña (solo lectura)")
    expect(visto).toContain("## Insight")
    for (const m of ["De qué parte del plan sale", "## Citas", "brf-", "*(fuente", "(A6)", "no cita literal"]) expect(visto, m).not.toContain(m)
  })
})
