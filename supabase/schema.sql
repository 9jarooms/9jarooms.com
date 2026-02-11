-- ============================================
-- 9jaRooms Database Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- OWNERS
-- Property owners with Paystack sub-accounts
-- ============================================
CREATE TABLE owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  paystack_subaccount_code TEXT, -- Paystack sub-account for receiving payments
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CARETAKERS
-- Linked to Supabase Auth users
-- ============================================
CREATE TABLE caretakers (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROPERTIES
-- Serviced apartments / short-let listings
-- ============================================
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  caretaker_id UUID REFERENCES caretakers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  city TEXT DEFAULT 'Lagos',
  state TEXT DEFAULT 'Lagos',
  area TEXT, -- e.g. "Lekki", "Victoria Island", "Ikoyi"
  price_per_night NUMERIC NOT NULL DEFAULT 0,
  amenities TEXT[] DEFAULT '{}',
  images TEXT[] DEFAULT '{}',
  max_guests INT DEFAULT 2,
  check_in_time TEXT DEFAULT '2:00 PM',
  check_out_time TEXT DEFAULT '11:00 AM',
  check_in_instructions TEXT, -- Door codes, directions, etc.
  house_rules TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROOMS
-- Bookable units within a property
-- ============================================
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g. "Room 1", "Studio A", "Entire Apartment"
  description TEXT,
  price_per_night NUMERIC, -- Override property price if set
  max_guests INT DEFAULT 2,
  images TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BOOKINGS
-- Guest reservations
-- ============================================
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL if anonymous
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  nights INT NOT NULL,
  price_per_night NUMERIC NOT NULL,
  total_amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, paid, cancelled, completed, expired
  paystack_reference TEXT,
  paystack_access_code TEXT,
  paystack_authorization_url TEXT,
  expires_at TIMESTAMPTZ, -- 30 min after creation
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AVAILABILITY
-- Per-room per-date status tracking
-- ============================================
CREATE TABLE availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT DEFAULT 'available', -- available, held, booked, cleaning, maintenance
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  UNIQUE(room_id, date)
);

-- ============================================
-- TRANSACTIONS
-- Paystack webhook log
-- ============================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paystack_reference TEXT UNIQUE NOT NULL,
  paystack_event TEXT NOT NULL, -- e.g. 'charge.success'
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'NGN',
  status TEXT NOT NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONVERSATIONS
-- ManyChat / WhatsApp chat log for AI agent
-- ============================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL DEFAULT 'whatsapp', -- whatsapp, instagram
  external_id TEXT, -- ManyChat subscriber ID
  guest_name TEXT,
  guest_phone TEXT,
  guest_email TEXT,
  messages JSONB DEFAULT '[]'::jsonb,
  context JSONB DEFAULT '{}'::jsonb, -- AI agent memory/context
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_properties_owner ON properties(owner_id);
CREATE INDEX idx_properties_caretaker ON properties(caretaker_id);
CREATE INDEX idx_properties_city ON properties(city);
CREATE INDEX idx_properties_area ON properties(area);
CREATE INDEX idx_rooms_property ON rooms(property_id);
CREATE INDEX idx_bookings_room ON bookings(room_id);
CREATE INDEX idx_bookings_property ON bookings(property_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_paystack_ref ON bookings(paystack_reference);
CREATE INDEX idx_bookings_expires_at ON bookings(expires_at);
CREATE INDEX idx_availability_room_date ON availability(room_id, date);
CREATE INDEX idx_availability_status ON availability(status);
CREATE INDEX idx_transactions_reference ON transactions(paystack_reference);
CREATE INDEX idx_conversations_external ON conversations(external_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE caretakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Caretakers can read their own profile
CREATE POLICY "caretakers_read_own" ON caretakers
  FOR SELECT USING (auth.uid() = id);

-- Caretakers can read properties assigned to them
CREATE POLICY "caretakers_read_properties" ON properties
  FOR SELECT USING (caretaker_id = auth.uid());

-- Caretakers can update their properties
CREATE POLICY "caretakers_update_properties" ON properties
  FOR UPDATE USING (caretaker_id = auth.uid());

-- Caretakers can read rooms for their properties
CREATE POLICY "caretakers_read_rooms" ON rooms
  FOR SELECT USING (
    property_id IN (SELECT id FROM properties WHERE caretaker_id = auth.uid())
  );

-- Caretakers can read bookings for their properties
CREATE POLICY "caretakers_read_bookings" ON bookings
  FOR SELECT USING (
    property_id IN (SELECT id FROM properties WHERE caretaker_id = auth.uid())
  );

-- Public read access for active properties (guest website)
CREATE POLICY "public_read_active_properties" ON properties
  FOR SELECT USING (is_active = TRUE);

-- Public read access for active rooms
CREATE POLICY "public_read_active_rooms" ON rooms
  FOR SELECT USING (is_active = TRUE);

-- Public read availability
CREATE POLICY "public_read_availability" ON availability
  FOR SELECT USING (TRUE);

-- Service role can do everything (API routes use service role key)
-- This is handled automatically by Supabase when using service_role key

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER owners_updated_at BEFORE UPDATE ON owners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER caretakers_updated_at BEFORE UPDATE ON caretakers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER properties_updated_at BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER rooms_updated_at BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
