/**
 * ClientVault · sección "Vault del Cliente" en /clients/[id]/page.tsx
 *
 * Server component · loads all light metadata in one round-trip via
 * `loadClientVault()` · then renders tabbed UI. Tabs are
 * client-side (Radix) · each tab's content is server-rendered (data
 * already in props) · NO function-prop callbacks crossing boundary.
 *
 * 10 tabs · brand · imágenes · videos · 3D · landing · qa · social
 * · cascades · apify · audit.
 */
import { loadClientVault } from "@/lib/vault"
import { VaultTabsShell } from "./VaultTabsShell"
import {
  BrandDocsTab,
  ImagesTab,
  VideosTab,
  ThreeDModelsTab,
  LandingTab,
  QaEvidenceTab,
  SocialPostsTab,
  CascadeOutputsTab,
  ApifyScrapesTab,
  AuditTrailTab,
} from "./vault-tabs"

export async function ClientVault({
  clientId,
  clientSlug,
}: {
  clientId: string
  clientSlug: string
}) {
  const vault = await loadClientVault(clientId, clientSlug).catch((e) => {
    console.error("loadClientVault failed", e)
    return null
  })

  if (!vault) {
    return (
      <section className="surface-card rim-instr p-5" data-rim="rose">
        <div className="relative z-[2]">
          <h2 className="font-display text-base font-semibold tracking-tight">
            Vault del Cliente
          </h2>
          <p className="num mt-2 text-xs text-[hsl(var(--danger))]">
            No se pudo cargar el vault · check service-role envs.
          </p>
        </div>
      </section>
    )
  }

  const tabs = [
    {
      id: "brand",
      label: "Brand",
      count: vault.counts.brandDocs,
      hue: "rose" as const,
      content: <BrandDocsTab data={vault.brand} />,
    },
    {
      id: "images",
      label: "Imágenes",
      count: vault.counts.images,
      hue: "violet" as const,
      content: <ImagesTab data={vault.images} />,
    },
    {
      id: "videos",
      label: "Videos",
      count: vault.counts.videos,
      hue: "orange" as const,
      content: <VideosTab />,
    },
    {
      id: "3d",
      label: "3D",
      count: vault.counts.threeDModels,
      hue: "teal" as const,
      content: <ThreeDModelsTab data={vault.threeDModels} />,
    },
    {
      id: "landing",
      label: "Landing",
      count: vault.counts.landing,
      hue: "cyan" as const,
      content: <LandingTab data={vault.landing} />,
    },
    {
      id: "qa",
      label: "QA",
      count: vault.counts.qaEvidence,
      hue: "emerald" as const,
      content: <QaEvidenceTab data={vault.qaEvidence} />,
    },
    {
      id: "social",
      label: "Social",
      count: vault.counts.socialPosts,
      hue: "purple" as const,
      content: <SocialPostsTab data={vault.socialPosts} />,
    },
    {
      id: "cascade",
      label: "Cascade",
      count: vault.counts.cascades,
      hue: "amber" as const,
      content: <CascadeOutputsTab data={vault.cascades} />,
    },
    {
      id: "apify",
      label: "Apify",
      count: vault.counts.apifyScrapes,
      hue: "lime" as const,
      content: <ApifyScrapesTab />,
    },
    {
      id: "audit",
      label: "Audit",
      count: vault.counts.audit,
      hue: "sky" as const,
      content: <AuditTrailTab data={vault.audit} />,
    },
  ]

  return (
    <section className="surface-card rim-instr p-5" data-rim="violet">
      <div className="relative z-[2]">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p
              className="num text-[10px] uppercase tracking-[0.22em]"
              style={{ color: "hsl(var(--accent))" }}
            >
              Vault del cliente · 10 fuentes
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold tracking-tight">
              Todo lo que el cliente tiene · brand · creativos · 3D · QA · audit
            </h2>
          </div>
          <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
            light metadata · thumbnails lazy · drill-down per item
          </span>
        </div>
        <VaultTabsShell tabs={tabs} />
      </div>
    </section>
  )
}
