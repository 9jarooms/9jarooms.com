-- Commission tracking (1.5% per closed booking, from 1 Nov 2026) and live screen updates.

-- who took the booking on the platform (staff user); null for website guests and blocks
alter table bookings add column if not exists created_by uuid references auth.users(id) on delete set null;
-- management's check of each commission line: null = not checked yet
alter table bookings add column if not exists commission_status text check (commission_status in ('verified', 'rejected'));
alter table bookings add column if not exists commission_checked_by uuid references auth.users(id) on delete set null;
alter table bookings add column if not exists commission_checked_at timestamptz;
create index if not exists bookings_created_by_idx on bookings (created_by, created_at);

-- month-end payouts (one per staff member per month)
create table if not exists commission_payouts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    month text not null check (month ~ '^\d{4}-\d{2}$'),
    amount numeric not null,
    paid_at timestamptz not null default now(),
    paid_by uuid references auth.users(id) on delete set null,
    note text,
    unique (user_id, month)
);
alter table commission_payouts enable row level security;

-- staff bookings taken since 1 Nov already carry the staff member in user_id
update bookings b set created_by = b.user_id
where b.created_by is null and b.created_at >= '2026-11-01' and b.user_id is not null
  and exists (select 1 from user_roles r where r.user_id = b.user_id and r.role in ('admin', 'customer_rep', 'caretaker', 'call_operator'))
  and coalesce(b.notes, '') <> 'Blocked for Maintenance';

-- Live updates: one public row that changes whenever bookings, nights or payments change.
-- Screens listen to it (no guest data goes over the socket) and reload what they show.
create table if not exists ops_pulse (id int primary key, changed_at timestamptz not null default now(), what text);
insert into ops_pulse (id) values (1) on conflict do nothing;
alter table ops_pulse enable row level security;
drop policy if exists ops_pulse_read on ops_pulse;
create policy ops_pulse_read on ops_pulse for select using (true);

create or replace function bump_ops_pulse() returns trigger language plpgsql security definer set search_path = public as $$
begin
    update ops_pulse set changed_at = now(), what = TG_TABLE_NAME where id = 1;
    return null;
end $$;

drop trigger if exists ops_pulse_bookings on bookings;
create trigger ops_pulse_bookings after insert or update or delete on bookings for each statement execute function bump_ops_pulse();
drop trigger if exists ops_pulse_availability on availability;
create trigger ops_pulse_availability after insert or update or delete on availability for each statement execute function bump_ops_pulse();
drop trigger if exists ops_pulse_payments on booking_payments;
create trigger ops_pulse_payments after insert or update or delete on booking_payments for each statement execute function bump_ops_pulse();

do $$ begin
    alter publication supabase_realtime add table ops_pulse;
exception when duplicate_object then null; end $$;
