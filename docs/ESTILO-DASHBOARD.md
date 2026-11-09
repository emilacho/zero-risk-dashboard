# Estilo del dashboard · guía viva (aprobada por Emilio, 2026-11-05 23:29)

**Léela ANTES de cualquier boceto o pantalla del dashboard.** Referencia aprobada: `raw/evidencia/2026-11-05-estilo-base/APROBADO-concepto.png` y su fuente `APROBADO-concepto.html`. Si una pantalla nueva no se parece a esa imagen, está mal.

## 1 · El carácter
- **Sutil, elegante y futurista.** Es el de la escena original (`raw/evidencia/dashboard-nuevo/cc3-sprint1-final-escritorio.png`): carbón mate, hilos dorados finos, casi todo oscuro y silencioso. El color aparece solo donde importa.
- **Sobrio y estandarizado.** Lo que degradó el estilo fue que cada CC «siguió nuestro estilo» a su manera: tenía disponible la paleta entera de Tailwind y la usó.
- **Como un iPhone:** de lo macro a lo micro. Arriba lo grande; el detalle, al entrar.

## 2 · Colores (los únicos permitidos)
| Token | Valor | Uso |
|---|---|---|
| Carbón | `#0d0e10` | fondo |
| Grafito | `#141519` / `#18191e` | paneles y tarjetas; nunca cajas rellenas de color |
| Hueso | `#e9e7e2` | texto que se lee; grises `#a3a2a8` (dato) y `#818189` (apagado) |
| Oro | `#d6aa64` | **letras** de títulos y rótulos, hilos, pestaña o recuadro activo, botones secundarios (solo borde y letra) |
| Ámbar | `#e8731a` | **un solo** botón principal por tarjeta, siempre a la derecha |
| Alarma | `#d9534a` | solo un punto, una línea fina o un número; **nunca un recuadro** |

## 3 · Letra (4 tamaños + el número + los botones)
- **Título del panel:** 20, oro, MAYÚSCULAS espaciadas. Uno por panel, centrado.
- **Rótulo:** 11, oro, MAYÚSCULAS espaciadas. Va sobre cada bloque y **siempre destaca más que el texto** de abajo.
- **Texto:** 15, hueso. **Dato:** 13, gris.
- **Número:** 36 en recuadro (contadores del panel) y 24 dentro de una tarjeta (cifras). Nunca más grande que eso.
- **Botones: 18, peso medio, siempre** (09-nov, Emilio · imagen `APROBADO-botones-letra-18.png`). Vale para todos: el ámbar principal y los de borde oro. La caja, la forma y los colores no cambian. El costo que va junto al botón («≈ US$ 0,014») sigue en dato 13. Token `text-boton`; la revisión automática rechaza un botón ámbar o de borde oro sin él.
- Dos pesos: normal y medio.

## 4 · Reglas de composición (lo que Emilio fue corrigiendo)
1. **Simetría:** todo centrado sobre un eje. Recuadros y botones en pares o tríos del mismo ancho. La ✕ de cerrar va alineada con el título.
2. **Rótulos de una o dos palabras, nunca frases:** «Uso», «Desbloquea», «Decisivo», «Autocierre», «Propuesta».
3. **Rótulo fijo y valor variable se distinguen:** el rótulo en oro pequeño arriba y el valor en hueso más grande abajo (p. ej. CUENTA / Náufrago · DEPARTAMENTO / Financiero). Nunca en una sola frase, como «Cuenta Náufrago».
4. **Números en recuadro**, grandes, con su rótulo debajo.
5. **Los recuadros de número son los filtros.** No se repiten como pestañas debajo (Abiertas / Tomadas / Cerradas).
6. **Cada elemento es una tarjeta** con el mismo orden: quién (rótulos) → propuesta o dato → aviso → para qué → acciones. Se pasa de una a otra con «1 de N».
7. **Aprovechar el espacio:** cada panel mide lo que su contenido. Sin huecos abajo, y sin achicar las letras para que quepa.
8. **Nada flota sobre la escena** de Tu oficina. Los avisos viven en sus paneles (p. ej. Riesgos). La campana roja con su número se queda y abre su panel.
9. **Jerga técnica nunca a la vista.** Se corrige donde se escribe (el agente), no se tapa en pantalla.

## 5 · Cómo se trabaja con Emilio en diseño
- **Siempre boceto (imagen) antes de construir.** Nada visual se publica sin que él lo vea.
- **Cada observación suya se aplica sobre la última versión, y solo ese cambio.** No se rehace todo: «vamos suave». Si un cambio sale peor, se vuelve a la versión anterior y se aplica solo lo pedido.
- Copiar la estructura del mejor del mercado; nuestro estilo va solo en la fachada.
- Mostrar primero la pieza afectada (recorte de la tarjeta), no todo el lienzo, cuando el cambio es puntual.

## 6 · Cómo se hace cumplir
- Los tokens viven en un solo archivo del dashboard. Una comprobación automática en CI rechaza colores, tamaños o pesos fuera de esta guía en archivos nuevos o tocados.
- CC6 certifica cada pantalla contra esta guía y contra la imagen aprobada.


## Valor final del gris apagado (06-nov)

`#818189` (antes `#6c6c74`). Lenovo eligió la opción (b) de la señal de CC6: se aclaró lo mínimo para llegar a 4,5 a 1 sobre el grafito más claro (`#18191e`). Contraste: 4,54 sobre grafito-2 · 4,72 sobre grafito · 5,00 sobre carbón. Con ese valor sirve también para texto. El único lugar donde vive es `app/estilo-base.css`.
