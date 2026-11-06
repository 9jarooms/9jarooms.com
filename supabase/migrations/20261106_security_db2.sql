-- Signing someone out everywhere (password reset, removed staff). Server only.
create or replace function public.revoke_user_sessions(target uuid) returns void
language sql security definer set search_path = auth, public as $$
    delete from auth.sessions where user_id = target;
$$;
revoke execute on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;

-- keep only what is needed to reconcile payments (full details stay in the Paystack dashboard)
update transactions set raw_payload = jsonb_build_object('reference', raw_payload->'reference', 'amount', raw_payload->'amount', 'currency', raw_payload->'currency',
    'status', raw_payload->'status', 'channel', raw_payload->'channel', 'paid_at', raw_payload->'paid_at', 'gateway_response', raw_payload->'gateway_response')
where raw_payload is not null;

-- upload limits on the other buckets
update storage.buckets set file_size_limit = 104857600, allowed_mime_types = array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm','application/pdf'] where id = 'public-assets';
update storage.buckets set file_size_limit = 10485760, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'] where id = 'receipts';
-- bookings: reads go through the server only
drop policy if exists caretakers_read_bookings on bookings;
