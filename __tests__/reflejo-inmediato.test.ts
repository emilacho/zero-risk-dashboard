import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { estadoTrasDecidir } from "@/lib/reflejo"
import { ESTADOS_DE_LA_BANDEJA } from "@/lib/piezas"

const leer = (p: string) => readFileSync(join(process.cwd(), p), "utf8")

describe("reflejo inmediato tras una acción", () => {
  it("cada decisión deja el estado que la bandeja guarda", () => {
    expect(estadoTrasDecidir("aprobar")).toBe(ESTADOS_DE_LA_BANDEJA.approved)
    expect(estadoTrasDecidir("cambios")).toBe(ESTADOS_DE_LA_BANDEJA.edited)
    expect(estadoTrasDecidir("rechazar")).toBe(ESTADOS_DE_LA_BANDEJA.rejected)
  })
  it("el visor muestra el resultado al instante, apaga los botones y avisa si falló", () => {
    const v = leer("app/piezas/VisorDePieza.tsx")
    expect(v).toContain("estadoTrasDecidir(accion)")
    expect(v).toContain('estadoVisto === "pendiente"')
    expect(v).toContain("ETIQUETA_ESTADO[estadoVisto]")
    expect(v).not.toContain("ETIQUETA_ESTADO[pieza.estado]")
    expect(v).toContain("router.refresh()")
  })
  it("los botones de acción piden la lectura nueva, muestran «Actualizando…» y se refrescan si otra decisión se adelantó", () => {
    const b = leer("components/AccionBoton.tsx")
    expect(b).toContain("useTransition")
    expect(b).toContain("Actualizando…")
    expect(b).toMatch(/409[\s\S]{0,80}empezarLectura/)
  })
})
