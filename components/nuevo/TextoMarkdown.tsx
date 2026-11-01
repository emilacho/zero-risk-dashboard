"use client"

/**
 * El texto de una respuesta del chat de /nuevo, con su markdown ya aplicado (negritas, listas, enlaces, código, tablas simples).
 * Solo texto blanco sobre el fondo negro: sin ventana, borde, fondo ni globo (encargo de Emilio). El HTML crudo no se interpreta (react-markdown no lo ejecuta)
 * y solo se abren enlaces http(s).
 */
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

const seguro = (href?: string) => (href && /^https?:\/\//i.test(href) ? href : undefined)

const componentes: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-0.5 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  h1: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
  h2: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
  h3: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
  h4: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
  a: ({ href, children }) => {
    const h = seguro(href)
    return h ? <a href={h} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{children}</a> : <span>{children}</span>
  },
  code: ({ children }) => <code className="font-mono text-[13px] text-white/90">{children}</code>,
  pre: ({ children }) => <pre className="mb-2 overflow-x-auto whitespace-pre-wrap font-mono text-[13px] text-white/90">{children}</pre>,
  blockquote: ({ children }) => <div className="mb-2 pl-3 text-white/80">{children}</div>,
  hr: () => <div className="my-2" />,
  // una imagen del texto NUNCA se carga (el navegador pediría una dirección ajena: rastreo / sacar datos por la dirección): solo se muestra su texto alternativo
  img: ({ alt }) => (alt ? <span>{alt}</span> : null),
  table: ({ children }) => <div className="mb-2 overflow-x-auto"><table className="text-left text-[13px]">{children}</table></div>,
  th: ({ children }) => <th className="pr-4 pb-1 font-semibold">{children}</th>,
  td: ({ children }) => <td className="pr-4 py-0.5 align-top">{children}</td>,
}

export function TextoMarkdown({ texto }: { texto: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={componentes}>{texto}</ReactMarkdown>
}
