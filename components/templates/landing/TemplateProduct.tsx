"use client"
/**
 * TemplateProduct · Sprint #8 D6 · split-layout lead-capture variant.
 *
 * Aesthetic · 50/50 desktop (stacked mobile) · left side has headline +
 * bullet features + form (name + email + business) · right side has a
 * product mock surface (gradient placeholder · drop-in for screenshot/img
 * later). Below the fold · testimonial cards in StaggerList + closing CTA.
 *
 * Motion canon · RevealOnScroll fades the headline + form · StaggerList
 * cascades the bullet features and testimonial cards · ParallaxBackground
 * drifts the ornament behind the product mock.
 *
 * Lead capture is client-controlled · caller passes onSubmit. The form
 * does NOT POST anywhere by default · just calls onSubmit({name, email,
 * business}) so the host route can wire to GHL / Supabase / inbox / etc.
 *
 * Phosphor SSR icons only. NO Three.js · the product mock is a gradient
 * surface (real product img is a Sprint #9 wire-up).
 */
import { useState, type FormEvent } from "react"
import { Check, ArrowRight, CircleNotch } from "@phosphor-icons/react/dist/ssr"
import { RevealOnScroll } from "@/components/motion/RevealOnScroll"
import { ParallaxBackground } from "@/components/motion/ParallaxBackground"
import { StaggerList } from "@/components/StaggerList"

export interface ProductBullet {
  id: string
  text: string
}

export interface ProductTestimonial {
  id: string
  quote: string
  author: string
  role: string
}

export interface ProductLead {
  name: string
  email: string
  business: string
}

export interface TemplateProductProps {
  /** Eyebrow chip · default "Demo · 14 day trial" */
  eyebrow?: string
  /** Headline · gradient text · short */
  headline: string
  /** Subhead · 1 sentence value prop */
  subheadline: string
  /** Bullet features · 3-6 items */
  bullets: ProductBullet[]
  /** Form submit handler · receives sanitized lead · caller wires to GHL/etc */
  onSubmit: (lead: ProductLead) => void | Promise<void>
  /** Form submit button label · default "Request demo" */
  ctaLabel?: string
  /** Product mock label · default "Producto · vista previa" */
  productMockLabel?: string
  /** Section 2 (testimonials) eyebrow · default "Loved by operators" */
  testimonialsEyebrow?: string
  /** 2-4 testimonials · cascade on scroll */
  testimonials: ProductTestimonial[]
  /** Closing CTA band title · short */
  closingTitle: string
  /** Closing CTA · single link · usually duplicates the form CTA below the fold */
  closingCta: { label: string; href: string }
}

export function TemplateProduct({
  eyebrow = "Demo · 14 day trial",
  headline,
  subheadline,
  bullets,
  onSubmit,
  ctaLabel = "Request demo",
  productMockLabel = "Producto · vista previa",
  testimonialsEyebrow = "Loved by operators",
  testimonials,
  closingTitle,
  closingCta,
}: TemplateProductProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [business, setBusiness] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting || submitted) return
    setSubmitting(true)
    try {
      await onSubmit({ name, email, business })
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="relative overflow-hidden">
      {/* ─── HERO · split layout · 50/50 desktop · stacked mobile ──── */}
      <section className="relative px-6 pt-24 pb-16 sm:pt-32">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          {/* LEFT · copy + form */}
          <div className="flex flex-col gap-6">
            <RevealOnScroll variant="fade">
              <span className="eyebrow-chip self-start">{eyebrow}</span>
            </RevealOnScroll>
            <RevealOnScroll>
              <h1 className="font-display text-[44px] font-bold leading-[1.05] tracking-tight sm:text-[60px]">
                <span className="text-gradient">{headline}</span>
              </h1>
            </RevealOnScroll>
            <RevealOnScroll>
              <p className="text-base text-[hsl(var(--muted-foreground))] sm:text-lg">
                {subheadline}
              </p>
            </RevealOnScroll>
            <StaggerList className="mt-2 flex flex-col gap-2">
              {bullets.map((b) => (
                <div key={b.id} className="flex items-start gap-2.5">
                  <Check
                    className="mt-1 h-3.5 w-3.5 shrink-0 text-[hsl(var(--success))]"
                    weight="bold"
                  />
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    {b.text}
                  </p>
                </div>
              ))}
            </StaggerList>
            {/* FORM */}
            <RevealOnScroll>
              <form
                onSubmit={handleSubmit}
                className="surface-card rim-instr mt-6 p-6"
                data-rim="violet"
              >
                <div className="relative z-[2] flex flex-col gap-3">
                  <FormField
                    label="Nombre"
                    value={name}
                    onChange={setName}
                    placeholder="Tu nombre"
                    required
                    disabled={submitted}
                  />
                  <FormField
                    label="Email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="tu@empresa.com"
                    required
                    disabled={submitted}
                  />
                  <FormField
                    label="Empresa"
                    value={business}
                    onChange={setBusiness}
                    placeholder="Nombre de tu agencia / empresa"
                    required
                    disabled={submitted}
                  />
                  <button
                    type="submit"
                    disabled={submitting || submitted}
                    className="mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[hsl(var(--primary))] px-5 text-[13px] font-medium text-[hsl(var(--primary-foreground))] shadow-[0_0_24px_-4px_hsl(var(--primary)/0.6)] transition-colors hover:bg-[hsl(var(--primary-glow))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))] disabled:opacity-50"
                  >
                    {submitted ? (
                      <>
                        <Check className="h-3.5 w-3.5" weight="bold" />
                        Recibido · te escribimos hoy
                      </>
                    ) : submitting ? (
                      <>
                        <CircleNotch
                          className="h-3.5 w-3.5 animate-spin"
                          weight="bold"
                          aria-hidden
                        />
                        Enviando...
                      </>
                    ) : (
                      <>
                        {ctaLabel}
                        <ArrowRight className="h-3.5 w-3.5" weight="bold" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </RevealOnScroll>
          </div>

          {/* RIGHT · product mock + parallax */}
          <div className="relative isolate min-h-[440px] lg:min-h-[560px]">
            <ParallaxBackground
              speed={0.2}
              className="absolute inset-0 -z-10"
            >
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(ellipse 80% 80% at 50% 50%, hsl(var(--primary-glow) / 0.18), transparent 70%)",
                  filter: "blur(40px)",
                }}
              />
            </ParallaxBackground>
            <RevealOnScroll variant="scale" className="h-full">
              <div
                className="surface-card rim-instr relative h-full flex items-center justify-center"
                data-rim="cyan"
              >
                <div className="relative z-[2] flex flex-col items-center gap-3 px-6 text-center">
                  <span
                    aria-hidden
                    className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] shadow-[0_0_32px_-4px_hsl(var(--primary)/0.7)]"
                  >
                    <span className="font-mono text-2xl font-semibold text-foreground">
                      ZR
                    </span>
                  </span>
                  <p className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                    {productMockLabel}
                  </p>
                  <p className="font-display text-base font-semibold leading-tight">
                    Sustituir por screenshot real (Sprint #9 wire)
                  </p>
                </div>
              </div>
            </RevealOnScroll>
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS · StaggerList cascade ─────────────────────── */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <RevealOnScroll>
            <div className="mb-10 flex flex-col gap-3">
              <span className="eyebrow-chip self-start">
                {testimonialsEyebrow}
              </span>
            </div>
          </RevealOnScroll>
          <StaggerList className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t) => (
              <article
                key={t.id}
                className="surface-card rim-instr p-6"
                data-rim="emerald"
              >
                <div className="relative z-[2] flex flex-col gap-4">
                  <p className="text-sm leading-relaxed text-foreground">
                    “{t.quote}”
                  </p>
                  <footer className="flex flex-col">
                    <span className="num text-[11px] font-semibold text-[hsl(var(--accent))]">
                      {t.author}
                    </span>
                    <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                      {t.role}
                    </span>
                  </footer>
                </div>
              </article>
            ))}
          </StaggerList>
        </div>
      </section>

      {/* ─── CLOSING CTA BAND ───────────────────────────────────────── */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <RevealOnScroll variant="scale">
            <div
              className="surface-card rim-instr p-10 sm:p-14"
              data-rim="violet"
            >
              <div className="relative z-[2] flex flex-col items-start gap-5">
                <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                  {closingTitle}
                </h2>
                <a
                  href={closingCta.href}
                  className="inline-flex h-12 items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-7 text-sm font-medium text-[hsl(var(--primary-foreground))] shadow-[0_0_24px_-4px_hsl(var(--primary)/0.6)] transition-colors hover:bg-[hsl(var(--primary-glow))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
                >
                  {closingCta.label}
                  <ArrowRight className="h-3.5 w-3.5" weight="bold" />
                </a>
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </section>
    </main>
  )
}

// ─── FormField · controlled input · Lumen-styled ────────────────────────

function FormField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  disabled = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="num text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
        {label}
        {required && <span className="text-[hsl(var(--danger))]"> *</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background)/0.6)] px-3 py-2 text-[13px] text-foreground placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))] disabled:opacity-50"
      />
    </label>
  )
}
