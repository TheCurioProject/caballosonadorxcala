-- Reservation trash (papelera).
--  * reservation.delete  → the stay is cancelled (frees CALA, website and preparation nights with the
--    existing machinery) and parked here for 10 days with the status it had.
--  * reservation.restore → back to that status, only if the dates are still free.
--  * reservation.purge   → deleted for good now; otherwise the cron does it once purge_after passes.
-- A trashed stay that something else revives (e.g. the guest pays a website checkout) leaves the trash.

create table public.reservation_trash(
 reservation_id uuid primary key references public.reservations(id),
 organization_id uuid not null,
 property_id uuid not null,
 previous_status text not null check(previous_status in ('draft','pending','confirmed','checked_in','checked_out','cancelled','no_show')),
 previous_cancelled_at timestamptz,
 site_payment_status text,
 deleted_by uuid,
 deleted_at timestamptz not null default now(),
 purge_after timestamptz not null default now()+interval '10 days',
 foreign key(organization_id,property_id) references public.properties(organization_id,id)
);
create index reservation_trash_purge on public.reservation_trash(purge_after);
alter table public.reservation_trash enable row level security;
create policy reservation_trash_read on public.reservation_trash for select to authenticated
 using(pms_private.can_access(organization_id,'reservation.read',property_id));
grant select on public.reservation_trash to authenticated;

-- Moving a stay to or from the trash is not a cancellation/new booking anyone must be alerted about,
-- and must not run "reservation.cancelled" automation rules.
create or replace function pms_private.reservation_event() returns trigger language plpgsql security definer set search_path='' as $$
declare ev text;begin
 if coalesce(current_setting('cala.trash',true),'')='on' then return null;end if;
 if tg_op='INSERT' then
  -- A website checkout is "pending" until Stripe pays; it is announced when it becomes confirmed.
  if new.status='confirmed' or (new.status='pending' and new.source<>'website') then ev:='reservation.created';end if;
 elsif old.status is distinct from new.status then
  ev:=case
   when new.status='confirmed' and old.status in ('draft','pending') then 'reservation.created'
   -- An abandoned website checkout expiring is not a cancellation anyone needs to hear about.
   when new.status='cancelled' and old.status<>'draft' and not (old.status='pending' and new.source='website') then 'reservation.cancelled'
   when new.status='checked_in' then 'checkin.completed'
   when new.status='checked_out' then 'checkout.completed'
  end;
 end if;
 if ev is null or new.departure_date<current_date-1 then return null;end if;
 -- Notifications never block the reservation write itself.
 begin
  perform pms_private.reservation_notify(new.id,ev);
 exception when others then
  raise warning 'CALA notification for reservation % failed: %',new.id,sqlerrm;
 end;
 return null;
end $$;

-- Deletes one stay and everything that only exists because of it. The guest profile and the audit
-- trail stay. Callers hold the property lock.
create function pms_private.purge_reservation(rid uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.reservations;link pms_private.site_booking_map;prior text:=current_setting('cala.bridge_origin',true);begin
 select * into r from public.reservations where id=rid for update;
 if not found then delete from public.reservation_trash where reservation_id=rid;return;end if;
 select * into link from pms_private.site_booking_map where reservation_id=rid;
 -- 'pms' keeps the CALA↔website mirrors quiet: the website booking is removed explicitly below.
 perform set_config('cala.bridge_origin','pms',true);
 perform set_config('cala.trash','on',true);
 delete from public.payments where reservation_id=rid;
 if link.site_booking_id is not null then
  delete from site.integration_alerts where booking_id=link.site_booking_id;
  delete from site.stripe_receipts where booking_id=link.site_booking_id;
  -- Cascades to extras, lodging choice, retreat seat and the booking map.
  delete from site.reservas where id=link.site_booking_id;
  perform set_config('cala.bridge_origin','pms',true);
  delete from public.inventory_blocks where id=link.buffer_id;
 end if;
 delete from public.folio_items where folio_id in (select f.id from public.folios f where f.reservation_id=rid);
 delete from public.folios where reservation_id=rid;
 delete from public.guest_mail_deliveries where reservation_id=rid;
 delete from public.message_entries where reservation_id=rid;
 delete from public.conversations where reservation_id=rid;
 delete from public.reservation_notes where reservation_id=rid;
 delete from public.reservation_guests where reservation_id=rid;
 delete from public.reservation_units where reservation_id=rid;
 delete from public.reservation_trash where reservation_id=rid;
 delete from public.reservations where id=rid;
 perform pms_private.recalculate(r.property_id,r.arrival_date,r.departure_date+1);
 insert into public.audit_logs(organization_id,property_id,actor_type,actor_id,action,entity_type,entity_id,request_id,after_json)
 values(r.organization_id,r.property_id,case when auth.uid() is null then 'system' else 'user' end,auth.uid(),'reservation.purge','reservation',rid,
  'trash:'||rid,jsonb_build_object('confirmationCode',r.confirmation_code,'arrival',r.arrival_date,'departure',r.departure_date));
 perform set_config('cala.trash','',true);
 perform set_config('cala.bridge_origin',coalesce(prior,''),true);
end $$;

-- Empties what is due. A stay revived meanwhile (no longer cancelled/no-show) simply leaves the trash.
create function pms_private.purge_due_trash(org uuid default null,max_items integer default 50) returns integer language plpgsql security definer set search_path='' as $$
declare t public.reservation_trash;done integer:=0;begin
 delete from public.reservation_trash x using public.reservations r
  where r.id=x.reservation_id and r.status not in ('cancelled','no_show') and (org is null or x.organization_id=org);
 for t in select * from public.reservation_trash x where x.purge_after<=now() and (org is null or x.organization_id=org)
  order by x.purge_after limit greatest(1,least(coalesce(max_items,50),500)) for update skip locked loop
  perform pg_advisory_xact_lock(hashtextextended(t.property_id::text,0));
  perform pms_private.purge_reservation(t.reservation_id);
  done:=done+1;
 end loop;
 return done;
end $$;

alter function public.pms_command(jsonb,text) rename to pms_command_before_trash;
create function public.pms_command(command jsonb,idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare kind text:=command->>'type';org uuid;prop uuid;rid uuid;r public.reservations;tr public.reservation_trash;
 link pms_private.site_booking_map;site_status text;ru public.reservation_units;cached jsonb;prior text;begin
 if kind not in ('reservation.delete','reservation.restore','reservation.purge') then
  -- A stay in the trash is read-only until it is recovered.
  if kind in ('reservation.save','reservation.move','reservation.transition') and nullif(command->>'id','') is not null
   and exists(select 1 from public.reservation_trash t join public.reservations x on x.id=t.reservation_id
    where t.reservation_id=(command->>'id')::uuid and x.status in ('cancelled','no_show')) then
   raise exception 'RESERVATION_IN_TRASH';
  end if;
  return public.pms_command_before_trash(command,idempotency_key);
 end if;
 org:=(command->>'organizationId')::uuid;prop:=(command->>'propertyId')::uuid;rid:=(command->>'id')::uuid;
 perform pms_private.require_access(org,'reservation.cancel',prop);
 cached:=pms_private.idempotency_start(org,idempotency_key,command);if cached is not null then return cached;end if;
 perform pg_advisory_xact_lock(hashtextextended(prop::text,0));
 perform pms_private.purge_due_trash(org,20);
 select * into r from public.reservations where id=rid and property_id=prop and organization_id=org for update;
 if not found then raise exception 'NOT_FOUND';end if;
 select * into tr from public.reservation_trash where reservation_id=rid;

 if kind='reservation.delete' then
  if tr.reservation_id is not null then raise exception 'ALREADY_IN_TRASH';end if;
  if nullif(command->>'version','') is not null and r.version<>(command->>'version')::bigint then raise exception 'VERSION_CONFLICT';end if;
  select * into link from pms_private.site_booking_map where reservation_id=rid;
  if link.site_booking_id is not null then select b.payment_status into site_status from site.reservas b where b.id=link.site_booking_id;end if;
  insert into public.reservation_trash(reservation_id,organization_id,property_id,previous_status,previous_cancelled_at,site_payment_status,deleted_by)
  values(rid,org,prop,r.status,r.cancelled_at,site_status,auth.uid());
  if r.status not in ('cancelled','no_show') then
   perform set_config('cala.trash','on',true);
   update public.reservations set status='cancelled',version=version+1,cancelled_at=now() where id=rid;
   perform set_config('cala.trash','',true);
   perform pms_private.recalculate(prop,r.arrival_date,r.departure_date);
  end if;
  perform pms_private.audit(org,prop,'reservation.delete',rid,idempotency_key,jsonb_build_object('status',r.status));
  return pms_private.idempotency_finish(org,idempotency_key,jsonb_build_object('id',rid,
   'message','Reserva enviada a la papelera. Puedes recuperarla durante 10 días.'));
 end if;

 if tr.reservation_id is null then raise exception 'NOT_IN_TRASH';end if;

 if kind='reservation.purge' then
  perform pms_private.purge_reservation(rid);
  return pms_private.idempotency_finish(org,idempotency_key,jsonb_build_object('id',rid,'message','Reserva borrada definitivamente.'));
 end if;

 -- reservation.restore
 delete from public.reservation_trash where reservation_id=rid;
 if r.status='cancelled' and tr.previous_status<>'cancelled' then
  if tr.previous_status in ('pending','confirmed','checked_in','checked_out') then
   for ru in select * from public.reservation_units where reservation_id=rid loop
    perform pms_private.assert_inventory(prop,ru.inventory_type_id,ru.unit_id,ru.arrival_date,ru.departure_date,rid,ru.guests_count);
   end loop;
  end if;
  select * into link from pms_private.site_booking_map where reservation_id=rid;
  if link.site_booking_id is not null and tr.site_payment_status is not null then
   -- Give the website booking back its payment state (PAID stays PAID) before CALA mirrors the stay.
   prior:=current_setting('cala.bridge_origin',true);
   perform set_config('cala.bridge_origin','pms',true);
   update site.reservas set payment_status=tr.site_payment_status,updated_at=now() where id=link.site_booking_id;
   perform set_config('cala.bridge_origin',coalesce(prior,''),true);
  end if;
  perform set_config('cala.trash','on',true);
  update public.reservations set status=tr.previous_status,version=version+1,cancelled_at=tr.previous_cancelled_at where id=rid;
  perform set_config('cala.trash','',true);
  perform pms_private.recalculate(prop,r.arrival_date,r.departure_date);
 end if;
 perform pms_private.audit(org,prop,'reservation.restore',rid,idempotency_key,jsonb_build_object('status',tr.previous_status));
 return pms_private.idempotency_finish(org,idempotency_key,jsonb_build_object('id',rid,'message','Reserva recuperada.'));
end $$;
revoke all on function public.pms_command(jsonb,text) from public,anon;
grant execute on function public.pms_command(jsonb,text) to authenticated;

-- Cron (service role): permanent deletion once the 10 days have passed.
create function public.pms_service_purge_reservation_trash(max_items integer default 50) returns integer
language sql security definer set search_path='' as $$ select pms_private.purge_due_trash(null,max_items); $$;

revoke all on function public.pms_service_purge_reservation_trash(integer) from public,anon,authenticated;
grant execute on function public.pms_service_purge_reservation_trash(integer) to service_role;
revoke all on function pms_private.purge_reservation(uuid),pms_private.purge_due_trash(uuid,integer) from public,anon,authenticated;
revoke execute on all functions in schema pms_private from public;
