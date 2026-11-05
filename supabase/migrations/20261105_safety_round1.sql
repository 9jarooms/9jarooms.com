-- Gap-hunt round 1: audit trail, duplicate-submit protection, commission snapshots, payout history.

-- who did what to money and bookings (payment removed, cancel, total changed, commission actions)
create table if not exists audit_log (
    id uuid primary key default gen_random_uuid(),
    at timestamptz not null default now(),
    actor uuid references auth.users(id) on delete set null,
    booking_id uuid references bookings(id) on delete set null,
    action text not null,
    detail jsonb
);
create index if not exists audit_log_booking_idx on audit_log (booking_id, at desc);
alter table audit_log enable row level security;

-- a phone that loses signal and taps again must not create a second booking or payment
alter table bookings add column if not exists client_request_id text;
create unique index if not exists bookings_client_request_uidx on bookings (client_request_id) where client_request_id is not null;
alter table booking_payments add column if not exists client_request_id text;
create unique index if not exists booking_payments_client_request_uidx on booking_payments (client_request_id) where client_request_id is not null;
-- the same Paystack payment is written to the ledger once, whoever confirms it first
alter table booking_payments add column if not exists paystack_reference text;
create unique index if not exists booking_payments_paystack_ref_uidx on booking_payments (paystack_reference) where paystack_reference is not null;

-- the commission amount management verified (later edits to the stay reset the check)
alter table bookings add column if not exists commission_amount numeric;

-- payouts: several per month allowed (a top-up after late verifications), never lost with an account
alter table commission_payouts drop constraint if exists commission_payouts_user_id_month_key;
alter table commission_payouts drop constraint if exists commission_payouts_user_id_fkey;
alter table commission_payouts add constraint commission_payouts_user_id_fkey foreign key (user_id) references auth.users(id) on delete restrict;
