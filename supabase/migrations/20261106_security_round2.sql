-- Security review, round 2
-- What the guest's Paystack link asked for, so a total changed afterwards cannot cancel a guest who paid it.
alter table bookings add column if not exists link_amount numeric;

-- Listing photos: staff only (owners only read, the operator role is retired), images up to 15 MB
drop policy if exists staff_upload_property_media on storage.objects;
create policy staff_upload_property_media on storage.objects for insert to authenticated
  with check (bucket_id = 'property-media' and exists (select 1 from user_roles r where r.user_id = auth.uid() and r.role in ('admin', 'customer_rep', 'caretaker')));
update storage.buckets set file_size_limit = 15728640, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif'] where id = 'property-media';

-- New database functions are not callable by the public unless granted on purpose
alter default privileges in schema public revoke execute on functions from public, anon;
