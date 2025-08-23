-- =============================
-- SpiceChain Audited DB Schema
-- Compatible with Supabase (Postgres)
-- =============================

-- 0) Extensions
-- Ensures the gen_random_uuid() function is available.
-- Supabase enables this by default, but it's best practice to include it.
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "public";

-- 1) Enums
CREATE TYPE public.role AS ENUM ('Farmer','Aggregator','Middleman','Retailer','Consumer','Processor','Logistics');

CREATE TYPE public.batch_event_type AS ENUM (
'BATCH_CREATED','TRANSFER','SPLIT','MERGE','PROCESS','QUALITY_TEST','PACKAGE_CREATED','PACKAGE_TRANSFER','ADJUSTMENT'
);

CREATE TYPE public.package_event_type AS ENUM ('PACKAGE_CREATED','PACKAGE_TRANSFER','PACKAGE_SCAN','PACKAGE_STATUS');

-- 2) Participants
CREATE TABLE public.participants (
id           BIGSERIAL PRIMARY KEY,
name         VARCHAR(255) NOT NULL,
role         public.role NOT NULL,
contact_info JSONB DEFAULT '{}'::jsonb,
created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_participants_role ON public.participants(role);

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
event_hash          BYTEA NOT NULL
);
CREATE INDEX ON public.batch_events (batch_id, event_time);

-- 8) Transfers
CREATE TABLE public.transfers (
id                  BIGSERIAL PRIMARY KEY,
batch_id            UUID NOT NULL REFERENCES public.batches(id) ON DELETE RESTRICT,
-- Renamed from_user_id and to_user_id for consistency, as they reference participants.
from_participant_id BIGINT NOT NULL REFERENCES public.participants(id),
to_participant_id   BIGINT NOT NULL REFERENCES public.participants(id),
qty_g               NUMERIC(18,3) NOT NULL CHECK (qty_g > 0),
price_per_kg        NUMERIC(12,2),
transaction_time    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
meta                JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX ON public.transfers (batch_id, transaction_time);

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
event_hash      BYTEA NOT NULL
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
tested_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

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