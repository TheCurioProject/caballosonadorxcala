-- Operational confirmation and completed payment notification are distinct states.
create table site.stripe_receipts(
 session_id text primary key,
 booking_id integer not null references site.reservas(id),
 processed_at timestamptz not null default now()
);
alter table site.stripe_receipts enable row level security;
create policy server_only on site.stripe_receipts for all to cala_site_app using(true) with check(true);
revoke all on site.stripe_receipts from public,anon,authenticated;
grant select,insert on site.stripe_receipts to cala_site_app;
