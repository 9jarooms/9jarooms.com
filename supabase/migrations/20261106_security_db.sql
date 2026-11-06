-- Security review: storage, write access, owner reads, settings.

-- property-media: only staff and owners can add files, nobody can overwrite or list through the API
drop policy if exists "Auth Update" on storage.objects;
drop policy if exists "Auth Upload" on storage.objects;
drop policy if exists "Public Access" on storage.objects;
create policy staff_upload_property_media on storage.objects for insert to authenticated
with check (bucket_id = 'property-media' and exists (select 1 from public.user_roles r
  where r.user_id = auth.uid() and r.role in ('admin', 'customer_rep', 'caretaker', 'call_operator', 'owner')));
update storage.buckets set file_size_limit = 104857600,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/quicktime','video/webm']
where id = 'property-media';

-- no direct writes for the public or signed-in users: every change goes through the app's checked APIs
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon, authenticated;
revoke select on audit_log, booking_payments, booking_rooms, bookings, caretakers, commission_payouts, conversations,
  crm_booking_sources, crm_bookings, crm_properties, messages, owners, property_events, push_subscriptions,
  telegram_connect_tokens, transactions, user_roles from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;

-- owners read through the server (only what their screens show), never raw guest IDs or payment data
drop policy if exists owners_read_own_bookings on bookings;
drop policy if exists owners_read_own_transactions on transactions;

-- public settings: only what the public pages need
drop policy if exists public_read_settings on site_settings;
create policy public_read_settings on site_settings for select
using (key in ('contact_phone', 'contact_whatsapp', 'category_thumbnails'));

alter function public.is_admin() set search_path = public;

-- rules that look at owners / caretakers only apply to signed-in users (the public role has no access to those)
alter policy owners_read_owned_properties on properties to authenticated;
alter policy caretakers_read_properties on properties to authenticated;
alter policy caretakers_read_assigned_properties on properties to authenticated;
alter policy caretakers_read_bookings on bookings to authenticated;
