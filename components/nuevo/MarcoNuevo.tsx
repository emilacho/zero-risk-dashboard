/**
 * DASHBOARD NUEVO · el marco de la referencia (Airrived, solo la ESTRUCTURA, con nuestro nombre): barra superior, menú lateral de iconos y barra de chat.
 * CC6 · 03-nov (sprint dashboard, Emilio: «cada control hace algo útil o se quita»): nada es decorativo y nada manda al dashboard viejo.
 *  - Buscar y «/» buscan de verdad · la campana abre Riesgos y alarmas · «$» abre Dinero · «Salir» cierra la sesión. Fuera: «+», claro/oscuro y el icono de menú (no hacían nada).
 *  - Lateral: Inicio (la escena) · Aplicaciones · Piezas · Empleados (Organización) · Flujos (Observabilidad) · Actividad (En vivo). Fuera: Guías (sin pantalla) y Oficinas (era lo mismo que Inicio).
 * El marco es de servidor; los botones que abren paneles, Salir y el buscador son piezas chicas de navegador (`BotonesDelMarco`, `Buscador`).
 */
import Link from "next/link"
import type { ReactNode } from "react"
import { ChatDeOficinas } from "@/components/nuevo/ChatDeOficinas"
import { SelectorDeCliente } from "@/components/nuevo/SelectorDeCliente"
import { BotonDePanel, BotonSalir } from "@/components/nuevo/BotonesDelMarco"
import { Buscador } from "@/components/nuevo/Buscador"
import type { PanelDelMarco } from "@/lib/buscador"
import {
  Bell, Books, CurrencyDollar, Flower, House, Robot, SignOut, Waveform,
} from "@phosphor-icons/react/dist/ssr"

const AMBAR = "#e8731a"

const ICONO_SUPERIOR = "flex h-9 w-9 items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#e8731a]"

export function BarraSuperior() {
  return (
    <header className="absolute inset-x-0 top-0 z-10 flex h-14 items-center gap-3 px-4 sm:px-6">
      <div className="flex shrink-0 items-center gap-3">
      {/* la marca como palabra en CONTORNO ámbar (relleno transparente), como la de la referencia */}
      <svg role="img" aria-label="Zero Risk" width="132" height="22" viewBox="0 0 132 22" className="shrink-0"><text x="1" y="16.5" fill="none" stroke={AMBAR} strokeWidth="0.9" fontSize="16" fontWeight="500" letterSpacing="3.4" fontFamily="system-ui, Arial, sans-serif">ZERO RISK</text></svg>
      {/* 6.42 · el selector abre la vista financiera del cliente (a un clic desde cualquier pantalla) */}
      <SelectorDeCliente />
      </div>
      {/* 03-nov · el buscador busca de verdad (clientes, empleados, paneles y piezas); «/» lo abre */}
      <Buscador />
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <BotonDePanel panel="riesgos" etiqueta="Riesgos y alarmas" className={ICONO_SUPERIOR}><Bell size={17} /></BotonDePanel>
        <BotonDePanel panel="dinero" etiqueta="Dinero" className={ICONO_SUPERIOR}><CurrencyDollar size={17} /></BotonDePanel>
        <BotonSalir className={`${ICONO_SUPERIOR} disabled:opacity-50`}><SignOut size={17} /></BotonSalir>
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

/** los lugares del menú lateral: cada uno lleva a algo (03-nov): Inicio es la escena; los demás abren su panel encima de ella */
export const MENU: Array<{ etiqueta: string; href?: string; panel?: PanelDelMarco; icono: ReactNode }> = [
  { etiqueta: "Inicio", href: "/nuevo", icono: <House size={18} weight="fill" /> },
  { etiqueta: "Aplicaciones", panel: "aplicaciones", icono: <Flower size={18} /> },
  { etiqueta: "Piezas", panel: "piezas", icono: <Books size={18} /> },
  { etiqueta: "Empleados", panel: "organizacion", icono: <Robot size={18} /> },
  { etiqueta: "Flujos", panel: "observabilidad", icono: <IconoFlujo /> },
  { etiqueta: "Actividad", panel: "envivo", icono: <Waveform size={18} /> },
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
          <BotonDePanel key={m.etiqueta} panel={m.panel!} etiqueta={m.etiqueta} className={`${clase} text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#e8731a]`}>{m.icono}</BotonDePanel>
        )
      })}
    </nav>
  )
}

/** la caja de chat de abajo: conversa (01-nov); vive en su propio archivo porque necesita JavaScript de navegador y este archivo es todo de servidor */
export function BarraDeChat() {
  return <ChatDeOficinas />
}
