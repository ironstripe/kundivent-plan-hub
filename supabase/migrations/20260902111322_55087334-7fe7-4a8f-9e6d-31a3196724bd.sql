ALTER TABLE public.radar_sources ADD COLUMN IF NOT EXISTS last_sync_summary text;

UPDATE public.radar_sources
SET name = 'Stadt Stein am Rhein',
    sync_enabled = true,
    active = true,
    base_url = 'https://www.steinamrhein.ch/themen-az/veranstaltungen.html/21',
    updated_at = now()
WHERE id = 'stein-am-rhein';

INSERT INTO public.radar_sources (id, name, source_type, active, sync_enabled, base_url)
SELECT 'stein-am-rhein', 'Stadt Stein am Rhein', 'regional_event', true, true,
       'https://www.steinamrhein.ch/themen-az/veranstaltungen.html/21'
WHERE NOT EXISTS (SELECT 1 FROM public.radar_sources WHERE id = 'stein-am-rhein');