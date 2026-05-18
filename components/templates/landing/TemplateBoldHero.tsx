"use client"
/**
 * TemplateBoldHero · Sprint #8 D6 · full-bleed CTA-first landing variant.
 *
 * Aesthetic · massive gradient headline + 2 CTAs (primary + ghost) above
 * the fold · feature grid below using D5 motion canon · ParallaxBackground
 * accent in the second section · closing CTA band. Built for high-intent
 * conversion pages (campaign drops · product launches · waitlist signups).
 *
 * Motion canon · RevealOnScroll fades the hero copy + CTAs · StaggerList
 * cascades the feature grid · ParallaxBackground drifts the ornament at
 * 0.3x scroll speed. Reduced-motion is respected by all 3 utilities.
 *
 * Lumen v3 tokens · --primary + --accent + --hue-* + surface-card rim-instr.
 * NO Three.js · NO heavy libs · Phosphor SSR icons only.
 *
 * Props · all primitives (server→client safe).
 */
import Link from "next/link"
import { ArrowRight, ArrowSquareOut, Sparkle } from "@phosphor-icons/react/dist/ssr"
import { RevealOnScroll } from "@/components/motion/RevealOnScroll"
import { ParallaxBackground } from "@/components/motion/ParallaxBackground"
import { StaggerList } from "@/components/StaggerList"

export interface BoldHeroFeature {
  id: string
  title: string
  description: string
  /** Optional Phosphor icon name reference rendered as label badge (sm) */
  badge?: string
}

export interface BoldHeroCta {
  label: string
  href: string
  /** primary · ghost · default primary */
  variant?: "primary" | "ghost"
  /** opens new tab · default false */
  external?: boolean
}

export interface TemplateBoldHeroProps {
  /** Eyebrow chip text · default "Live · drop 24h" */
  eyebrow?: string
  /** Hero headline · gradient text · short (≤8 words for impact) */
  headline: string
  /** Subheadline · 1 sentence · supports the headline */
  subheadline: string
  /** 1-2 CTAs · max 2 · first is primary by default */
  ctas: BoldHeroCta[]
  /** 4-6 features for the cascade grid below the fold */
  features: BoldHeroFeature[]
  /** Section 2 (parallax) eyebrow · default "Why now" */
  sectionTwoEyebrow?: string
  /** Section 2 title · usually a value prop or differentiator */
  sectionTwoTitle: string
  /** Section 2 body copy · 2-3 sentences */
  sectionTwoBody: string
  /** Closing CTA band title · short · action-oriented */
  closingTitle: string
  /** Closing CTA · single button */
  closingCta: BoldHeroCta
}

export function TemplateBoldHero({
  eyebrow = "Live · drop 24h",
  headline,
  subheadline,
  ctas,
  features,
  sectionTwoEyebrow = "Why now",
  sectionTwoTitle,
  sectionTwoBody,
  closingTitle,
  closingCta,
}: TemplateBoldHeroProps) {
  return (
    <main className="relative overflow-hidden">
      {/* ─── HERO · full bleed + RevealOnScroll ─────────────────────── */}
      <section className="relative isolate min-h-[88vh] flex items-center px-6 pt-24 pb-16 sm:pt-32">
        <div className="ambient-halo absolute inset-0" aria-hidden />
        <div className="relative z-[2] mx-auto max-w-5xl flex flex-col items-start gap-6">
          <RevealOnScroll variant="fade">
            <span className="eyebrow-chip">
              <Sparkle className="h-3 w-3" weight="fill" />
              {eyebrow}
            </span>
          </RevealOnScroll>
          <RevealOnScroll>
            <h1 className="font-display text-[56px] font-bold leading-[1.02] tracking-tight sm:text-[80px] md:text-[104px]">
              <span className="text-gradient">{headline}</span>
            </h1>
          </RevealOnScroll>
          <RevealOnScroll>
            <p className="max-w-2xl text-base text-[hsl(var(--muted-foreground))] sm:text-lg">
              {subheadline}
            </p>
          </RevealOnScroll>
          <RevealOnScroll variant="fade">
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {ctas.slice(0, 2).map((cta, i) => (
                <CtaButton key={cta.label} cta={cta} primary={i === 0 && cta.variant !== "ghost"} />
              ))}
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ─── FEATURE GRID · StaggerList cascade ─────────────────────── */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <RevealOnScroll>
            <div className="mb-12 flex flex-col gap-3">
              <span className="eyebrow-chip self-start">Capacidades</span>
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Todo lo que necesitás · uno solo
              </h2>
            </div>
          </RevealOnScroll>
          <StaggerList className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <article
                key={f.id}
                className="surface-card rim-instr p-6"
                data-rim="violet"
              >
                <div className="relative z-[2] flex flex-col gap-3">
                  {f.badge && (
                    <span className="num self-start rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--accent))] ring-1 ring-[hsl(var(--accent)/0.4)]">
                      {f.badge}
                    </span>
                  )}
                  <h3 className="font-display text-lg font-semibold leading-tight">
                    {f.title}
                  </h3>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    {f.description}
                  </p>
                </div>
              </article>
            ))}
          </StaggerList>
        </div>
      </section>

      {/* ─── SECTION 2 · ParallaxBackground accent ──────────────────── */}
      <section className="relative px-6 py-32 isolate">
        <ParallaxBackground
          speed={0.3}
          className="absolute inset-0 -z-10"
        >
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 70vw 60vh at 50% 50%, hsl(var(--primary-glow) / 0.12), transparent 70%)",
              filter: "blur(60px)",
            }}
          />
        </ParallaxBackground>
        <div className="mx-auto max-w-3xl flex flex-col gap-5">
          <RevealOnScroll>
            <span className="eyebrow-chip self-start">{sectionTwoEyebrow}</span>
          </RevealOnScroll>
          <RevealOnScroll>
            <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              {sectionTwoTitle}
            </h2>
          </RevealOnScroll>
          <RevealOnScroll>
            <p className="text-base text-[hsl(var(--muted-foreground))] sm:text-lg">
              {sectionTwoBody}
            </p>
          </RevealOnScroll>
        </div>
      </section>

      {/* ─── CLOSING CTA BAND ───────────────────────────────────────── */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <RevealOnScroll variant="scale">
            <div
              className="surface-card rim-instr p-10 sm:p-14"
              data-rim="cyan"
            >
              <div className="relative z-[2] flex flex-col items-start gap-5">
                <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                  {closingTitle}
                </h2>
                <CtaButton cta={closingCta} primary size="lg" />
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </section>
    </main>
  )
}

// ─── CtaButton · shared inline ──────────────────────────────────────────

function CtaButton({
  cta,
  primary,
  size = "md",
}: {
  cta: BoldHeroCta
  primary: boolean
  size?: "md" | "lg"
}) {
  const sizing =
    size === "lg" ? "h-12 px-7 text-sm" : "h-10 px-5 text-[13px]"
  const base = `${sizing} inline-flex items-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]`
  const visual = primary
    ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[0_0_24px_-4px_hsl(var(--primary)/0.6)] hover:bg-[hsl(var(--primary-glow))]"
    : "border border-[hsl(var(--border))] text-foreground hover:border-[hsl(var(--primary-glow)/0.6)]"
  const Icon = cta.external ? ArrowSquareOut : ArrowRight
  return (
    <Link
      href={cta.href}
      target={cta.external ? "_blank" : undefined}
      rel={cta.external ? "noreferrer" : undefined}
      className={`${base} ${visual}`}
    >
      {cta.label}
      <Icon className="h-3.5 w-3.5" weight="bold" />
    </Link>
  )
}
