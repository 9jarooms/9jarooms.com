-- Fix for "infinite recursion detected" error in RLS policies
-- The previous "admin_read_all_roles" policy caused a loop because it queried user_roles table
-- while checking permissions for user_roles table.

-- 1. Create a secure function to check admin privileges
-- "SECURITY DEFINER" means this function runs with the privileges of the creator (superuser)
-- allowing it to bypass RLS and avoid the recursion loop.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- 2. Drop the problematic recursive policies
DROP POLICY IF EXISTS "admin_read_all_roles" ON user_roles;
DROP POLICY IF EXISTS "admin_read_all_owners" ON owners;
DROP POLICY IF EXISTS "admin_read_all_properties" ON properties;
DROP POLICY IF EXISTS "admin_manage_all_rooms" ON rooms;
DROP POLICY IF EXISTS "admin_read_all_bookings" ON bookings;
DROP POLICY IF EXISTS "admin_manage_availability" ON availability;
DROP POLICY IF EXISTS "admin_read_all_transactions" ON transactions;
DROP POLICY IF EXISTS "admin_manage_caretakers" ON caretakers;
DROP POLICY IF EXISTS "admin_manage_conversations" ON conversations;

-- 3. Re-create the admin policy on user_roles using the secure function
CREATE POLICY "admin_read_all_roles" ON user_roles
  FOR SELECT
  USING (is_admin());

-- 4. Re-apply Admin policies using the new helper ( cleaner and safer )
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
