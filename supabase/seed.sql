-- ============================================
-- 9jaRooms Seed Data (Updated with Roles)
-- Run this AFTER the schema AND migration-roles.sql
-- ============================================

-- Note: You must first create auth users in Supabase Dashboard or via API
-- The UUIDs below are placeholders — replace them with real auth user IDs

-- ============================================
-- STEP 1: Create admin account
-- Do this in Supabase Dashboard > Authentication > Users > Add User
-- Email: admin@9jarooms.com, Password: your-strong-password
-- Then replace the UUID below with the created user's ID
-- ============================================

-- Admin role (replace UUID with real admin auth user ID)
-- INSERT INTO user_roles (user_id, role) VALUES ('REPLACE_WITH_ADMIN_AUTH_ID', 'admin');

-- ============================================
-- STEP 2: Owners (these are data records, not auth users yet)
-- Create owner auth accounts separately, then link with user_id
-- ============================================
INSERT INTO owners (id, name, email, phone, paystack_subaccount_code) VALUES
  ('a1b2c3d4-0001-4000-a000-000000000001', 'Chinedu Okafor', 'chinedu@9jarooms.com', '+2348012345678', 'ACCT_test_owner1'),
  ('a1b2c3d4-0002-4000-a000-000000000002', 'Aisha Bello', 'aisha@9jarooms.com', '+2348023456789', 'ACCT_test_owner2')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 3: Properties
-- ============================================
INSERT INTO properties (id, owner_id, name, description, address, city, area, price_per_night, amenities, images, max_guests, check_in_instructions, house_rules) VALUES
  (
    'b1b2c3d4-0001-4000-b000-000000000001',
    'a1b2c3d4-0001-4000-a000-000000000001',
    'Lekki Luxury Studio',
    'A beautifully designed studio apartment in the heart of Lekki Phase 1. Perfect for business travelers and couples looking for a comfortable short stay in Lagos.',
    '12 Admiralty Way, Lekki Phase 1',
    'Lagos',
    'Lekki',
    45000,
    ARRAY['WiFi', 'AC', 'Smart TV', 'Kitchen', 'Parking', 'Security', 'Power Backup'],
    ARRAY['/images/placeholder-1.jpg'],
    2,
    'Gate code: 1234. Take the elevator to the 3rd floor, apartment 3B. Key is in the lockbox beside the door, code 5678.',
    'No smoking. No parties. Quiet hours after 10 PM. Maximum 2 guests.'
  ),
  (
    'b1b2c3d4-0002-4000-b000-000000000002',
    'a1b2c3d4-0001-4000-a000-000000000001',
    'Victoria Island 2-Bedroom',
    'Spacious 2-bedroom apartment on Victoria Island with ocean views. Walking distance to restaurants and nightlife. Ideal for families or groups.',
    '5 Adeola Odeku Street, Victoria Island',
    'Lagos',
    'Victoria Island',
    75000,
    ARRAY['WiFi', 'AC', 'Smart TV', 'Kitchen', 'Pool', 'Gym', 'Parking', 'Security', 'Power Backup', 'Balcony'],
    ARRAY['/images/placeholder-2.jpg'],
    4,
    'Meet the caretaker at the reception. Call +2348012345678 when you arrive. Have your booking confirmation ready.',
    'No smoking indoors. No pets. Maximum 4 guests. Keep common areas clean.'
  ),
  (
    'b1b2c3d4-0003-4000-b000-000000000003',
    'a1b2c3d4-0002-4000-a000-000000000002',
    'Ikoyi Shared Apartment',
    'Modern shared apartment in Ikoyi with 3 individually bookable rooms. Shared living room and kitchen. Great for solo travelers.',
    '8 Bourdillon Road, Ikoyi',
    'Lagos',
    'Ikoyi',
    35000,
    ARRAY['WiFi', 'AC', 'Shared Kitchen', 'Shared Living Room', 'Security', 'Power Backup'],
    ARRAY['/images/placeholder-3.jpg'],
    6,
    'The caretaker will meet you at the gate. WhatsApp +2348023456789 on arrival.',
    'Shared spaces — please be respectful. No loud music after 9 PM. Clean up after yourself.'
  ),
  (
    'b1b2c3d4-0004-4000-b000-000000000004',
    'a1b2c3d4-0002-4000-a000-000000000002',
    'Surulere Budget Studio',
    'Clean and affordable studio apartment in Surulere. Basic amenities with reliable power and internet. Perfect for budget-conscious travelers.',
    '15 Bode Thomas Street, Surulere',
    'Lagos',
    'Surulere',
    20000,
    ARRAY['WiFi', 'AC', 'TV', 'Security', 'Power Backup'],
    ARRAY['/images/placeholder-4.jpg'],
    2,
    'Key collection from the building manager on the ground floor. Show your booking confirmation.',
    'No smoking. No parties. Checkout by 11 AM sharp.'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 4: Rooms
-- ============================================
-- Lekki Luxury Studio (1 room)
INSERT INTO rooms (id, property_id, name, description, price_per_night, max_guests) VALUES
  ('c1b2c3d4-0001-4000-c000-000000000001', 'b1b2c3d4-0001-4000-b000-000000000001', 'Entire Studio', 'The full studio apartment', 45000, 2)
ON CONFLICT (id) DO NOTHING;

-- Victoria Island 2-Bedroom (1 room)
INSERT INTO rooms (id, property_id, name, description, price_per_night, max_guests) VALUES
  ('c1b2c3d4-0002-4000-c000-000000000002', 'b1b2c3d4-0002-4000-b000-000000000002', 'Entire Apartment', 'Full 2-bedroom apartment', 75000, 4)
ON CONFLICT (id) DO NOTHING;

-- Ikoyi Shared Apartment (3 rooms)
INSERT INTO rooms (id, property_id, name, description, price_per_night, max_guests) VALUES
  ('c1b2c3d4-0003-4000-c000-000000000003', 'b1b2c3d4-0003-4000-b000-000000000003', 'Room A', 'Cozy room with queen bed and private bathroom', 35000, 2),
  ('c1b2c3d4-0004-4000-c000-000000000004', 'b1b2c3d4-0003-4000-b000-000000000003', 'Room B', 'Spacious room with double bed', 30000, 2),
  ('c1b2c3d4-0005-4000-c000-000000000005', 'b1b2c3d4-0003-4000-b000-000000000003', 'Room C', 'Budget-friendly single room', 25000, 1)
ON CONFLICT (id) DO NOTHING;

-- Surulere Budget Studio (1 room)
INSERT INTO rooms (id, property_id, name, description, price_per_night, max_guests) VALUES
  ('c1b2c3d4-0006-4000-c000-000000000006', 'b1b2c3d4-0004-4000-b000-000000000004', 'Entire Studio', 'The full studio apartment', 20000, 2)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 5: Link users to roles and profiles
-- After creating auth users in Supabase Dashboard:
--
-- 1. Create admin user → copy UUID → run:
--    INSERT INTO user_roles (user_id, role) VALUES ('UUID', 'admin');
--
-- 2. Create owner users → copy UUIDs → run:
--    INSERT INTO user_roles (user_id, role) VALUES ('UUID', 'owner');
--    UPDATE owners SET user_id = 'UUID' WHERE email = 'owner@email.com';
--
-- 3. Create caretaker users → copy UUIDs → run:
--    INSERT INTO user_roles (user_id, role) VALUES ('UUID', 'caretaker');
--    INSERT INTO caretakers (id, name, email, phone) VALUES ('UUID', 'Name', 'email', 'phone');
--    UPDATE properties SET caretaker_id = 'UUID' WHERE id = 'property-id';
-- ============================================
