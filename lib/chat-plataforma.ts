/**
 * 02-nov · CHAT de /nuevo · ADENDA 2/3 · lo que el chat lee de la plataforma: los MISMOS módulos de lectura que usan las pantallas de /nuevo, con la misma sesión de administrador.
 * Solo lectura. Un error se dice (lanza); nunca se lee como «no hay nada».
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { clientesParaElegir, listarClientes } from "@/lib/clientes-datos"
import { leerDecisiones } from "@/lib/direccion-decisiones"
import { leerCorridas } from "@/lib/direccion-corridas"
import { leerRiesgos } from "@/lib/direccion-riesgos"
import { resumenDeDinero } from "@/lib/direccion-dinero"
import { leerInformesDelCliente } from "@/lib/informes-datos"
import { listarPiezas } from "@/lib/piezas-datos"
import { leerPlanDelCliente } from "@/lib/plan-datos"
import type { LectoresDeLaPlataforma, Tema } from "@/lib/chat-herramientas"

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

/** nombre (o parte del nombre) → id del cliente; sin coincidencia clara no se adivina: se dice */
export async function idDelCliente(supa: Pick<SupabaseClient, "from">, nombre: string | null): Promise<string | null> {
  if (!nombre) return null
  const lista = await clientesParaElegir(supa as SupabaseClient)
  const n = sinTildes(nombre)
  const exacto = lista.filter((c) => sinTildes(c.nombre) === n)
  if (exacto.length === 1) return exacto[0].id
  const parcial = lista.filter((c) => sinTildes(c.nombre).includes(n) || n.includes(sinTildes(c.nombre)))
  if (parcial.length === 1) return parcial[0].id
  throw new Error(parcial.length === 0 ? `no hay un cliente que se llame «${nombre}»` : `«${nombre}» coincide con varios clientes: ${parcial.map((c) => c.nombre).join(", ")}`)
}

export function lectoresDeLaPlataforma(supa: SupabaseClient): LectoresDeLaPlataforma {
  return {
    async leer(tema: Tema, cliente: string | null): Promise<unknown> {
      switch (tema) {
        case "plan":
          return await leerPlanDelCliente(supa, { cliente: await idDelCliente(supa, cliente) })
        case "informes":
          return await leerInformesDelCliente(supa, { cliente: await idDelCliente(supa, cliente) })
        case "clientes":
          return await listarClientes(supa)
        case "piezas":
          return await listarPiezas(supa, { estado: "pendiente", limite: 20, tipo: "todas" })
        case "decisiones": {
          const r = await leerDecisiones()
          if (!r.ok) throw new Error(`decisiones: ${r.error} (${r.status})`)
          return r.datos
        }
        case "riesgos": {
          const r = await leerRiesgos()
          if (!r.ok) throw new Error(`riesgos: ${r.error} (${r.status})`)
          return r.datos
        }
        case "dinero": {
          const r = await leerRiesgos()
          if (!r.ok) throw new Error(`dinero: ${r.error} (${r.status})`)
          return resumenDeDinero(r.datos)
        }
        case "corridas": {
          const r = await leerCorridas({ dias: 3 })
          return r
        }
      }
    },
  }
}
