-- ============================================
-- Migration: Add Role System
-- Run this in your Supabase SQL editor
-- ============================================

-- User roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'owner', 'caretaker')),
  UNIQUE(user_id, role)
);

-- Add user_id column to owners (links owner to auth account)
ALTER TABLE owners ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Index for fast role lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
CREATE INDEX IF NOT EXISTS idx_owners_user ON owners(user_id);

-- RLS for user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Admin can read all roles
CREATE POLICY "admin_read_all_roles" ON user_roles
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
  );

-- Users can read their own roles
CREATE POLICY "users_read_own_roles" ON user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Admin RLS policies for full access
-- Admin can read all owners
CREATE POLICY "admin_read_all_owners" ON owners
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
  );

-- Owners can read their own record
CREATE POLICY "owners_read_own" ON owners
  FOR SELECT USING (user_id = auth.uid());

-- Admin can read all properties
CREATE POLICY "admin_read_all_properties" ON properties
  FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
  );

-- Admin can manage all rooms
CREATE POLICY "admin_manage_all_rooms" ON rooms
  FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
  );

-- Admin can read all bookings
CREATE POLICY "admin_read_all_bookings" ON bookings
  FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
  );

-- Admin can manage all availability
CREATE POLICY "admin_manage_availability" ON availability
  FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
  );

-- Owner can read bookings for their properties
CREATE POLICY "owners_read_own_bookings" ON bookings
  FOR SELECT USING (
    property_id IN (SELECT id FROM properties WHERE owner_id IN (SELECT id FROM owners WHERE user_id = auth.uid()))
  );

-- Owner can read transactions for their bookings
CREATE POLICY "admin_read_all_transactions" ON transactions
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
  );

CREATE POLICY "owners_read_own_transactions" ON transactions
  FOR SELECT USING (
    booking_id IN (
      SELECT id FROM bookings WHERE property_id IN (
        SELECT id FROM properties WHERE owner_id IN (
          SELECT id FROM owners WHERE user_id = auth.uid()
        )
      )
    )
  );

-- Admin can manage caretakers
CREATE POLICY "admin_manage_caretakers" ON caretakers
  FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
  );

-- Admin can manage conversations
CREATE POLICY "admin_manage_conversations" ON conversations
  FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
  );
