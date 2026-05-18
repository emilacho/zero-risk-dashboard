import type { Metadata } from "next"
import { TemplateEditorial } from "@/components/templates/landing"

export const metadata: Metadata = {
  title: "Editorial Template",
  description: "D6 landing variant · typography-first long-form · D5 motion canon",
}

export default function EditorialDemoPage() {
  return (
    <TemplateEditorial
      eyebrow="Manifiesto"
      headline="La agencia del 2026 ya no contrata · ensambla"
      dek="Una nota corta sobre por qué los equipos creativos están migrando hacia modelos agénticos · y qué cambia en la economía operativa cuando 39 agentes hacen lo que antes hacían 12 personas."
      readingTime="8 min read"
      publishedDate="18 May 2026"
      sections={[
        {
          id: "intro",
          title: "El cambio que ya está acá",
          body: "La agencia tradicional opera en un modelo lineal · brief, ideación, ejecución, QA, publicación, optimización. Cada paso un humano. Cada humano un cuello de botella. Cada cuello de botella un margen perdido.\n\nEl modelo agéntico colapsa estos pasos · no eliminándolos sino paralelizándolos. 7 agentes corren al mismo tiempo · brief-strategist + market-research + creative-director + media-buyer + carousel-designer + video-editor + QA. La latencia de campaña baja de semanas a horas.",
        },
        {
          id: "economics",
          title: "La economía operativa colapsa",
          body: "Un equipo de agencia de 12 personas en LATAM cuesta entre $25K y $40K USD/mes en payroll + tools. Los mismos 12 roles cubiertos por 39 agentes corriendo en Anthropic Managed Agents + n8n + Vercel · costo marginal por cliente $300-$800/mes.\n\nLa diferencia no se queda en el bolsillo de la agencia · se redistribuye en velocidad de iteración y volumen de creativos. El cliente recibe 50 variantes de copy en 24h · no 3 en una semana.",
        },
        {
          id: "wedge",
          title: "El wedge LATAM · español + multi-cliente",
          body: "Las plataformas-AI globales (Pixis · Ryze · Advolve) optimizan para enterprise USA. El gap LATAM lo cubre el solo-operator-agent-fleet model · español nativo · pricing accesible · multi-tenant agency platform.\n\nZero Risk apunta exactamente a este wedge. Cliente piloto Náufrago corriendo Sprint #6+. Brazo 3 Meta Ads + pgvector recommender + Phosphor weight canon + D5 motion · todo construido en 14 días de sprint.",
        },
        {
          id: "ahead",
          title: "Qué viene · Sprint #9-#11",
          body: "El stack agéntico converge sobre 6 primitivos · canonical agents (Anthropic Managed) · cascade orchestration (n8n) · semantic memory (pgvector) · HITL gates (Mission Control) · brand-voice persistence (Client Brain) · cross-cliente learning (embedding flywheel).\n\nLas siguientes 4 semanas son scaling · más agentes · más brazos · más clientes piloto. El framework está · ahora se itera.",
        },
      ]}
      pullQuote={{
        text: "La latencia de campaña bajó de semanas a horas. La diferencia se redistribuye en velocidad de iteración, no en margen guardado.",
        attribution: "Notas operativas · Sprint #8",
      }}
      author={{
        name: "Emilio Pérez",
        role: "Founder · Zero Risk Agency",
        links: [
          { label: "linkedin", href: "https://linkedin.com/in/emilio-perez", external: true },
          { label: "github", href: "https://github.com/emilacho", external: true },
        ],
      }}
      closingCta={{ label: "Leer más notas", href: "/templates/bold-hero" }}
    />
  )
}
