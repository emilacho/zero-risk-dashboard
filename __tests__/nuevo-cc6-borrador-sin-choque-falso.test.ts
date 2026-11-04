/** EL BORRADOR NO CHOCA CONSIGO MISMO (CC6 · 04-nov · corrección urgente de Lenovo 08:50Z: Emilio, solo y en un equipo, veía «Tu borrador cambió en otro equipo»). US$ 0 · sin red. */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { unoALaVez } from "@/lib/borrador-del-dueno"

/** una plataforma de mentira con la MISMA regla que la real (CC1 #872): guardar sobre una revisión que no es la vigente → 409 con la vigente */
function plataforma(lento = 30) {
  const s = { revision: 6, texto: "", choques: 0 }
  const guardar = async (texto: string, base: number) => {
    await new Promise((r) => setTimeout(r, lento))
    if (base !== s.revision) { s.choques++; return { ok: false as const, revision: s.revision, texto: s.texto } }
    s.revision++; s.texto = texto
    return { ok: true as const, revision: s.revision, texto }
  }
  return { s, guardar }
}

describe("Emilio escribe rápido en un solo equipo", () => {
  it("CONTROL · sin fila, dos guardados seguidos salen con la misma revisión y el segundo choca (lo que pasó en producción)", async () => {
    const { s, guardar } = plataforma()
    let pantalla = "", revision = 6
    const guardarAhora = async () => { const r = await guardar(pantalla, revision); if (r.ok) revision = r.revision; return r.ok }
    pantalla = "Lo"; const a = guardarAhora()
    pantalla = "Lo que"; const b = guardarAhora() // la segunda pausa llega antes de que vuelva la primera
    await Promise.all([a, b])
    expect(s.choques).toBe(1)
  })
  it("con un guardado a la vez: cero choques y queda lo ÚLTIMO que escribió", async () => {
    const { s, guardar } = plataforma()
    let pantalla = "", revision = 6
    const guardarYa = unoALaVez(async () => { const r = await guardar(pantalla, revision); if (r.ok) revision = r.revision; return r.ok })
    const vueltas: Array<Promise<boolean>> = []
    for (const t of ["L", "Lo", "Lo q", "Lo que", "Lo que quiero", "Lo que quiero cambiar"]) { pantalla = t; vueltas.push(guardarYa()) }
    expect((await Promise.all(vueltas)).every(Boolean)).toBe(true)
    expect(s.choques).toBe(0); expect(s.texto).toBe("Lo que quiero cambiar")
    expect(s.revision).toBeLessThanOrEqual(8) // los pedidos en espera se juntan en uno: no un guardado por tecla
  })
  it("si un guardado falla, el siguiente igual corre (la fila no se traba)", async () => {
    let n = 0
    const guardarYa = unoALaVez(async () => { n++; if (n === 1) throw new Error("caída"); return true })
    await expect(guardarYa()).rejects.toThrow("caída")
    expect(await guardarYa()).toBe(true)
  })
})

describe("el panel del manual", () => {
  const f = readFileSync("components/nuevo/PanelManual.tsx", "utf8")
  it("guarda de a uno, con la revisión al instante (no la del render anterior)", () => {
    expect(f).toContain("const guardarYa = useRef<() => Promise<boolean>>(unoALaVez(() => guardarAhora.current()))")
    expect(f).toContain("let g = await apiBorrador.guardar(cliente, \"manual\", manualId, lo, revisionVigente.current ?? 0)")
    expect(f).not.toContain("guardadoDelBorrador?.revision ?? 0")
  })
  it("un choque REAL con otro equipo no pisa lo que se escribe aquí: gana esta pestaña y lo otro se ofrece para recuperar", () => {
    expect(f).not.toContain("Tu borrador cambió en otro equipo: te muestro lo último que se guardó.")
    expect(f).toContain("g = await apiBorrador.guardar(cliente, \"manual\", manualId, lo, otro.revision ?? 0)")
    expect(f).toContain('data-accion="recuperar-del-otro-equipo"'); expect(f).toContain('data-accion="quedarme-con-lo-mio"')
  })
  it("el aviso «Tienes N cambios sin pedir» se quita si Emilio sigue escribiendo, y un clic que no empieza y termina fuera no lo abre", () => {
    expect(f).toContain("if (fotoAlPedirSalir.current !== fotoDeTus) setSalir(null)")
    expect(f).toContain("onMouseDown={(e) => { abajoAfuera.current = e.target === e.currentTarget }} onMouseUp={(e) => { if (abajoAfuera.current && e.target === e.currentTarget) salirConAviso.current(onCerrar)")
  })
})
