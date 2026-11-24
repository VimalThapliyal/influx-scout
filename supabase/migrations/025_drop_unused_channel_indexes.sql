-- Free ~100 MB on the free-tier disk (applied manually on 2026-11-24).
-- idx_channels_search: GIN full-text index that no query uses (search uses ILIKE).
-- idx_channels_handle: duplicate of the unique channels_handle_key index.
DROP INDEX IF EXISTS public.idx_channels_search;
DROP INDEX IF EXISTS public.idx_channels_handle;
