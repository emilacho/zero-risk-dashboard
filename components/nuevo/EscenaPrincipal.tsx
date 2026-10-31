"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { EscenaNuevo } from "@/components/nuevo/EscenaNuevo"
import { TotemEnVivo } from "@/components/nuevo/TotemEnVivo"
import { usarRespaldo } from "@/lib/escena-3d"

// el 3D (three + R3F) se carga solo en el navegador y solo cuando hace falta: el servidor no lo conoce y la foto no lo paga
const Escena3D = dynamic(() => import("@/components/nuevo/Escena3D").then((m) => m.Escena3D), { ssr: false, loading: () => null })

/** ¿hay WebGL de verdad en este navegador? */
export function soportaWebGL(): boolean {
  try {
    const c = document.createElement("canvas")
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"))
  } catch {
    return false
  }
}

/**
 * DASHBOARD NUEVO · SPRINT 4: la escena de inicio. En escritorio con WebGL es la escena 3D real; en teléfonos, sin WebGL o en equipos
 * muy justos (o si el 3D se arrastra) se muestra la foto de siempre (variante-14) con sus zonas, que no se borra.
 */
export function EscenaPrincipal({ alAbrirMarketing, marketingAbierto, pausado }: { alAbrirMarketing: () => void; marketingAbierto: boolean; pausado?: boolean }) {
  const [modo, setModo] = useState<"indeciso" | "3d" | "foto">("indeciso")
  useEffect(() => {
    const n = navigator as Navigator & { deviceMemory?: number }
    setModo(usarRespaldo({ webgl: soportaWebGL(), anchoPantalla: window.innerWidth, nucleos: n.hardwareConcurrency, memoriaGB: n.deviceMemory }) ? "foto" : "3d")
  }, [])
  if (modo === "foto") return <EscenaNuevo alAbrirMarketing={alAbrirMarketing}><TotemEnVivo /></EscenaNuevo>
  if (modo === "3d") return <Escena3D alAbrirMarketing={alAbrirMarketing} marketingAbierto={marketingAbierto} pausado={pausado} onLento={() => setModo("foto")} />
  return null
}
