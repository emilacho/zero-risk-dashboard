"use client"

import { useRouter } from "next/navigation"

/** Fila de tabla que se toca entera (el enlace del nombre sigue ahí para teclado y clic derecho). */
export function FilaClicable({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter()
  return (
    <tr
      onClick={(e) => { if (!(e.target as HTMLElement).closest("a")) router.push(href) }}
      className="cursor-pointer border-t border-white/5 hover:bg-white/[0.03]"
    >
      {children}
    </tr>
  )
}
