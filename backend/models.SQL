-- =============================
-- SpiceChain Audited DB Schema
-- Compatible with Supabase (Postgres)
-- =============================

-- 0) Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "public";

-- 1) Enums
CREATE TYPE public.role AS ENUM ('Farmer','Aggregator','Middleman','Retailer','Consumer','Processor','Logistics');

CREATE TYPE public.batch_event_type AS ENUM (
'BATCH_CREATED','TRANSFER','SPLIT','MERGE','PROCESS','QUALITY_TEST','PACKAGE_CREATED','PACKAGE_TRANSFER','ADJUSTMENT'
);

CREATE TYPE public.package_event_type AS ENUM ('PACKAGE_CREATED','PACKAGE_TRANSFER','PACKAGE_SCAN','PACKAGE_STATUS');

-- 2) Participants (now acts as both participants and users)
CREATE TABLE public.participants (
id           BIGSERIAL PRIMARY KEY,
name         VARCHAR(255) NOT NULL,
email        VARCHAR(255) UNIQUE, -- For authentication
password_hash TEXT, -- For authentication  
role         public.role NOT NULL,
contact_info JSONB DEFAULT '{}'::jsonb,
is_active    BOOLEAN DEFAULT true,
created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_participants_role ON public.participants(role);
CREATE INDEX idx_participants_email ON public.participants(email);

-- 3) Locations
CREATE TABLE public.locations (
id         BIGSERIAL PRIMARY KEY,
name       VARCHAR(255) NOT NULL,
kind       VARCHAR(50),
address    TEXT,
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4) Spices lookup
CREATE TABLE public.spices (
id       BIGSERIAL PRIMARY KEY,
name     VARCHAR(120) UNIQUE NOT NULL,
varietal VARCHAR(120),
meta     JSONB DEFAULT '{}'::jsonb
);

-- Insert some common spices
INSERT INTO public.spices (name, varietal, meta) VALUES 
('Black Pepper', 'Tellicherry', '{"origin": "Kerala", "heat_level": "medium"}'),
('Cardamom', 'Green', '{"origin": "Western Ghats", "grade": "premium"}'),
('Turmeric', 'Curcuma Longa', '{"origin": "Tamil Nadu", "curcumin_content": "high"}'),
('Cinnamon', 'Ceylon', '{"origin": "Sri Lanka", "bark_thickness": "thin"}'),
('Cloves', 'Syzygium Aromaticum', '{"origin": "Madagascar", "oil_content": "high"}');

-- 5) Batches
CREATE TABLE public.batches (
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
spice_id              BIGINT NOT NULL REFERENCES public.spices(id),
origin_location_id    BIGINT REFERENCES public.locations(id),
origin_participant_id BIGINT NOT NULL REFERENCES public.participants(id),
harvest_date          DATE,
created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
current_owner_id      BIGINT NOT NULL REFERENCES public.participants(id),
status                VARCHAR(30) NOT NULL DEFAULT 'Active'
);
CREATE INDEX idx_batches_owner ON public.batches(current_owner_id);
CREATE INDEX idx_batches_spice ON public.batches(spice_id);
CREATE INDEX idx_batches_origin ON public.batches(origin_participant_id);

CREATE TABLE public.batch_stock (
batch_id        UUID PRIMARY KEY REFERENCES public.batches(id) ON DELETE CASCADE,
qty_g_available NUMERIC(18,3) NOT NULL CHECK (qty_g_available >= 0)
);

-- 6) Batch Compositions (Split/Merge)
CREATE TABLE public.batch_compositions (
id              BIGSERIAL PRIMARY KEY,
child_batch_id  UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
source_batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE RESTRICT,
qty_g_used      NUMERIC(18,3) NOT NULL CHECK (qty_g_used > 0),
note            TEXT,
created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX ON public.batch_compositions (child_batch_id);
CREATE INDEX ON public.batch_compositions (source_batch_id);

-- 7) Batch Events (Append-only)
CREATE TABLE public.batch_events (
id                  BIGSERIAL PRIMARY KEY,
batch_id            UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
event_type          public.batch_event_type NOT NULL,
actor_id            BIGINT NOT NULL REFERENCES public.participants(id),
at_location_id      BIGINT REFERENCES public.locations(id),
event_time          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
details             JSONB NOT NULL DEFAULT '{}'::jsonb,
from_participant_id BIGINT REFERENCES public.participants(id),
to_participant_id   BIGINT REFERENCES public.participants(id),
qty_g_delta         NUMERIC(18,3),
prev_event_hash     BYTEA,
event_hash          BYTEA NOT NULL DEFAULT digest(random()::text, 'sha256')
);
CREATE INDEX ON public.batch_events (batch_id, event_time);
CREATE INDEX ON public.batch_events (event_type);

-- 8) Transfers
CREATE TABLE public.transfers (
id                  BIGSERIAL PRIMARY KEY,
batch_id            UUID NOT NULL REFERENCES public.batches(id) ON DELETE RESTRICT,
from_participant_id BIGINT NOT NULL REFERENCES public.participants(id),
to_participant_id   BIGINT NOT NULL REFERENCES public.participants(id),
qty_g               NUMERIC(18,3) NOT NULL CHECK (qty_g > 0),
price_per_kg        NUMERIC(12,2),
transaction_time    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
meta                JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX ON public.transfers (batch_id, transaction_time);
CREATE INDEX ON public.transfers (from_participant_id);
CREATE INDEX ON public.transfers (to_participant_id);

-- 9) Packages
CREATE TABLE public.packages (
id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
label_code       TEXT UNIQUE NOT NULL,
net_qty_g        NUMERIC(18,3) NOT NULL CHECK (net_qty_g > 0),
packaged_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
packager_id      BIGINT NOT NULL REFERENCES public.participants(id),
current_owner_id BIGINT NOT NULL REFERENCES public.participants(id),
status           VARCHAR(30) NOT NULL DEFAULT 'InStock'
);
CREATE INDEX idx_packages_owner ON public.packages(current_owner_id);
CREATE INDEX idx_packages_label ON public.packages(label_code);

CREATE TABLE public.package_contents (
package_id       UUID NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
batch_id         UUID NOT NULL REFERENCES public.batches(id) ON DELETE RESTRICT,
qty_g_from_batch NUMERIC(18,3) NOT NULL CHECK (qty_g_from_batch > 0),
PRIMARY KEY (package_id, batch_id)
);
CREATE INDEX ON public.package_contents (batch_id);

CREATE TABLE public.package_events (
id              BIGSERIAL PRIMARY KEY,
package_id      UUID NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
event_type      public.package_event_type NOT NULL,
actor_id        BIGINT NOT NULL REFERENCES public.participants(id),
event_time      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
details         JSONB NOT NULL DEFAULT '{}'::jsonb,
prev_event_hash BYTEA,
event_hash      BYTEA NOT NULL DEFAULT digest(random()::text, 'sha256')
);
CREATE INDEX ON public.package_events (package_id, event_time);

-- 10) QA Tests
CREATE TABLE public.qa_tests (
id           BIGSERIAL PRIMARY KEY,
batch_id     UUID REFERENCES public.batches(id) ON DELETE CASCADE,
package_id   UUID REFERENCES public.packages(id) ON DELETE CASCADE,
test_type    VARCHAR(60) NOT NULL,
result       JSONB NOT NULL,
tested_by_id BIGINT REFERENCES public.participants(id),
tested_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
CONSTRAINT qa_tests_check_target CHECK (
    (batch_id IS NOT NULL AND package_id IS NULL) OR 
    (batch_id IS NULL AND package_id IS NOT NULL)
)
);
CREATE INDEX ON public.qa_tests (batch_id);
CREATE INDEX ON public.qa_tests (package_id);
CREATE INDEX ON public.qa_tests (test_type);

-- 11) Audit Log
CREATE TABLE public.audit_log (
id         BIGSERIAL PRIMARY KEY,
table_name TEXT NOT NULL,
row_pk     TEXT NOT NULL,
op         VARCHAR(10) NOT NULL,
at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
actor_id   BIGINT,
old_row    JSONB,
new_row    JSONB
);
CREATE INDEX ON public.audit_log (table_name, row_pk);
CREATE INDEX ON public.audit_log (at);

-- =============================
-- Helper Functions & Triggers
-- =============================

-- Function to update batch stock after transfers
CREATE OR REPLACE FUNCTION update_batch_stock_on_transfer()
RETURNS TRIGGER AS $$
BEGIN
    -- Deduct from source batch
    UPDATE batch_stock 
    SET qty_g_available = qty_g_available - NEW.qty_g
    WHERE batch_id = NEW.batch_id;
    
    -- Update batch owner if full transfer
    IF (SELECT qty_g_available FROM batch_stock WHERE batch_id = NEW.batch_id) = 0 THEN
        UPDATE batches 
        SET current_owner_id = NEW.to_participant_id
        WHERE id = NEW.batch_id;
    END IF;
    
    -- Insert batch event
    INSERT INTO batch_events (
        batch_id, event_type, actor_id, 
        from_participant_id, to_participant_id, 
        qty_g_delta, details
    ) VALUES (
        NEW.batch_id, 'TRANSFER', NEW.from_participant_id,
        NEW.from_participant_id, NEW.to_participant_id,
        -NEW.qty_g, 
        jsonb_build_object('transfer_id', NEW.id, 'price_per_kg', NEW.price_per_kg)
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for transfer updates
CREATE TRIGGER trigger_update_batch_stock_on_transfer
    AFTER INSERT ON transfers
    FOR EACH ROW EXECUTE FUNCTION update_batch_stock_on_transfer();

-- Function to update batch stock when packages are created
CREATE OR REPLACE FUNCTION update_batch_stock_on_package()
RETURNS TRIGGER AS $$
BEGIN
    -- Deduct stock from source batch
    UPDATE batch_stock 
    SET qty_g_available = qty_g_available - NEW.qty_g_from_batch
    WHERE batch_id = NEW.batch_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for package content updates
CREATE TRIGGER trigger_update_batch_stock_on_package
    AFTER INSERT ON package_contents
    FOR EACH ROW EXECUTE FUNCTION update_batch_stock_on_package();