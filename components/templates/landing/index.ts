/**
 * Landing templates · D6 export barrel.
 *
 * Re-exports the 3 D6 variants for clean import from page routes:
 *   import { TemplateBoldHero, TemplateEditorial, TemplateProduct }
 *     from "@/components/templates/landing"
 */
export { TemplateBoldHero } from "./TemplateBoldHero"
export type {
  TemplateBoldHeroProps,
  BoldHeroFeature,
  BoldHeroCta,
} from "./TemplateBoldHero"

export { TemplateEditorial } from "./TemplateEditorial"
export type {
  TemplateEditorialProps,
  EditorialSection,
  EditorialAuthor,
} from "./TemplateEditorial"

export { TemplateProduct } from "./TemplateProduct"
export type {
  TemplateProductProps,
  ProductBullet,
  ProductTestimonial,
  ProductLead,
} from "./TemplateProduct"
