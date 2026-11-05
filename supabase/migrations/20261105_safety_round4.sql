-- Gap-hunt round 4: refunds due, summed in the database
create or replace function refunds_due(prop_ids uuid[])
returns table (booking_id uuid, paid numeric)
language sql stable security definer set search_path = public as $$
    select b.id, sum(p.amount)
    from bookings b join booking_payments p on p.booking_id = b.id
    where b.property_id = any(prop_ids)
    group by b.id, b.status, b.total_amount
    having sum(p.amount) > (case when b.status in ('cancelled', 'no_show', 'expired') then 0 else b.total_amount end) + 1
$$;
revoke execute on function refunds_due(uuid[]) from public, anon, authenticated;
-- every staff change goes through the app's checked APIs: no direct database writes for caretakers
drop policy if exists caretakers_update_properties on properties;
