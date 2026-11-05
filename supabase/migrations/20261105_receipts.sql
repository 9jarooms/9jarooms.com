-- Optional receipt photo on a payment (transfer screenshot, POS slip). Private bucket: only the
-- server hands out short-lived links to staff.
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict (id) do nothing;
alter table booking_payments add column if not exists receipt_path text;
