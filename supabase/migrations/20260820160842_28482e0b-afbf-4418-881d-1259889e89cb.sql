CREATE TYPE public.event_status AS ENUM ('idea', 'provisional', 'confirmed', 'cancelled');

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.planning_areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#64748b',
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE,
  all_day BOOLEAN NOT NULL DEFAULT true,
  start_time TIME,
  end_time TIME,
  status public.event_status NOT NULL DEFAULT 'idea',
  pax INTEGER,
  notes TEXT,
  external_source TEXT,
  external_id TEXT,
  sync_status TEXT,
  last_synced_at TIMESTAMPTZ,
  migration_source TEXT,
  migration_source_ref TEXT,
  migration_review_required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT events_end_after_start CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE public.event_planning_areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  planning_area_id UUID NOT NULL REFERENCES public.planning_areas(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT event_planning_areas_unique UNIQUE (event_id, planning_area_id)
);

CREATE INDEX idx_planning_areas_sort_order ON public.planning_areas(sort_order);
CREATE INDEX idx_categories_sort_order ON public.categories(sort_order);
CREATE INDEX idx_events_start_date ON public.events(start_date);
CREATE INDEX idx_events_category_id ON public.events(category_id);
CREATE INDEX idx_events_status ON public.events(status);
CREATE INDEX idx_epa_event_id ON public.event_planning_areas(event_id);
CREATE INDEX idx_epa_planning_area_id ON public.event_planning_areas(planning_area_id);

CREATE TRIGGER trg_planning_areas_updated_at BEFORE UPDATE ON public.planning_areas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_areas TO authenticated;
GRANT ALL ON public.planning_areas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_planning_areas TO authenticated;
GRANT ALL ON public.event_planning_areas TO service_role;

ALTER TABLE public.planning_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_planning_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users manage planning areas" ON public.planning_areas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users manage categories" ON public.categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users manage events" ON public.events FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users manage event planning areas" ON public.event_planning_areas FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.planning_areas (name, sort_order) VALUES
  ('Hofladen', 1),
  ('KFH-Fishing', 2),
  ('Restaurant / À la Carte', 3),
  ('Event / Pavillon', 4),
  ('Hofstube', 5),
  ('Terrasse', 6);

INSERT INTO public.categories (name, color, sort_order) VALUES
  ('Hochzeit / Bankett', '#8c6f9e', 1),
  ('Eigenveranstaltung', '#3f6f8f', 2),
  ('Gastroaktion', '#2f7d6b', 3),
  ('Kurs', '#5a7d3f', 4),
  ('Messe / externer Auftritt', '#a5793a', 5),
  ('Promotion / Verkauf', '#a35f5f', 6),
  ('Betriebsferien', '#6b7280', 7),
  ('Interner Anlass', '#4f6b8a', 8),
  ('Sonstiges', '#7c7468', 9);