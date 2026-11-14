-- Tolerant on purpose. Docker's superuser creates the extension.
-- A role that is not allowed to, or a server built without pgvector,
-- still finishes init. No table in this app stores embeddings yet.
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'pgvector extension was not created: %', SQLERRM;
END
$$;
