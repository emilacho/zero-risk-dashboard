import type { Metadata } from "next"
import { TemplateBoldHero } from "@/components/templates/landing"

export const metadata: Metadata = {
  title: "Bold Hero Template",
  description: "D6 landing variant · full-bleed CTA + feature grid · D5 motion canon",
}

export default function BoldHeroDemoPage() {
  return (
    <TemplateBoldHero
      eyebrow="Live · drop 24h"
      headline="Lanzá tu agencia agéntica antes que la competencia"
      subheadline="Zero Risk pone los 39 agentes y el pipeline de campañas en producción · primer cliente onboarded en 7 días · sin contratar."
      ctas={[
        { label: "Reservar demo", href: "/templates/product" },
        { label: "Ver editorial", href: "/templates/editorial", variant: "ghost" },
      ]}
      features={[
        {
          id: "f1",
          title: "39 agentes pre-entrenados",
          description: "Marketing · paid media · sales · ops · ya identificados, registrados y midiendo en producción.",
          badge: "live",
        },
        {
          id: "f2",
          title: "Cascadas Camino III",
          description: "Triple-review 3-of-N voting · HITL inbox · cero output sin aprobación humana.",
          badge: "qa",
        },
        {
          id: "f3",
          title: "Brazos plug-and-play",
          description: "Meta Ads · Apify · Meshy 3D · GPT-Image · ElevenLabs · GHL email · wire-up por sprint.",
          badge: "brazos",
        },
        {
          id: "f4",
          title: "Memoria persistente",
          description: "Client Brain con pgvector · Brand voice + ICP + competitive landscape · auto-embedded.",
          badge: "rag",
        },
        {
          id: "f5",
          title: "Mission Control",
          description: "Dashboard local-first · costo + HITL + agent_outcomes daily rollup · 30s glance pass.",
          badge: "mc",
        },
        {
          id: "f6",
          title: "Cross-cliente learning",
          description: "Embeddings cross-cliente recomiendan creativos high-performance · data flywheel automático.",
          badge: "flywheel",
        },
      ]}
      sectionTwoEyebrow="Por qué ahora"
      sectionTwoTitle="Meta Q1 2026 · $55B advertising · 33% YoY · clientes quieren AI yesterday"
      sectionTwoBody="El mercado se consolidó en 3 modelos · AI-platform SaaS · solo-operator agent fleet · traditional + AI overlay. Zero Risk corre el cuadrante de agencia agéntica multi-tenant para LATAM · primer wedge sin competencia local seria."
      closingTitle="Empezá con un cliente piloto · primera campaña corriendo en 14 días"
      closingCta={{ label: "Agendar onboarding", href: "/templates/product" }}
    />
  )
}
