"use client"

/**
 * UN TEXTO CON MARKDOWN PINTADO COMO DOCUMENTO (CC6 · 03-nov · Informes): títulos de verdad (tres niveles), viñetas, negritas reales; sin ** a la vista
 * y sin códigos de ficha. El HTML crudo no se interpreta (react-markdown no lo ejecuta) y solo se abren enlaces http(s).
 */
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { textoDelInforme } from "@/lib/informe-legible"

const seguro = (href?: string) => (href && /^https?:\/\//i.test(href) ? href : undefined)
const componentes: Components = {
  h1: ({ children }) => <h3 className="mb-2 mt-4 font-display text-[19px] font-semibold leading-tight text-zinc-50 first:mt-0">{children}</h3>,
  h2: ({ children }) => <h4 className="mb-1.5 mt-4 text-[16.5px] font-semibold leading-snug text-zinc-100 first:mt-0">{children}</h4>,
  h3: ({ children }) => <h5 className="mb-1 mt-3 text-[14.5px] font-medium text-zinc-200 first:mt-0">{children}</h5>,
  h4: ({ children }) => <h5 className="mb-1 mt-3 text-[14.5px] font-medium text-zinc-200 first:mt-0">{children}</h5>,
  p: ({ children }) => <p className="mb-2.5 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-zinc-50">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="mb-2.5 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2.5 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  a: ({ href, children }) => { const h = seguro(href); return h ? <a href={h} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{children}</a> : <span>{children}</span> },
  code: ({ children }) => <span>{children}</span>,
  pre: ({ children }) => <div className="mb-2.5">{children}</div>,
  blockquote: ({ children }) => <div className="mb-2.5 border-l-2 border-white/15 pl-3 text-zinc-300">{children}</div>,
  table: ({ children }) => <div className="mb-2.5 overflow-x-auto"><table className="w-full text-left text-[13.5px]">{children}</table></div>,
  th: ({ children }) => <th className="border-b border-white/15 py-1 pr-3 font-medium text-zinc-300">{children}</th>,
  td: ({ children }) => <td className="border-b border-white/5 py-1 pr-3">{children}</td>,
}

export function DocumentoLegible({ texto, className = "" }: { texto: string; className?: string }) {
  return <div data-documento className={`text-[14.5px] leading-relaxed text-zinc-200 ${className}`}><ReactMarkdown remarkPlugins={[remarkGfm]} components={componentes}>{textoDelInforme(texto)}</ReactMarkdown></div>
}
