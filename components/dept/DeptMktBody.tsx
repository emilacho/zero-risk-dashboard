/**
 * Dept · MKT · Marketing.
 *
 * Consola de Marketing APROBADA (multi-vista · Arquitectura / Workflows /
 * Equipo / Aprobaciones / Brazos+vault / Brain · flujo circulatorio en vivo).
 * Paso 1 · embebida como asset estático full-bleed en `/mkt-console.html`
 * (trae su propia barra de pestañas + feed + flujo). El sidebar de la app
 * maneja la navegación de regreso.
 *
 * §148 · datos simulados hasta cablear la costura/dataClient real.
 * Reemplaza el body MKT previo (KPIs + CampaignCreatorModal · removido).
 * Siguiente iteración · React-ificar + cablear datos reales + re-skin Lumen v3.
 */
export function DeptMktBody() {
  return (
    <iframe
      src="/mkt-console.html"
      title="Consola de Marketing · Zero Risk"
      className="block h-screen w-full border-0"
    />
  )
}
