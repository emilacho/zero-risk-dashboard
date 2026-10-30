/**
 * DASHBOARD NUEVO · SPRINT 1: el marco de la referencia (Airrived, solo la ESTRUCTURA, con nuestro nombre): barra superior, menú lateral de iconos y barra de chat.
 * Por ahora son SOLO la forma, salvo los lugares que ya tienen una pantalla equivalente (llevan a ella). Lo demás no hace nada hasta que Emilio lo pida en otro sprint.
 * Todo es de servidor (sin JavaScript en el navegador). Va sobre el menú del dashboard actual, que no se toca.
 */
import Link from "next/link"
import type { ReactNode } from "react"
import {
  Bell, BookOpen, Books, CaretDown, CirclesFour, CurrencyDollar, Globe, House, List, MagnifyingGlass, PaperPlaneRight, Paperclip, Phone, Plus, Robot, SignOut, SquaresFour, Sun, Waveform,
} from "@phosphor-icons/react/dist/ssr"

const AMBAR = "#e8731a"
const BORDE = "border-white/10"

/** un icono de la barra superior; con `href` lleva a la pantalla que ya existe, sin él es solo la forma */
function IconoSuperior({ etiqueta, href, children }: { etiqueta: string; href?: string; children: ReactNode }) {
  const clase = "flex h-8 w-8 items-center justify-center rounded-md text-zinc-300"
  return href ? (
    <Link href={href} aria-label={etiqueta} title={etiqueta} className={`${clase} transition-colors hover:bg-white/[0.07] hover:text-white`}>{children}</Link>
  ) : (
    <span role="img" aria-label={etiqueta} className={`${clase} opacity-80`}>{children}</span>
  )
}

export function BarraSuperior() {
  return (
    <header className="absolute inset-x-0 top-0 z-10 flex h-14 items-center gap-3 px-4 sm:px-6">
      <span role="img" aria-label="Menú" className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-300"><List size={18} /></span>
      <span className="font-display text-[15px] font-semibold uppercase tracking-[0.22em]" style={{ color: AMBAR }}>Zero Risk</span>
      <span aria-disabled="true" className="ml-1 hidden items-center gap-2 text-[13px] text-zinc-200 sm:flex">Seleccionar cliente <CaretDown size={12} className="text-zinc-400" /></span>
      <div className="pointer-events-none absolute left-1/2 top-1/2 hidden w-[min(34vw,420px)] -translate-x-1/2 -translate-y-1/2 md:block">
        <div aria-disabled="true" className={`flex h-9 items-center gap-2 rounded-lg border ${BORDE} bg-white/[0.04] px-3 text-[13px] text-zinc-400`}>
          <MagnifyingGlass size={15} /> <span className="flex-1">Buscar</span>
          <kbd className="rounded border border-white/15 bg-white/[0.06] px-1.5 text-[11px] text-zinc-300">/</kbd>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <IconoSuperior etiqueta="Nuevo"><Plus size={17} /></IconoSuperior>
        <IconoSuperior etiqueta="Alertas" href="/alertas"><Bell size={17} /></IconoSuperior>
        <IconoSuperior etiqueta="Gasto" href="/gasto"><CurrencyDollar size={17} /></IconoSuperior>
        <IconoSuperior etiqueta="Salir"><SignOut size={17} /></IconoSuperior>
        <IconoSuperior etiqueta="Claro u oscuro"><Sun size={17} /></IconoSuperior>
      </div>
    </header>
  )
}

/** los 8 lugares del menú de la referencia, en su orden; con enlace solo donde ya hay una pantalla equivalente */
export const MENU: Array<{ etiqueta: string; href?: string; icono: ReactNode }> = [
  { etiqueta: "Inicio", href: "/nuevo", icono: <House size={18} weight="fill" /> },
  { etiqueta: "Oficinas", href: "/oficinas", icono: <SquaresFour size={18} /> },
  { etiqueta: "Guías", icono: <BookOpen size={18} /> },
  { etiqueta: "Aplicaciones", icono: <CirclesFour size={18} /> },
  { etiqueta: "Piezas", href: "/piezas", icono: <Books size={18} /> },
  { etiqueta: "Empleados", href: "/mapa", icono: <Robot size={18} /> },
  { etiqueta: "Llamadas", icono: <Phone size={18} /> },
  { etiqueta: "Actividad", icono: <Waveform size={18} /> },
]

export function MenuLateral({ actual = "/nuevo" }: { actual?: string }) {
  return (
    <nav aria-label="Menú" className={`absolute left-3 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-1 rounded-2xl border ${BORDE} bg-[#18181a]/90 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,.45)] sm:left-5`}>
      {MENU.map((m) => {
        const activo = m.href === actual
        const clase = "flex h-9 w-9 items-center justify-center rounded-lg"
        return m.href ? (
          <Link key={m.etiqueta} href={m.href} aria-label={m.etiqueta} title={m.etiqueta} aria-current={activo ? "page" : undefined}
            className={`${clase} transition-colors hover:bg-white/[0.07] ${activo ? "bg-white/[0.08]" : "text-zinc-400 hover:text-white"}`} style={activo ? { color: AMBAR } : undefined}>{m.icono}</Link>
        ) : (
          <span key={m.etiqueta} role="img" aria-label={m.etiqueta} className={`${clase} text-zinc-500`}>{m.icono}</span>
        )
      })}
    </nav>
  )
}

/** la caja de chat de abajo: SOLO la forma (no envía nada; qué hace se decide en otro sprint) */
export function BarraDeChat() {
  return (
    <div aria-label="Chat con tus oficinas (todavía sin función)" aria-disabled="true"
      className="absolute bottom-6 left-1/2 z-10 w-[min(640px,calc(100vw-7rem))] -translate-x-1/2 rounded-lg border bg-[#141416]/95 px-4 py-3 shadow-[0_10px_40px_rgba(0,0,0,.5)]" style={{ borderColor: "rgba(232,115,26,.75)" }}>
      <p className="text-[13px] text-zinc-400">Habla con tus oficinas…</p>
      <div className="mt-3 flex items-center gap-3 text-zinc-400">
        <Paperclip size={16} /> <Globe size={16} />
        <span className="ml-auto flex h-8 w-9 items-center justify-center rounded-md text-white" style={{ backgroundColor: AMBAR }}><PaperPlaneRight size={16} weight="fill" /></span>
      </div>
    </div>
  )
}
