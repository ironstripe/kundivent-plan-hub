CREATE TABLE public.radar_sources (
  id text PRIMARY KEY,
  name text NOT NULL,
  source_type text NOT NULL,
  base_url text,
  active boolean NOT NULL DEFAULT true,
  sync_enabled boolean NOT NULL DEFAULT false,
  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.radar_sources TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.radar_sources TO authenticated;
GRANT ALL ON public.radar_sources TO service_role;
ALTER TABLE public.radar_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users read radar sources" ON public.radar_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage radar sources" ON public.radar_sources FOR ALL TO authenticated USING (public.is_active_admin(auth.uid())) WITH CHECK (public.is_active_admin(auth.uid()));
CREATE TRIGGER trg_radar_sources_updated_at BEFORE UPDATE ON public.radar_sources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.radar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL REFERENCES public.radar_sources(id) ON DELETE CASCADE,
  external_id text,
  source_key text NOT NULL,
  source_url text,
  type text NOT NULL CHECK (type IN ('school_holiday','public_holiday','regional_event','theme_day')),
  title text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date,
  all_day boolean NOT NULL DEFAULT true,
  start_time time,
  end_time time,
  location_name text,
  city text,
  canton text,
  category text,
  relevance text NOT NULL DEFAULT 'medium' CHECK (relevance IN ('high','medium','low')),
  kundivent_idea text,
  is_manual boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, source_key)
);

CREATE INDEX idx_radar_events_start_date ON public.radar_events (start_date);
CREATE INDEX idx_radar_events_type ON public.radar_events (type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.radar_events TO authenticated;
GRANT ALL ON public.radar_events TO service_role;
ALTER TABLE public.radar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users read radar events" ON public.radar_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users create manual radar events" ON public.radar_events FOR INSERT TO authenticated WITH CHECK (is_manual = true);
CREATE POLICY "Authenticated users update manual radar events" ON public.radar_events FOR UPDATE TO authenticated USING (is_manual = true) WITH CHECK (is_manual = true);
CREATE POLICY "Authenticated users delete manual radar events" ON public.radar_events FOR DELETE TO authenticated USING (is_manual = true);
CREATE POLICY "Admins manage radar events" ON public.radar_events FOR ALL TO authenticated USING (public.is_active_admin(auth.uid())) WITH CHECK (public.is_active_admin(auth.uid()));
CREATE TRIGGER trg_radar_events_updated_at BEFORE UPDATE ON public.radar_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.radar_theme_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  day integer NOT NULL CHECK (day BETWEEN 1 AND 31),
  category text NOT NULL,
  description text,
  source_url text,
  kundivent_idea text,
  relevance text NOT NULL DEFAULT 'medium' CHECK (relevance IN ('high','medium','low')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, month, day)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.radar_theme_days TO authenticated;
GRANT ALL ON public.radar_theme_days TO service_role;
ALTER TABLE public.radar_theme_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users read theme days" ON public.radar_theme_days FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage theme days" ON public.radar_theme_days FOR ALL TO authenticated USING (public.is_active_admin(auth.uid())) WITH CHECK (public.is_active_admin(auth.uid()));
CREATE TRIGGER trg_radar_theme_days_updated_at BEFORE UPDATE ON public.radar_theme_days FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.radar_sources (id, name, source_type, base_url, active, sync_enabled, last_sync_status) VALUES
  ('openholidays-school', 'OpenHolidays – Schulferien', 'school_holiday', 'https://openholidaysapi.org', true, true, NULL),
  ('openholidays-public', 'OpenHolidays – Feiertage', 'public_holiday', 'https://openholidaysapi.org', true, true, NULL),
  ('schaffhauserland', 'Schaffhauserland Tourismus', 'regional_event', NULL, true, false, 'not_connected'),
  ('stein-am-rhein', 'Stein am Rhein – Veranstaltungskalender', 'regional_event', NULL, true, false, 'prepared'),
  ('frauenfeld-aktuell', 'Frauenfeld aktuell – Veranstaltungskalender', 'regional_event', NULL, true, false, 'prepared'),
  ('kundivent-theme-days', 'Thementage (Kundivent)', 'theme_day', NULL, true, true, NULL),
  ('manual', 'Manuell erfasste Umfeld-Ereignisse', 'manual', NULL, true, false, NULL);

INSERT INTO public.radar_theme_days (name, month, day, category, description, source_url, kundivent_idea, relevance) VALUES
  ('Welttag der Feuchtgebiete', 2, 2, 'Natur & Umwelt', 'Ramsar-Konvention zum Schutz von Feuchtgebieten.', 'https://www.ramsar.org/world-wetlands-day', 'Rhein- und Teichlandschaft rund um den Hof als Lebensraum zeigen.', 'medium'),
  ('Welttag der Hülsenfrüchte', 2, 10, 'Fisch & Genuss', 'FAO-Aktionstag für Hülsenfrüchte in der Ernährung.', 'https://www.fao.org/pulses-day', 'Vegetarisches Tagesmenü mit regionalen Hülsenfrüchten.', 'low'),
  ('Internationaler Tag des Glücks', 3, 20, 'Familie & Freizeit', 'UN-Aktionstag rund um Wohlbefinden.', 'https://www.un.org/en/observances/happiness-day', 'Kleine Aktion für Gäste: Glücksmoment am Wasser.', 'low'),
  ('Internationaler Tag der Wälder', 3, 21, 'Natur & Umwelt', 'UN-Tag für Wälder und nachhaltige Waldnutzung.', 'https://www.un.org/en/observances/forests-and-trees-day', 'Waldspaziergang oder Grillholz-Story aus der Region.', 'medium'),
  ('Weltwassertag', 3, 22, 'Natur & Umwelt', 'UN-Tag für Süsswasser und nachhaltige Wassernutzung.', 'https://www.un.org/en/observances/water-day', 'Eigene Quelle, Fischzucht und Wasserkreislauf kommunikativ verbinden.', 'high'),
  ('Internationaler Tag des Sports für Entwicklung und Frieden', 4, 6, 'Familie & Freizeit', 'UN-Aktionstag rund um Sport und Gemeinschaft.', 'https://www.un.org/en/observances/sport-day', 'Kooperation mit lokalen Vereinen für einen Aktivtag.', 'low'),
  ('Tag der Erde', 4, 22, 'Natur & Umwelt', 'Internationaler Aktionstag für Umweltbewusstsein.', 'https://www.un.org/en/observances/earth-day', 'Nachhaltigkeitsgeschichte des Hofes erzählen.', 'medium'),
  ('Welttag des Buches', 4, 23, 'Familie & Freizeit', 'UNESCO-Welttag des Buches und des Urheberrechts.', 'https://www.unesco.org/en/days/book-and-copyright', 'Lesenachmittag in der Hofstube.', 'low'),
  ('Internationaler Tag der Familie', 5, 15, 'Familie & Freizeit', 'UN-Tag der Familien.', 'https://www.un.org/en/observances/international-day-of-families', 'Familien-Sonntag mit Angeln und Kinderprogramm.', 'high'),
  ('Welttag der Bienen', 5, 20, 'Natur & Umwelt', 'FAO-Aktionstag zum Schutz der Bestäuber.', 'https://www.fao.org/world-bee-day', 'Regionale Imkerei einbinden, Honig im Hofladen.', 'medium'),
  ('Welttag der kulturellen Vielfalt', 5, 21, 'Familie & Freizeit', 'UNESCO-Tag der kulturellen Vielfalt.', 'https://www.unesco.org/en/days/cultural-diversity', 'Kulinarische Gastküche als Aktionstag.', 'low'),
  ('Internationaler Tag der biologischen Vielfalt', 5, 22, 'Natur & Umwelt', 'UN-Tag der Biodiversität.', 'https://www.un.org/en/observances/biological-diversity-day', 'Artenvielfalt in Fischzucht und Uferzone zeigen.', 'medium'),
  ('Weltspieltag', 5, 28, 'Familie & Freizeit', 'Internationaler Aktionstag für das Recht auf Spiel.', 'https://worldplayday.net', 'Spielnachmittag auf dem Hofareal.', 'low'),
  ('Weltmilchtag', 6, 1, 'Fisch & Genuss', 'FAO-Aktionstag für Milch und Milchwirtschaft.', 'https://www.fao.org/world-milk-day', 'Regionale Milchprodukte im Frühstück und Hofladen.', 'low'),
  ('Internationaler Tag gegen illegale Fischerei', 6, 5, 'Fisch & Genuss', 'FAO-Tag gegen illegale, ungemeldete und unregulierte Fischerei.', 'https://www.fao.org/iuu-fishing-day', 'Transparenz der eigenen Fischzucht und Herkunft kommunizieren.', 'high'),
  ('Weltumwelttag', 6, 5, 'Natur & Umwelt', 'UNEP-Weltumwelttag.', 'https://www.unep.org/events/un-day/world-environment-day', 'Umweltprojekte des Hofes sichtbar machen.', 'medium'),
  ('Welttag der Lebensmittelsicherheit', 6, 7, 'Fisch & Genuss', 'WHO/FAO-Tag der Lebensmittelsicherheit.', 'https://www.who.int/campaigns/world-food-safety-day', 'Qualitätskette von der Zucht bis zum Teller erklären.', 'medium'),
  ('Welttag der Ozeane', 6, 8, 'Natur & Umwelt', 'UN-Tag der Meere und Gewässer.', 'https://www.un.org/en/observances/oceans-day', 'Bezug zu Süsswasser und Rhein herstellen.', 'low'),
  ('Internationaler Tag der Freundschaft', 7, 30, 'Familie & Freizeit', 'UN-Aktionstag der Freundschaft.', 'https://www.un.org/en/observances/friendship-day', 'Aktion für Gruppen und Stammtische.', 'low'),
  ('Internationaler Tag des Tourismus', 9, 27, 'Familie & Freizeit', 'UN Tourism Welttourismustag.', 'https://www.unwto.org/world-tourism-day', 'Zusammenarbeit mit Schaffhauserland Tourismus.', 'medium'),
  ('Internationaler Tag gegen Lebensmittelverschwendung', 9, 29, 'Fisch & Genuss', 'FAO/UNEP-Aktionstag gegen Food Waste.', 'https://www.fao.org/international-day-awareness-food-loss-waste', 'Nose-to-tail-Menü mit dem ganzen Fisch.', 'high'),
  ('Welternährungstag', 10, 16, 'Fisch & Genuss', 'FAO-Welternährungstag.', 'https://www.fao.org/world-food-day', 'Regionale Ernährung und Herkunft in den Mittelpunkt stellen.', 'high'),
  ('Internationaler Tag der Küchenchefs', 10, 20, 'Fisch & Genuss', 'Worldchefs-Aktionstag des Kochberufs.', 'https://worldchefs.org/international-chefs-day', 'Küchenteam vorstellen, Blick hinter die Kulissen.', 'medium'),
  ('Welttag der Fischerei', 11, 21, 'Fisch & Genuss', 'Internationaler Tag der Fischerei.', 'https://www.fao.org/fishery', 'Fisch-Special im Restaurant, Zuchtführung oder Social-Media-Story.', 'high'),
  ('Weltkindertag', 11, 20, 'Familie & Freizeit', 'UN-Weltkindertag.', 'https://www.un.org/en/observances/world-childrens-day', 'Kinderprogramm mit Angeln und Hofführung.', 'medium'),
  ('Weltbodentag', 12, 5, 'Natur & Umwelt', 'FAO-Weltbodentag.', 'https://www.fao.org/world-soil-day', 'Landwirtschaft und Bodenpflege rund um den Hof zeigen.', 'low'),
  ('Internationaler Tag der Berge', 12, 11, 'Natur & Umwelt', 'UN-Tag der Berge und Bergregionen.', 'https://www.un.org/en/observances/mountain-day', 'Regionale Bergprodukte im Winterangebot.', 'low');