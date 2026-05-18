"use client"
/**
 * TemplateEditorial · Sprint #8 D6 · typography-first long-form variant.
 *
 * Aesthetic · display-typography hero (no full-bleed CTA · let the words
 * lead) · anchored TOC · long-form prose blocks with section dividers ·
 * pull quote with ParallaxBackground accent · author bio + closing soft CTA.
 * Built for content-heavy pages (manifesto · founder note · long product
 * announcement · case study writeup).
 *
 * Motion canon · RevealOnScroll fades each section as it enters · the pull
 * quote uses ParallaxBackground for subtle depth · StaggerList for the TOC
 * + author social links.
 *
 * Lumen v3 · uses --font-display for hero + section titles · regular sans
 * for body · marker font for the byline accent. Phosphor SSR icons only.
 */
import Link from "next/link"
import Image from "next/image"
import { Quotes, ArrowRight, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr"
import { RevealOnScroll } from "@/components/motion/RevealOnScroll"
import { ParallaxBackground } from "@/components/motion/ParallaxBackground"
import { StaggerList } from "@/components/StaggerList"

export interface EditorialSection {
  id: string
  /** Section title · also used as anchor in the TOC */
  title: string
  /** Body content · supports basic markdown via render hint · here plain text */
  body: string
}

export interface EditorialAuthor {
  name: string
  role: string
  /** Avatar URL · optional · falls back to initials */
  avatarUrl?: string
  /** Social links · max 3 · keep it focused */
  links?: Array<{ label: string; href: string; external?: boolean }>
}

export interface TemplateEditorialProps {
  /** Eyebrow chip · usually category or publication date · default "Notes" */
  eyebrow?: string
  /** Display headline · long form OK · supports up to 2 lines */
  headline: string
  /** Subheadline / dek · 1-2 sentences · serif feel via tracking */
  dek: string
  /** Reading time · e.g. "12 min read" */
  readingTime: string
  /** Publication date · formatted string */
  publishedDate: string
  /** Sections in order · TOC builds from these */
  sections: EditorialSection[]
  /** Pull quote · the standout sentence · ParallaxBackground accent */
  pullQuote: { text: string; attribution?: string }
  /** Author block · rendered at the bottom */
  author: EditorialAuthor
  /** Closing soft CTA · e.g. "Read more from <author>" */
  closingCta?: { label: string; href: string }
}

export function TemplateEditorial({
  eyebrow = "Notes",
  headline,
  dek,
  readingTime,
  publishedDate,
  sections,
  pullQuote,
  author,
  closingCta,
}: TemplateEditorialProps) {
  return (
    <main className="relative">
      {/* ─── HERO · display headline · no CTA · let the words lead ──── */}
      <section className="px-6 pt-24 pb-12 sm:pt-32">
        <div className="mx-auto max-w-3xl flex flex-col gap-6">
          <RevealOnScroll variant="fade">
            <div className="flex flex-wrap items-center gap-3">
              <span className="eyebrow-chip">{eyebrow}</span>
              <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                {publishedDate} · {readingTime}
              </span>
            </div>
          </RevealOnScroll>
          <RevealOnScroll>
            <h1 className="font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
              {headline}
            </h1>
          </RevealOnScroll>
          <RevealOnScroll>
            <p className="font-display text-xl leading-relaxed text-[hsl(var(--muted-foreground))] sm:text-2xl">
              {dek}
            </p>
          </RevealOnScroll>
        </div>
      </section>

      {/* ─── TOC · anchor list · stagger fade-in ─────────────────────── */}
      <section className="px-6 pb-12">
        <div className="mx-auto max-w-3xl">
          <RevealOnScroll>
            <p className="num mb-3 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
              Tabla de contenidos
            </p>
          </RevealOnScroll>
          <StaggerList className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {sections.map((s, i) => (
              <Link
                key={s.id}
                href={`#${s.id}`}
                className="group flex items-baseline gap-3 rounded px-2 py-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--primary-glow)/0.06)] hover:text-foreground"
              >
                <span className="num text-[10px] text-[hsl(var(--accent))]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="truncate">{s.title}</span>
              </Link>
            ))}
          </StaggerList>
        </div>
      </section>

      {/* ─── PROSE SECTIONS · each fades in on scroll ──────────────── */}
      <article className="px-6 pb-16">
        <div className="mx-auto max-w-3xl flex flex-col gap-14">
          {sections.map((s, i) => (
            <RevealOnScroll key={s.id}>
              <section id={s.id} className="scroll-mt-24">
                <p className="num mb-3 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--accent))]">
                  §{String(i + 1).padStart(2, "0")}
                </p>
                <h2 className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                  {s.title}
                </h2>
                <div className="mt-4 space-y-4 text-base leading-relaxed text-[hsl(var(--muted-foreground))] sm:text-[17px]">
                  {s.body.split(/\n\n/).map((para, p) => (
                    <p key={p}>{para}</p>
                  ))}
                </div>
              </section>
            </RevealOnScroll>
          ))}
        </div>
      </article>

      {/* ─── PULL QUOTE · ParallaxBackground accent ──────────────────── */}
      <section className="relative px-6 py-24 isolate">
        <ParallaxBackground
          speed={0.25}
          className="absolute inset-0 -z-10"
        >
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 60vw 50vh at 50% 50%, hsl(var(--accent) / 0.08), transparent 70%)",
              filter: "blur(48px)",
            }}
          />
        </ParallaxBackground>
        <div className="mx-auto max-w-3xl">
          <RevealOnScroll variant="scale">
            <blockquote className="surface-card rim-instr p-10" data-rim="cyan">
              <div className="relative z-[2] flex flex-col gap-5">
                <Quotes
                  className="h-8 w-8 text-[hsl(var(--accent))]"
                  weight="fill"
                  aria-hidden
                />
                <p className="font-display text-2xl font-medium leading-snug tracking-tight sm:text-3xl">
                  {pullQuote.text}
                </p>
                {pullQuote.attribution && (
                  <footer className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                    — {pullQuote.attribution}
                  </footer>
                )}
              </div>
            </blockquote>
          </RevealOnScroll>
        </div>
      </section>

      {/* ─── AUTHOR + CLOSING ────────────────────────────────────────── */}
      <section className="px-6 pb-32 pt-12">
        <div className="mx-auto max-w-3xl">
          <RevealOnScroll>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
              <AuthorAvatar author={author} />
              <div className="flex-1 flex flex-col gap-3">
                <div>
                  <p className="font-display text-base font-semibold">
                    {author.name}
                  </p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    {author.role}
                  </p>
                </div>
                {author.links && author.links.length > 0 && (
                  <ul className="flex flex-wrap gap-3">
                    {author.links.slice(0, 3).map((l) => (
                      <li key={l.href}>
                        <Link
                          href={l.href}
                          target={l.external ? "_blank" : undefined}
                          rel={l.external ? "noreferrer" : undefined}
                          className="num inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--accent))] hover:text-foreground"
                        >
                          {l.label}
                          {l.external && <ArrowSquareOut className="h-3 w-3" />}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {closingCta && (
                  <div className="mt-2">
                    <Link
                      href={closingCta.href}
                      className="num inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-foreground hover:text-[hsl(var(--accent))]"
                    >
                      {closingCta.label}
                      <ArrowRight className="h-3 w-3" weight="bold" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </section>
    </main>
  )
}

function AuthorAvatar({ author }: { author: EditorialAuthor }) {
  const initials = author.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?"
  if (author.avatarUrl) {
    // Sprint #9 warnings cleanup · next/image swap. `unoptimized` keeps
    // arbitrary avatar host support without polluting remotePatterns ·
    // avatar is a tiny 64×64 ring · LCP/CDN cost negligible.
    return (
      <Image
        src={author.avatarUrl}
        alt={author.name}
        width={64}
        height={64}
        unoptimized
        className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-[hsl(var(--border))]"
      />
    )
  }
  return (
    <span
      aria-label={author.name}
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full ring-1 ring-[hsl(var(--border))]"
      style={{ background: "hsl(var(--muted))" }}
    >
      <span className="font-mono text-base font-semibold text-[hsl(var(--accent))]">
        {initials}
      </span>
    </span>
  )
}
