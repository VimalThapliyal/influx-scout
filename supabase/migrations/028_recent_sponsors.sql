-- Sponsorships named in the descriptions of a creator's last five videos.
-- sponsored_recent: a sponsorship disclosure was found; recent_sponsors: brand
-- names where the description states them. Set by quality scoring.
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS sponsored_recent boolean;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS recent_sponsors text[];
