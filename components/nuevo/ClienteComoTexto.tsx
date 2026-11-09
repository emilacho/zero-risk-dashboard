"use client"

import { useEffect, useRef, useState } from "react"
import { escucharClienteDeTrabajo, leerClienteDeTrabajo, type ClienteDeTrabajo } from "@/lib/cliente-de-trabajo"

/**
 * 06-nov · SELECTOR ÚNICO (boceto 2, aprobado tal cual): el cliente se elige solo arriba; cada panel lo muestra como texto («Cliente · Náufrago»).
 */

/** el cliente de trabajo, al día: cambia cuando se elige otro arriba (o en otra pestaña) */
export function useClienteDeTrabajo(): ClienteDeTrabajo | null {
  const [c, setC] = useState<ClienteDeTrabajo | null>(null)
  useEffect(() => { setC(leerClienteDeTrabajo()); return escucharClienteDeTrabajo(window, setC) }, [])
  return c
}

/**
 * Un panel abierto se pasa al cliente que se eligió arriba. `actual` es el cliente que muestra; si el elegido es el mismo, no pasa nada.
 * Con «Todos» el aviso trae el último cliente: un panel de un solo cliente sigue con ese.
 */
export function useAlCambiarElCliente(actual: string | null, alCambiar: (id: string) => void): void {
  const a = useRef(actual), f = useRef(alCambiar)
  a.current = actual; f.current = alCambiar
  useEffect(() => escucharClienteDeTrabajo(window, (c) => { const id = c?.id ?? null; if (id && id !== a.current) f.current(id) }), [])
}

/** el texto «Cliente · X» de un panel de un solo cliente; con «Todos» arriba, dice que sigue con el último */
export function ClienteComoTexto({ nombre, todos, className = "" }: { nombre: string | null | undefined; /** para pruebas: si no se da, se lee arriba */ todos?: boolean; className?: string }) {
  const arriba = useClienteDeTrabajo()
  const conTodos = todos ?? arriba?.todos === true
  return (
    <p data-cliente-como-texto className={`text-[11px] uppercase tracking-[0.2em] text-zinc-500 ${className}`}>
      Cliente · <span data-cliente-nombre className="font-medium text-zinc-100">{nombre || "sin elegir"}</span>
      {conTodos && nombre && <span data-sigue-el-ultimo className="ml-2 normal-case tracking-normal text-zinc-500">(«Todos» es solo para Dinero y Observabilidad: aquí sigue el último cliente)</span>}
    </p>
  )
}

/** en los paneles que ya dicen el cliente en su cabecera: solo el aviso de «Todos» (sigue con el último cliente) */
export function NotaDeTodos({ todos }: { todos?: boolean }) {
  const arriba = useClienteDeTrabajo()
  if (!(todos ?? arriba?.todos === true)) return null
  return <span data-sigue-el-ultimo className="text-[11.5px] text-zinc-500">(«Todos» es solo para Dinero y Observabilidad: aquí sigue el último cliente)</span>
}
