-- Hash chaining function for batch_events
CREATE OR REPLACE FUNCTION set_batch_event_hash()
RETURNS trigger AS $$
DECLARE
  prev BYTEA;
BEGIN
  -- Find previous event hash for this batch
  SELECT event_hash INTO prev
  FROM batch_events
  WHERE batch_id = NEW.batch_id
  ORDER BY event_time DESC, id DESC
  LIMIT 1;

  NEW.prev_event_hash := prev;

  NEW.event_hash := digest(
    concat_ws('|',
      NEW.batch_id::text,
      NEW.event_type::text,
      NEW.actor_id::text,
      NEW.event_time::text,
      coalesce(NEW.details::text,''),
      coalesce(encode(NEW.prev_event_hash,'hex'),'')
    ),
    'sha256'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for batch_events
CREATE TRIGGER t_batch_event_hash
BEFORE INSERT ON batch_events
FOR EACH ROW EXECUTE FUNCTION set_batch_event_hash();


CREATE OR REPLACE FUNCTION set_package_event_hash()
RETURNS trigger AS $$
DECLARE
  prev BYTEA;
BEGIN
  SELECT event_hash INTO prev
  FROM package_events
  WHERE package_id = NEW.package_id
  ORDER BY event_time DESC, id DESC
  LIMIT 1;

  NEW.prev_event_hash := prev;

  NEW.event_hash := digest(
    concat_ws('|',
      NEW.package_id::text,
      NEW.event_type::text,
      NEW.actor_id::text,
      NEW.event_time::text,
      coalesce(NEW.details::text,''),
      coalesce(encode(NEW.prev_event_hash,'hex'),'')
    ),
    'sha256'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER t_package_event_hash
BEFORE INSERT ON package_events
FOR EACH ROW EXECUTE FUNCTION set_package_event_hash();


-- Enforce that no batch stock goes negative
CREATE OR REPLACE FUNCTION enforce_batch_stock(p_batch UUID, p_delta_g NUMERIC)
RETURNS VOID AS $$
DECLARE
  v_avail NUMERIC;
BEGIN
  SELECT qty_g_available
  INTO v_avail
  FROM batch_stock
  WHERE batch_id = p_batch
  FOR UPDATE;

  IF v_avail IS NULL THEN
    RAISE EXCEPTION 'Batch % has no stock record', p_batch;
  END IF;

  IF v_avail + p_delta_g < 0 THEN
    RAISE EXCEPTION 'Insufficient stock for batch % (need %, have %)',
      p_batch, -p_delta_g, v_avail;
  END IF;

  UPDATE batch_stock
  SET qty_g_available = v_avail + p_delta_g
  WHERE batch_id = p_batch;
END;
$$ LANGUAGE plpgsql;
