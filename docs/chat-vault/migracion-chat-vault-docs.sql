-- 02-nov · CHAT de /nuevo · ADENDA 2/3 · tabla de LECTURA del vault para el chat. La escribe el script del PC de Emilio (service_role); el tablero la lee con la misma llave.
-- Quien aplica base la aplica (CC2 solo entrega el SQL con su reversa). CREATE TABLE solo no basta: va con GRANT + RLS sin políticas para usuarios.
BEGIN;

CREATE TABLE IF NOT EXISTS public.chat_vault_docs (
  ruta           text PRIMARY KEY,
  titulo         text NOT NULL DEFAULT '',
  cuerpo         text NOT NULL,
  sha            text NOT NULL,
  modificado_en  timestamptz,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  busqueda       tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish', coalesce(titulo, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(ruta, '')), 'B') ||
    setweight(to_tsvector('spanish', left(coalesce(cuerpo, ''), 200000)), 'C')
  ) STORED
);

CREATE INDEX IF NOT EXISTS chat_vault_docs_busqueda_idx ON public.chat_vault_docs USING gin (busqueda);
CREATE INDEX IF NOT EXISTS chat_vault_docs_modificado_idx ON public.chat_vault_docs (modificado_en DESC);

ALTER TABLE public.chat_vault_docs ENABLE ROW LEVEL SECURITY;
-- sin políticas para anon ni authenticated: solo service_role (que salta RLS) la lee y la escribe
REVOKE ALL ON public.chat_vault_docs FROM anon, authenticated;
GRANT ALL ON public.chat_vault_docs TO service_role;

COMMENT ON TABLE public.chat_vault_docs IS 'Copia de solo lectura del vault (carpetas permitidas, sin secretos) para el chat de /nuevo. La escribe scripts/chat-vault/sincronizar.mjs.';
COMMIT;

-- REVERSA (probada en seco):
-- BEGIN; DROP TABLE IF EXISTS public.chat_vault_docs; COMMIT;
