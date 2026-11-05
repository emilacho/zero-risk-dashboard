/** el visor 3D del estudio (`@google/model-viewer`, un elemento web): sus atributos para JSX */
import type { DetailedHTMLProps, HTMLAttributes } from "react"

type AtributosDelVisor = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  src?: string
  poster?: string
  alt?: string
  "camera-controls"?: string
  "auto-rotate"?: string
  "auto-rotate-delay"?: string
  "rotation-per-second"?: string
  "touch-action"?: string
  "interaction-prompt"?: string
  "shadow-intensity"?: string
  exposure?: string
  "environment-image"?: string
}

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": AtributosDelVisor
    }
  }
}
