"use client"

import { trozosSinCodigos, type ContextoSinCodigos } from "@/lib/sin-codigos"
import { miniaturaDe } from "@/lib/visor-de-fotos"

/**
 * UN TEXTO COMO LO LEE EMILIO (GO Lenovo 10-nov): sin códigos del sistema y, donde se citaba `foto:<id>`, la miniatura de esa foto (o nada si no se conoce).
 * Solo presentación: lo guardado no se toca. `fotos` = código de 8 → dirección.
 */
export function TextoSinCodigos({ texto, fotos = {}, contexto = {}, className }: { texto: string | null | undefined; fotos?: Record<string, string>; contexto?: ContextoSinCodigos; className?: string }) {
  const trozos = trozosSinCodigos(texto, { fotos: Object.keys(fotos), ...contexto })
  return (
    <p data-sin-codigos className={className}>
      {trozos.map((t, i) => {
        if ("texto" in t) return <span key={i}>{t.texto}</span>
        const conDireccion = t.fotos.map((c) => fotos[c.toLowerCase().slice(0, 8)]).filter((u): u is string => !!u)
        if (!conDireccion.length) return null
        return (
          <span key={i} data-fotos-citadas className="mx-1 inline-flex gap-1 align-middle">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {conDireccion.map((u) => <img key={u} data-miniatura src={miniaturaDe(u, 120)} alt="foto propia del cliente" loading="lazy" className="h-9 w-9 rounded-control border border-linea object-cover" />)}
          </span>
        )
      })}
    </p>
  )
}
