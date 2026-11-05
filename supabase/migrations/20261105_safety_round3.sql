-- Gap-hunt round 3
alter table bookings add column if not exists client_ip text;
create index if not exists bookings_client_ip_pending_idx on bookings (client_ip) where status = 'pending';
-- the public (not signed-in) key: active listings without the address, arrival instructions or owner
drop policy if exists public_read_active_properties on properties;
create policy public_read_active_properties on properties for select to anon using (is_active = true);
revoke select on properties from anon;
grant select (id, name, description, city, state, area, price_per_night, amenities, images, max_guests, check_in_time, check_out_time,
  house_rules, is_active, created_at, updated_at, type, videos, thumbnail, is_featured, category, minimum_stay, discount_rules,
  is_deleted, whole_apartment_price, two_bed_price, is_apartment, merged_into) on properties to anon;
-- signed-in customers: which nights are taken, never which booking holds them
revoke select on availability from authenticated;
grant select (id, room_id, date, status) on availability to authenticated;
