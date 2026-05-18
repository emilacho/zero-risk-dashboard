"use client"
import { TemplateProduct } from "@/components/templates/landing"
import type { ProductLead } from "@/components/templates/landing"

/**
 * Product template demo · Sprint #8 D6.
 *
 * This is a CLIENT component because TemplateProduct's form needs an
 * onSubmit handler (function · can't cross server→client). Server-rendered
 * landing pages should wrap TemplateProduct in a client island that exports
 * its own handler · or use a server-action via "use server" function passed
 * as a `formAction`.
 *
 * Metadata is set via a generateMetadata sibling export if/when needed ·
 * client pages can still set `<title>` via document API but Next prefers
 * the server-side metadata pattern.
 */
export default function ProductDemoPage() {
  const handleSubmit = async (lead: ProductLead) => {
    // Stub · in real wire-up POST to GHL / Supabase / inbox.
    console.log("[D6 product demo] lead captured:", lead)
    // Simulate latency for the spinner state visibility.
    await new Promise((r) => setTimeout(r, 600))
  }

  return (
    <TemplateProduct
      eyebrow="Beta · 14 day trial"
      headline="Mission Control · operá 100 campañas desde una pantalla"
      subheadline="Dashboard unificado para agencias agénticas · clientes + agentes + workflows + cost rollup · todo en un solo glance."
      bullets={[
        { id: "b1", text: "59 agents registry · status live · sessions 30d · cost rollup" },
        { id: "b2", text: "HITL inbox · 4-source aggregator · cowork + Slack + Sentry + MC" },
        { id: "b3", text: "DataTable primitive · TanStack v8 · sort + filter + paginate + resize" },
        { id: "b4", text: "Combobox · cliente / agent / workflow picker · 100ms fuzzy search" },
        { id: "b5", text: "Phosphor 6-weight iconography · MIT free · Lumen v3 aesthetic" },
        { id: "b6", text: "Motion canon · 0 GSAP · IntersectionObserver scroll utils · reduced-motion safe" },
      ]}
      onSubmit={handleSubmit}
      ctaLabel="Reservar demo · 14 días"
      productMockLabel="Mission Control · screenshot real Sprint #9"
      testimonialsEyebrow="Lo que dicen los operadores"
      testimonials={[
        {
          id: "t1",
          quote:
            "Pasamos de 3 variantes por brief a 50 en 24 horas. El ROI del primer mes pagó el sprint completo.",
          author: "Founder · agencia digital LATAM",
          role: "12 clientes · $180K MRR",
        },
        {
          id: "t2",
          quote:
            "El HITL inbox cambió la ergonomía. Antes revisaba 6 herramientas · ahora una sola pantalla con todo.",
          author: "Head of Ops · agencia paid media",
          role: "8 clientes · $90K MRR",
        },
        {
          id: "t3",
          quote:
            "El stack open-source más serio que vi para agencia agéntica. 39 agentes + cascade-runner + Mission Control · todo wire-able.",
          author: "CTO · martech consultancy",
          role: "Evaluación independiente · 2026 Q2",
        },
      ]}
      closingTitle="Mission Control · pipeline + agents + clients · todo en un dashboard"
      closingCta={{ label: "Reservar demo", href: "#" }}
    />
  )
}
