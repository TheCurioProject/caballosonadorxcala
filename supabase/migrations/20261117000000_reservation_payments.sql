-- Payments recorded on a reservation, like Smoobu's "Payment details" + prepayment box,
-- but with a full ledger:
--
-- * payments.concept  prepayment | payment | refund | deposit | deposit_return
--                     Prepayments and payments reduce the stay balance, refunds raise it,
--                     security deposits (and their return) are tracked apart.
-- * payments.note     free text (receipt number, bank reference...).
-- * payment.record / payment.update / payment.delete   (finance.write)
--   provider='manual', method_type = cash | transfer | card | stripe | paypal | ota | other.
--   Payments charged by Stripe on the website are locked: they cannot be edited or deleted.
-- * The website reservation (site.reservas.deposit_paid) follows the net amount paid, so
--   website invoices show the same figure as CALA.

alter table public.payments add column if not exists concept text not null default 'payment';
alter table public.payments add column if not exists note text not null default '';
alter table public.payments drop constraint if exists payments_concept_check;
alter table public.payments add constraint payments_concept_check
 check (concept in ('prepayment','payment','refund','deposit','deposit_return'));
alter table public.payments drop constraint if exists payments_note_check;
alter table public.payments add constraint payments_note_check check (char_length(note) <= 500);
-- Imported and website payments were prepayments (anticipos), unless they covered the whole stay.
update public.payments p set concept = 'prepayment'
 where p.concept = 'payment' and p.provider in ('smoobu_import','legacy_import','stripe')
   and p.amount_minor < (select r.total_minor from public.reservations r where r.id = p.reservation_id);

create or replace function pms_private.reservation_net_paid(rid uuid) returns bigint
language sql stable security definer set search_path='' as $$
 select coalesce(sum(case when concept in ('prepayment','payment') then amount_minor
                          when concept = 'refund' then -amount_minor else 0 end), 0)::bigint
 from public.payments where reservation_id = rid and status = 'succeeded';
$$;
revoke all on function pms_private.reservation_net_paid(uuid) from public, anon, authenticated;

create or replace function pms_private.sync_site_deposit(rid uuid) returns void
language plpgsql security definer set search_path='' as $$
declare sid integer; prior text;
begin
 select site_booking_id into sid from pms_private.site_booking_map where reservation_id = rid;
 if sid is null then return; end if;
 prior := current_setting('cala.bridge_origin', true);
 perform set_config('cala.bridge_origin', 'pms', true);
 update site.reservas set deposit_paid = greatest(pms_private.reservation_net_paid(rid), 0)::numeric / 100,
  updated_at = now() where id = sid;
 perform set_config('cala.bridge_origin', coalesce(prior, ''), true);
end $$;
revoke all on function pms_private.sync_site_deposit(uuid) from public, anon, authenticated;

alter function public.pms_command(jsonb, text) rename to pms_command_before_payments;
revoke all on function public.pms_command_before_payments(jsonb, text) from public, anon, authenticated;

create function public.pms_command(command jsonb, idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 kind text := command->>'type';
 org uuid; prop uuid; entity uuid; rid uuid; cached jsonb; message text;
 p public.payments; amount bigint; cur text; paid_on date; v_note text;
begin
 if kind is null or kind not in ('payment.record','payment.update','payment.delete') then
  return public.pms_command_before_payments(command, idempotency_key);
 end if;
 if auth.uid() is null then raise exception 'UNAUTHORIZED' using errcode = '42501'; end if;
 org := (command->>'organizationId')::uuid;
 prop := nullif(command->>'propertyId', '')::uuid;
 if prop is null then raise exception 'NOT_FOUND'; end if;
 perform pms_private.require_access(org, 'finance.write', prop);
 cached := pms_private.idempotency_start(org, idempotency_key, command);
 if cached is not null then return cached; end if;
 perform pg_advisory_xact_lock(hashtextextended(prop::text, 0));

 if kind in ('payment.record', 'payment.update') then
  if coalesce(command->>'concept', '') not in ('prepayment','payment','refund','deposit','deposit_return')
   or coalesce(command->>'method', '') not in ('cash','transfer','card','stripe','paypal','ota','other')
   or coalesce(command->>'status', '') not in ('succeeded','pending') then
   raise exception 'INVALID_PAYMENT';
  end if;
  amount := (command->>'amountMinor')::bigint;
  if amount is null or amount <= 0 or amount > 100000000000 then raise exception 'INVALID_AMOUNT'; end if;
  paid_on := (command->>'paidOn')::date;
  if paid_on is null then raise exception 'INVALID_PAYMENT'; end if;
  v_note := btrim(coalesce(command->>'note', ''));
  if char_length(v_note) > 500 then raise exception 'INVALID_PAYMENT'; end if;
 end if;

 if kind = 'payment.record' then
  rid := (command->>'reservationId')::uuid;
  select r.currency into cur from public.reservations r
   where r.id = rid and r.organization_id = org and r.property_id = prop;
  if not found then raise exception 'NOT_FOUND'; end if;
  entity := gen_random_uuid();
  insert into public.payments(id, organization_id, property_id, reservation_id, provider, provider_payment_id,
   amount_minor, currency, status, method_type, received_at, concept, note)
  values(entity, org, prop, rid, 'manual', entity::text, amount, cur, command->>'status', command->>'method',
   (paid_on + time '12:00') at time zone 'UTC', command->>'concept', v_note);
  message := 'Pago registrado';
 else
  entity := (command->>'id')::uuid;
  select * into p from public.payments where id = entity and organization_id = org and property_id = prop for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p.provider = 'stripe' then raise exception 'PAYMENT_PROVIDER_LOCKED'; end if;
  rid := p.reservation_id;
  if kind = 'payment.update' then
   update public.payments set amount_minor = amount, status = command->>'status', method_type = command->>'method',
    received_at = (paid_on + time '12:00') at time zone 'UTC', concept = command->>'concept', note = v_note
   where id = entity;
   message := 'Pago actualizado';
  else
   delete from public.payments where id = entity;
   message := 'Pago eliminado';
  end if;
 end if;

 perform pms_private.sync_site_deposit(rid);
 perform pms_private.audit(org, prop, kind, rid, idempotency_key,
  jsonb_build_object('message', message, 'paymentId', entity));
 return pms_private.idempotency_finish(org, idempotency_key, jsonb_build_object('id', entity, 'message', message));
end $$;
revoke all on function public.pms_command(jsonb, text) from public, anon;
grant execute on function public.pms_command(jsonb, text) to authenticated;
