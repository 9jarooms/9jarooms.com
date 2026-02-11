-- ============================================
-- Fix: RLS Policies for Dashboard Access
-- Run this in your Supabase SQL editor
-- ============================================

-- 1. Enable Caretakers to view their assigned properties
-- This allows them to see the property name in lists and details
DROP POLICY IF EXISTS "caretakers_read_assigned_properties" ON properties;
CREATE POLICY "caretakers_read_assigned_properties" ON properties
  FOR SELECT USING (
    caretaker_id = auth.uid()
  );

-- 2. Enable Owners to view their owned properties
-- (Properties link to owners.id, owners link to auth.users.id via user_id)
DROP POLICY IF EXISTS "owners_read_owned_properties" ON properties;
CREATE POLICY "owners_read_owned_properties" ON properties
  FOR SELECT USING (
    owner_id IN (
      SELECT id FROM owners WHERE user_id = auth.uid()
    )
  );

-- 3. Enable Owners to view rooms in their properties
-- (Currently missing, only public active rooms were visible)
DROP POLICY IF EXISTS "owners_read_owned_rooms" ON rooms;
CREATE POLICY "owners_read_owned_rooms" ON rooms
  FOR SELECT USING (
    property_id IN (
      SELECT id FROM properties WHERE owner_id IN (
        SELECT id FROM owners WHERE user_id = auth.uid()
      )
    )
  );

-- Note: Caretakers already had a room policy in migration-roles.sql ("caretakers_read_rooms"), so we don't need to add it again unless it was missing.
