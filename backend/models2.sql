-- ========= 1. CREATE AN AGGREGATORS TABLE (optional but good practice) =========
-- This will store info about the middlemen entities.

CREATE TABLE public.aggregators (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  location text,
  license_number text
);
COMMENT ON TABLE public.aggregators IS 'Stores profile data for middlemen like distributors or wholesalers.';


-- ========= 2. CREATE THE AGGREGATED LOTS TABLE =========
-- This is the "digital crate" where batches are pooled.

CREATE TABLE public.aggregated_lots (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  aggregator_id uuid NOT NULL REFERENCES auth.users(id), -- The middleman who created the lot
  lot_name text, -- e.g., "Grade A Pepper for Export - July Week 2"
  description text
);
COMMENT ON TABLE public.aggregated_lots IS 'Represents a collection of batches pooled by a middleman.';


-- ========= 3. CREATE THE LINKING TABLE (Lot Components) =========
-- This table tracks exactly which batches are inside which lot (a many-to-many relationship).

CREATE TABLE public.lot_components (
  lot_id uuid NOT NULL REFERENCES public.aggregated_lots(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  PRIMARY KEY (lot_id, batch_id) -- Ensures a batch can't be added to the same lot twice
);
COMMENT ON TABLE public.lot_components IS 'Linking table to show which batches are in which aggregated lot.';


-- ========= 4. MODIFY THE PACKAGES TABLE =========
-- We update the 'packages' table to link to EITHER a single batch OR an aggregated lot.

-- First, add a new column to link to the lots table
ALTER TABLE public.packages
ADD COLUMN lot_id uuid REFERENCES public.aggregated_lots(id);

-- Make the original batch_id column nullable
ALTER TABLE public.packages
ALTER COLUMN batch_id DROP NOT NULL;

-- Add a check to ensure a package comes from one source only
ALTER TABLE public.packages
ADD CONSTRAINT package_source_check
CHECK ( (batch_id IS NOT NULL AND lot_id IS NULL) OR (batch_id IS NULL AND lot_id IS NOT NULL) );


-- ========= 5. ADD SECURITY POLICIES FOR NEW TABLES =========
ALTER TABLE public.aggregators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aggregated_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lot_components ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read-access" ON public.aggregators FOR SELECT USING (true);
CREATE POLICY "Allow public read-access" ON public.aggregated_lots FOR SELECT USING (true);
CREATE POLICY "Allow public read-access" ON public.lot_components FOR SELECT USING (true);

-- Allow authenticated users (middlemen) to create records
CREATE POLICY "Allow insert for authenticated users" ON public.aggregators FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow insert for authenticated users" ON public.aggregated_lots FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow insert for authenticated users" ON public.lot_components FOR INSERT WITH CHECK (auth.role() = 'authenticated');