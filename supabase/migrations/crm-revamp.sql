-- ============================================================
-- CRM REVAMP MIGRATION
-- 1. Room types (public-facing "rooms") pooling physical units
-- 2. Kaura: 24 single-room listings -> 1 property, 3 types x 8 units
-- 3. customer_rep role
-- 4. Booking card fields + payments ledger + price overrides
-- Run once in the Supabase SQL editor. Safe to re-run (idempotent).
-- ============================================================

-- 1. Room types: what the public site shows. Each pools many physical
--    units (rooms). A type is bookable while >= 1 unit is free.
CREATE TABLE IF NOT EXISTS room_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price_per_night NUMERIC NOT NULL,
    max_guests INT DEFAULT 2,
    images TEXT[] DEFAULT '{}',
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Physical units: rooms gain a type pointer + short unit code (A1..A8)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_type_id UUID REFERENCES room_types(id);
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS unit_code TEXT;

-- Old Kaura listing URLs keep working: soft-deleted duplicates point here
ALTER TABLE properties ADD COLUMN IF NOT EXISTS merged_into UUID REFERENCES properties(id);

-- 3. Roles: add customer_rep (full CRM control)
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check
    CHECK (role IN ('admin', 'owner', 'caretaker', 'call_operator', 'customer_rep'));

-- 4. Booking card fields (BedBooking-style)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS room_type_id UUID REFERENCES room_types(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS adults INT DEFAULT 1;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS children INT DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_id_type TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_id_number TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;

-- 5. Payments ledger: every naira received against a booking.
--    paid = sum(payments); balance = total_amount - paid.
CREATE TABLE IF NOT EXISTS booking_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    method TEXT,
    note TEXT,
    recorded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_booking_payments_booking ON booking_payments(booking_id);

-- 6. Date-range price overrides per room type (festive/weekend rates)
CREATE TABLE IF NOT EXISTS price_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    price_per_night NUMERIC NOT NULL,
    label TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_price_overrides_type ON price_overrides(room_type_id);

-- RLS
ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active room types" ON room_types;
CREATE POLICY "Public can read active room types" ON room_types
    FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Public can read price overrides" ON price_overrides;
CREATE POLICY "Public can read price overrides" ON price_overrides
    FOR SELECT USING (TRUE);
-- booking_payments: no public policies — service role (CRM APIs) only.

-- ============================================================
-- 7. KAURA CONSOLIDATION
--    24 "Single Room in Kaura" listings -> 1 canonical property with
--    3 room types (A/B/C) x 8 units each. Zero bookings exist for
--    Kaura in this DB, so this is a pure structural move.
-- ============================================================
DO $$
DECLARE
    canonical UUID;
    type_a UUID;
    type_b UUID;
    type_c UUID;
    unit RECORD;
    i INT := 0;
    tid UUID;
    code TEXT;
BEGIN
    SELECT id INTO canonical
    FROM properties
    WHERE area = 'Kaura' AND COALESCE(is_deleted, FALSE) = FALSE
    ORDER BY created_at ASC
    LIMIT 1;

    IF canonical IS NULL THEN
        RAISE NOTICE 'Kaura consolidation: no Kaura property found, skipping';
        RETURN;
    END IF;

    IF EXISTS (SELECT 1 FROM room_types WHERE property_id = canonical) THEN
        RAISE NOTICE 'Kaura consolidation: already migrated, skipping';
        RETURN;
    END IF;

    INSERT INTO room_types (property_id, name, description, price_per_night, max_guests, sort_order)
    VALUES (canonical, 'Standard Room — Balcony',
            'Standard room with front balcony, shared living room & kitchen space',
            35000, 2, 1)
    RETURNING id INTO type_a;

    INSERT INTO room_types (property_id, name, description, price_per_night, max_guests, sort_order)
    VALUES (canonical, 'Classic Room',
            'Cosy standard room with shared living room & kitchen space',
            30000, 2, 2)
    RETURNING id INTO type_b;

    INSERT INTO room_types (property_id, name, description, price_per_night, max_guests, sort_order)
    VALUES (canonical, 'Premium Room',
            'Larger premium room with balcony, shared living room & kitchen space',
            40000, 2, 3)
    RETURNING id INTO type_c;

    -- Move every Kaura unit under the canonical property, 8 per type,
    -- with unit codes A1..A8 / B1..B8 / C1..C8. Availability rows follow
    -- automatically (they reference room_id).
    FOR unit IN (
        SELECT r.id
        FROM rooms r
        JOIN properties p ON p.id = r.property_id
        WHERE p.area = 'Kaura'
        ORDER BY p.created_at ASC, r.created_at ASC
    ) LOOP
        IF i < 8 THEN
            tid := type_a; code := 'A' || (i + 1);
        ELSIF i < 16 THEN
            tid := type_b; code := 'B' || (i - 7);
        ELSE
            tid := type_c; code := 'C' || (i - 15);
        END IF;

        UPDATE rooms
        SET property_id = canonical,
            room_type_id = tid,
            unit_code = code,
            name = 'Unit ' || code,
            price_per_night = (SELECT price_per_night FROM room_types WHERE id = tid),
            is_active = TRUE
        WHERE id = unit.id;

        i := i + 1;
    END LOOP;

    RAISE NOTICE 'Kaura consolidation: % units assigned', i;

    -- Retire the 23 duplicate listings; keep their URLs redirecting
    UPDATE properties
    SET is_active = FALSE, is_deleted = TRUE, merged_into = canonical
    WHERE area = 'Kaura' AND id <> canonical;
END $$;
