-- YouTube's own topic categories for a channel (channels.list topicDetails),
-- stored as the Wikipedia page names, e.g. {Physical_fitness,Health}.
-- Used by the niche classifier alongside title/description keywords.
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS topic_categories text[];
