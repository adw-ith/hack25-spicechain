-- ========= 1. CREATE THE FARMERS TABLE =========
-- This table stores public profile information for farmers.
-- It is linked to the built-in Supabase auth users table.

CREATE TABLE public.farmers (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  name text,
  bio text,
  farm_location text,
  photo_url text
);
COMMENT ON TABLE public.farmers IS 'Stores public profile data for users who are farmers.';


-- ========= 2. CREATE THE BATCHES TABLE =========
-- This table tracks each harvest of spices.

CREATE TABLE public.batches (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  farmer_id uuid NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  spice_type text NOT NULL,
  harvest_date date NOT NULL,
  quantity_kg numeric NOT NULL
);
COMMENT ON TABLE public.batches IS 'Tracks each individual harvest or batch of spices.';


-- ========= 3. CREATE THE TIMELINE EVENTS TABLE =========
-- This table stores the entire history of a batch from farm to package.

CREATE TABLE public.timeline_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  description text,
  actor_name text
);
COMMENT ON TABLE public.timeline_events IS 'Stores each step in the spice supply chain for a batch.';


-- ========= 4. CREATE THE PACKAGES TABLE =========
-- This table links a final product package to a batch via a unique ID.

CREATE TABLE public.packages (
  package_uid text NOT NULL PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE
);
COMMENT ON TABLE public.packages IS 'Stores the final, consumer-facing unique package IDs.';


-- ========= 5. SETUP ROW LEVEL SECURITY (RLS) =========
-- This is crucial for securing your data.

-- Enable RLS for all tables
ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

-- Create policies:
-- POLICY: Allow public read-only access to all tables for the trace feature.
CREATE POLICY "Allow public read-access" ON public.farmers FOR SELECT USING (true);
CREATE POLICY "Allow public read-access" ON public.batches FOR SELECT USING (true);
CREATE POLICY "Allow public read-access" ON public.timeline_events FOR SELECT USING (true);
CREATE POLICY "Allow public read-access" ON public.packages FOR SELECT USING (true);

-- POLICY: Allow logged-in users (farmers/processors) to create new entries.
CREATE POLICY "Allow insert for authenticated users" ON public.farmers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow insert for authenticated users" ON public.batches FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow insert for authenticated users" ON public.timeline_events FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow insert for authenticated users" ON public.packages FOR INSERT WITH CHECK (auth.role() = 'authenticated');