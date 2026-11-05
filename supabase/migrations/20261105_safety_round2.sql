-- Gap-hunt round 2
-- the bank's reference for a transfer: the same transfer can never be recorded twice
alter table booking_payments add column if not exists reference text;
create unique index if not exists booking_payments_reference_uidx on booking_payments (lower(reference)) where reference is not null;
-- one charge.success log per Paystack payment, even if the webhook and the guest's page arrive together
delete from transactions a using transactions b
  where a.paystack_reference = b.paystack_reference and a.paystack_event = b.paystack_event and a.ctid > b.ctid;
create unique index if not exists transactions_ref_event_uidx on transactions (paystack_reference, paystack_event);
-- how long a website card payment has been given extra time while Paystack says it is still going
alter table bookings add column if not exists hold_extended_at timestamptz;
-- the public (not signed in) key can read which nights are taken, never which booking holds them
revoke select on availability from anon;
grant select (id, room_id, date, status) on availability to anon;
