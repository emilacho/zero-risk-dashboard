import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { TOPE_DEL_TEXTO_DEL_MANUAL } from "@/lib/manual"
import { leerJerarquia, moverDeNivel, puedeMoverNiveles, textoDeLaJerarquia, usoNombraUnaLetra } from "@/lib/jerarquia-tipografica"
import { jerarquiaTipografica } from "@/lib/manual-secciones"

const leer = (p: string) => readFileSync(p, "utf8")

// La forma real del manual v2 de Náufrago (descrita por CC3 de client_brand_books f43395c5): textos largos «NIVEL n · rótulo — Letra · peso … · uso: …» y reglas sueltas.
const REAL = [
  "NIVEL 1 · NOMBRE DE MARCA / IDENTIDAD — Permanent Marker · peso Regular. · uso: logotipo escrito y el nombre de la marca en grande.",
  "NIVEL 2 · TÍTULOS DE PIEZA — Permanent Marker · peso Regular. · uso: el título principal de cada publicación.",
  "NIVEL 3 · SUBTÍTULOS — Poppins · peso SemiBold. · uso: la frase que acompaña al título.",
  "NIVEL 4 · TEXTO CORRIDO — Poppins · peso Regular. · uso: párrafos y descripciones; nunca menos de 14 px.",
  "NIVEL 5 · ETIQUETAS Y PRECIOS — Poppins · peso Medium. · uso: botones, precios y datos cortos.",
  "Máximo 2 familias tipográficas por pieza.",
  "Contraste: sobre fondo púrpura usa siempre texto blanco.",
  "Tamaños mínimos: 14 px en pantalla y 9 pt en impreso.",
  "Si las letras no cargan, usa una letra de sistema sin serifa y avisa al equipo.",
].join("\n")

describe("CC4 · manual · jerarquía tipográfica por niveles", () => {
  it("lee el formato real: cinco niveles y cuatro reglas, no «25 letras»", () => {
    const j = leerJerarquia(REAL)
    expect(j.legible).toBe(true); expect(j.niveles).toBe(5)
    expect(j.lineas.filter((x) => x.tipo === "regla")).toHaveLength(4)
    const familias = j.lineas.flatMap((x) => (x.tipo === "nivel" ? [x.familia] : []))
    expect(familias).toEqual(["Permanent Marker", "Permanent Marker", "Poppins", "Poppins", "Poppins"])
    expect(familias.join(" ")).not.toMatch(/NIVEL|peso|uso/i)
  })
  it("guardar sin tocar nada devuelve el texto idéntico; mover solo cambia la letra de dos niveles y conserva usos y reglas", () => {
    expect(textoDeLaJerarquia(leerJerarquia(REAL))).toBe(REAL)
    const movida = textoDeLaJerarquia(moverDeNivel(leerJerarquia(REAL), 2, -1)).split("\n")
    const orig = REAL.split("\n")
    expect(movida[1]).toBe("NIVEL 2 · TÍTULOS DE PIEZA — Poppins · peso SemiBold. · uso: el título principal de cada publicación.")
    expect(movida[2]).toBe("NIVEL 3 · SUBTÍTULOS — Permanent Marker · peso Regular. · uso: la frase que acompaña al título.")
    expect([movida[0], ...movida.slice(3)]).toEqual([orig[0], ...orig.slice(3)])
  })
  it("el uso lo define el nivel: la letra viaja y el rótulo y el uso se quedan; en los extremos no pasa nada", () => {
    const j = moverDeNivel(leerJerarquia(REAL), 4, -1)
    const n4 = j.lineas[3]; const n5 = j.lineas[4]
    expect(n4.tipo === "nivel" && n4.rotulo).toBe("TEXTO CORRIDO"); expect(n5.tipo === "nivel" && n5.rotulo).toBe("ETIQUETAS Y PRECIOS")
    expect(moverDeNivel(leerJerarquia(REAL), 0, -1)).toEqual(leerJerarquia(REAL))
  })
  it("también lee la forma corta y una regla con dos puntos no se vuelve nivel", () => {
    const j = leerJerarquia("Títulos: Alfa Slab One\nCuerpo: Lato\nContraste: usa blanco sobre púrpura.")
    expect(j.niveles).toBe(2); expect(j.lineas[2].tipo).toBe("regla")
    expect(jerarquiaTipografica({ jerarquia_tipografica: ["Títulos: Alfa Slab One", "Cuerpo: Lato"] }).map((x) => x.familia)).toEqual(["Alfa Slab One", "Lato"])
  })
  it("el botón no se ofrece si el campo no se entendió (una línea NIVEL rota, sin niveles, uno solo o más de 2.000)", () => {
    expect(puedeMoverNiveles(REAL)).toBe(true)
    expect(puedeMoverNiveles(REAL + "\nNIVEL 6 sin letra")).toBe(false)
    expect(puedeMoverNiveles("Solo reglas sueltas.\nOtra regla.")).toBe(false)
    expect(puedeMoverNiveles("Títulos: Lato")).toBe(false)
    expect(puedeMoverNiveles(null)).toBe(false)
    expect(puedeMoverNiveles(REAL + "\nUna regla. " + "x".repeat(TOPE_DEL_TEXTO_DEL_MANUAL))).toBe(false)
  })
  it("con el texto real de Náufrago (3.614 caracteres) sí se ofrece: el tope es el de la puerta, no 2.000", () => {
    const largo = REAL + "\n" + "Regla larga del manual. ".repeat(130).trim()
    expect(largo.length).toBeGreaterThan(3600); expect(puedeMoverNiveles(largo)).toBe(true)
    expect(textoDeLaJerarquia(leerJerarquia(largo))).toBe(largo)
  })
  it("un uso que nombra una letra no se muestra (al cambiar de nivel hablaría de la letra anterior); los demás sí", () => {
    const letras = ["Permanent Marker", "Poppins", "Caveat"]
    expect(usoNombraUnaLetra("regla del piso visual: «Usar Permanent Marker para la identidad»", letras)).toBe(true)
    expect(usoNombraUnaLetra("el título principal de cada publicación", letras)).toBe(false)
    expect(usoNombraUnaLetra(null, letras)).toBe(false)
    expect(leer("components/nuevo/manual/JerarquiaTipografica.tsx")).toContain("usoNombraUnaLetra(n.uso, letras)")
  })
  it("una sola vez: el lateral ya no la repite y el cuerpo solo la pinta si se entendió", () => {
    const barra = leer("components/nuevo/manual/BarraDelManual.tsx")
    expect(barra).not.toContain('id="jerarquia"'); expect(barra).toContain('data-ir-campo="jerarquia_tipografica"')
    expect(leer("components/nuevo/PanelManual.tsx")).toContain("puedeMoverNiveles(cambios[p.clave] ?? p.para_editar)")
    const cuerpo = leer("components/nuevo/manual/JerarquiaTipografica.tsx")
    expect(cuerpo).not.toContain("manual-campos"); expect(cuerpo).toContain("onCambiar"); expect(cuerpo).toContain('data-accion="subir-nivel"'); expect(cuerpo).toContain('data-accion="bajar-nivel"'); expect(cuerpo).toContain("▲"); expect(cuerpo).toContain("▼")
  })
})

describe("CC4 · manual · recuadros «Revisión del editor»", () => {
  const rev = leer("components/nuevo/manual/RevisionDelEditor.tsx")
  it("el encabezado se entiende solo", () => { expect(rev).toContain("Estas secciones las revisó"); expect(rev).toContain("Editor en Jefe"); expect(rev).toContain("Qué cambió y por qué:") })
  it("una sola paleta (la ámbar del dashboard) en el recuadro, «Pedir cambios» y «Guardar cambios»: nada violeta", () => { expect(rev).not.toMatch(/violet/); expect(rev).toContain("bg-amber-500/70"); for (const f of ["components/nuevo/manual/PedirCambiosAlManual.tsx", "components/nuevo/manual/SeccionesNuevas.tsx", "components/nuevo/PanelManual.tsx"]) expect(leer(f), f).not.toMatch(/violet/); expect(leer("components/nuevo/PanelManual.tsx")).toContain("border-amber-400/70 bg-amber-400/15") /* 03-nov: «Pedir los cambios» vive en el pie del panel */ })
  it("acciones con emoji claro: ✓ aceptar · ✗ rechazar", () => { expect(rev).toContain("✓ ${b.aprobar}"); expect(rev).toContain("✗ ${b.rechazar}") })
})
