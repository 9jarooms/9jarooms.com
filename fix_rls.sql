-- Drop existing policies causing recursion
DROP POLICY IF EXISTS "admin_read_all_roles" ON user_roles;
DROP POLICY IF EXISTS "users_read_own_roles" ON user_roles;
DROP POLICY IF EXISTS "admin_read_all_owners" ON owners;
DROP POLICY IF EXISTS "admin_read_all_properties" ON properties;
DROP POLICY IF EXISTS "admin_manage_all_rooms" ON rooms;
DROP POLICY IF EXISTS "admin_read_all_bookings" ON bookings;
DROP POLICY IF EXISTS "admin_manage_availability" ON availability;
DROP POLICY IF EXISTS "admin_read_all_transactions" ON transactions;
DROP POLICY IF EXISTS "admin_manage_caretakers" ON caretakers;
DROP POLICY IF EXISTS "admin_manage_conversations" ON conversations;

-- 1. Simple policy for user_roles (start here to break recursion)
-- Users can read their own role
CREATE POLICY "users_read_own_roles" ON user_roles 
FOR SELECT USING (auth.uid() = user_id);

-- 2. Admin policy WITHOUT recursion
-- Instead of querying user_roles table inside the policy for user_roles table (recursion),
-- we trust the JWT metadata if available, OR we make a direct check that doesn't trigger the same policy.
-- BUT Supabase RLS recursion usually happens when table A policy queries table A.
-- "admin_read_all_roles": (auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin'))
-- This query selects from user_roles, so it triggers "admin_read_all_roles" again -> Infinite Loop.

-- FIX: Use a SECURITY DEFINER function to check admin role, bypassing RLS.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Now use this function in policies
CREATE POLICY "admin_read_all_roles" ON user_roles 
FOR SELECT USING (is_admin());

CREATE POLICY "admin_read_all_owners" ON owners 
FOR SELECT USING (is_admin());

CREATE POLICY "admin_read_all_properties" ON properties 
FOR ALL USING (is_admin());

CREATE POLICY "admin_manage_all_rooms" ON rooms 
FOR ALL USING (is_admin());

CREATE POLICY "admin_read_all_bookings" ON bookings 
FOR ALL USING (is_admin());

CREATE POLICY "admin_manage_availability" ON availability 
FOR ALL USING (is_admin());

CREATE POLICY "admin_read_all_transactions" ON transactions 
FOR SELECT USING (is_admin());

CREATE POLICY "admin_manage_caretakers" ON caretakers 
FOR ALL USING (is_admin());

CREATE POLICY "admin_manage_conversations" ON conversations 
FOR ALL USING (is_admin());

