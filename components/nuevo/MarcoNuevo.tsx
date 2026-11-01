/**
 * DASHBOARD NUEVO · SPRINT 1: el marco de la referencia (Airrived, solo la ESTRUCTURA, con nuestro nombre): barra superior, menú lateral de iconos y barra de chat.
 * Por ahora son SOLO la forma, salvo los lugares que ya tienen una pantalla equivalente (llevan a ella). Lo demás no hace nada hasta que Emilio lo pida en otro sprint.
 * Todo es de servidor (sin JavaScript en el navegador). Va sobre el menú del dashboard actual, que no se toca.
 */
import Link from "next/link"
import type { ReactNode } from "react"
import {
  Bell, BookOpen, Books, CaretDown, CurrencyDollar, Flower, Globe, House, List, MagnifyingGlass, PaperPlaneTilt, Paperclip, Plus, Robot, SignOut, SquaresFour, Sun, Waveform,
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
      <div className="flex shrink-0 items-center gap-3">
      <span role="img" aria-label="Menú" className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-300"><List size={18} /></span>
      {/* la marca como palabra en CONTORNO ámbar (relleno transparente), como la de la referencia */}
      <svg role="img" aria-label="Zero Risk" width="132" height="22" viewBox="0 0 132 22" className="shrink-0"><text x="1" y="16.5" fill="none" stroke={AMBAR} strokeWidth="0.9" fontSize="16" fontWeight="500" letterSpacing="3.4" fontFamily="system-ui, Arial, sans-serif">ZERO RISK</text></svg>
      <span aria-disabled="true" className="ml-1 hidden items-center gap-2 whitespace-nowrap text-[13px] text-zinc-200 sm:flex">Seleccionar cliente <CaretDown size={12} className="text-zinc-400" /></span>
      </div>
      {/* sprint 5: el buscador va en el grupo del medio, en fila (ya no flota en absoluto): nunca se encima con «Seleccionar cliente» */}
      <div className="pointer-events-none mx-auto hidden w-[min(34vw,420px)] md:block">
        <div aria-disabled="true" className={`flex h-9 items-center gap-2 rounded-lg border ${BORDE} bg-white/[0.04] px-3 text-[13px] text-zinc-400`}>
          <MagnifyingGlass size={15} /> <span className="flex-1">Buscar</span>
          <kbd className="rounded border border-white/15 bg-white/[0.06] px-1.5 text-[11px] text-zinc-300">/</kbd>
        </div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <IconoSuperior etiqueta="Nuevo"><Plus size={17} /></IconoSuperior>
        <IconoSuperior etiqueta="Alertas" href="/alertas"><Bell size={17} /></IconoSuperior>
        <IconoSuperior etiqueta="Gasto" href="/gasto"><CurrencyDollar size={17} /></IconoSuperior>
        <IconoSuperior etiqueta="Salir"><SignOut size={17} /></IconoSuperior>
        <IconoSuperior etiqueta="Claro u oscuro"><Sun size={17} /></IconoSuperior>
      </div>
    </header>
  )
}

/** dos cuadros conectados (el icono de flujo de la referencia; Phosphor no trae uno igual) */
function IconoFlujo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /><path d="M7 11v4a2 2 0 0 0 2 2h4" />
    </svg>
  )
}

/** los 8 lugares del menú de la referencia, en su orden; con enlace solo donde ya hay una pantalla equivalente */
export const MENU: Array<{ etiqueta: string; href?: string; icono: ReactNode }> = [
  { etiqueta: "Inicio", href: "/nuevo", icono: <House size={18} weight="fill" /> },
  { etiqueta: "Oficinas", href: "/oficinas", icono: <SquaresFour size={18} /> },
  { etiqueta: "Guías", icono: <BookOpen size={18} /> },
  { etiqueta: "Aplicaciones", icono: <Flower size={18} /> },
  { etiqueta: "Piezas", href: "/piezas", icono: <Books size={18} /> },
  { etiqueta: "Empleados", href: "/mapa", icono: <Robot size={18} /> },
  { etiqueta: "Flujos", icono: <IconoFlujo /> },
  { etiqueta: "Actividad", icono: <Waveform size={18} /> },
]

export function MenuLateral({ actual = "/nuevo" }: { actual?: string }) {
  return (
    <nav aria-label="Menú" className="absolute left-3 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-1 rounded-2xl bg-[#232325] p-1.5 sm:left-3">
      {MENU.map((m) => {
        const activo = m.href === actual
        const clase = "flex h-9 w-9 items-center justify-center rounded-lg"
        return m.href ? (
          <Link key={m.etiqueta} href={m.href} aria-label={m.etiqueta} title={m.etiqueta} aria-current={activo ? "page" : undefined}
            className={`${clase} transition-colors hover:bg-white/[0.07] ${activo ? "bg-white/[0.08]" : "text-zinc-300 hover:text-white"}`} style={activo ? { color: AMBAR } : undefined}>{m.icono}</Link>
        ) : (
          <span key={m.etiqueta} role="img" aria-label={m.etiqueta} className={`${clase} text-zinc-300`}>{m.icono}</span>
        )
      })}
    </nav>
  )
}

/** la caja de chat de abajo: SOLO la forma (no envía nada; qué hace se decide en otro sprint) */
export function BarraDeChat() {
  return (
    <div data-chat-de-oficinas aria-label="Chat con tus oficinas (todavía sin función)" aria-disabled="true"
      className="absolute bottom-6 left-1/2 z-10 w-[min(610px,calc(100vw-7rem))] -translate-x-1/2 rounded-xl border p-[7px]" style={{ borderColor: "rgba(232,115,26,.55)" }}>
      <div className="rounded-lg bg-[#1b1b1d] px-4 py-3.5">
        <p className="text-[14px] text-zinc-400">Habla con tus oficinas…</p>
        <div className="mt-4 flex items-center gap-3 text-zinc-300">
          <Paperclip size={17} /> <Globe size={17} />
          <span className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg text-white" style={{ backgroundColor: AMBAR }}><PaperPlaneTilt size={18} weight="regular" /></span>
        </div>
      </div>
    </div>
  )
}
