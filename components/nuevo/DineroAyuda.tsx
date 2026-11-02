"use client"
/**
 * DINERO · 6.41 · la ayuda «?»: el texto explicativo sale de la pantalla y vive aquí (aparece al pasar el cursor o al enfocar con el teclado).
 */
export function Ayuda({ texto, lado = "derecha" }: { texto: string; lado?: "derecha" | "izquierda" }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button type="button" data-ayuda aria-label={`Ayuda: ${texto}`}
        className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-white/20 text-[11px] leading-none text-zinc-400 hover:border-amber-500/60 hover:text-zinc-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-amber-400">?</button>
      <span role="tooltip" className={`pointer-events-none absolute top-6 z-30 hidden w-[min(300px,70vw)] rounded-lg border border-white/10 bg-[#0f0d0c] px-3 py-2 text-left text-[12px] font-normal normal-case leading-relaxed tracking-normal text-zinc-300 shadow-xl group-hover:block group-focus-within:block ${lado === "derecha" ? "left-0" : "right-0"}`}>{texto}</span>
    </span>
  )
}
