-- Discount coupons for the public website, managed in CALA ("Cupones").
-- The guest types the code in the booking summary; the server validates it and
-- Stripe applies the discount to the payment (each coupon is mirrored as a
-- Stripe coupon). Redemptions are counted when the payment is confirmed.
create table site.coupons(
 id integer generated always as identity primary key,
 code text not null check(code ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'),
 description text check(description is null or length(description)<=300),
 discount_type text not null check(discount_type in ('percent','fixed')),
 value numeric(12,2) not null check(value>0 and (discount_type<>'percent' or value<=100)),
 min_total numeric(12,2) not null default 0 check(min_total>=0),
 valid_from date,
 valid_until date,
 max_redemptions integer check(max_redemptions is null or max_redemptions>0),
 is_active boolean not null default true,
 stripe_coupon_id text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(valid_from is null or valid_until is null or valid_until>=valid_from)
);
create unique index coupons_code_key on site.coupons(code);

-- One row per checkout that used a coupon. `code` is kept so the history
-- survives the deletion of the coupon.
create table site.coupon_redemptions(
 id bigint generated always as identity primary key,
 coupon_id integer references site.coupons(id) on delete set null,
 code text not null,
 booking_id integer references site.reservas(id) on delete set null,
 session_id text not null unique,
 status text not null default 'pending' check(status in ('pending','paid','expired')),
 discount_minor bigint check(discount_minor is null or discount_minor>=0),
 created_at timestamptz not null default now(),
 paid_at timestamptz
);
create index coupon_redemptions_coupon on site.coupon_redemptions(coupon_id,status);

do $$ declare tab text; begin
 for tab in select unnest(array['coupons','coupon_redemptions']) loop
  execute format('alter table site.%I enable row level security',tab);
  execute format('create policy server_only on site.%I for all to cala_site_app using (true) with check (true)',tab);
  execute format('revoke all on site.%I from public,anon,authenticated',tab);
  execute format('grant select,insert,update,delete on site.%I to cala_site_app',tab);
 end loop;
end $$;
