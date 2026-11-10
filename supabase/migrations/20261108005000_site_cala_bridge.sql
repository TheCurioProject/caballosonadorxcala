-- A property in the existing site represents an entire villa, not twelve invented rooms.
create table pms_private.site_property_map(
 site_property_id integer primary key references site.properties(id),
 organization_id uuid not null references public.organizations(id),
 property_id uuid not null unique references public.properties(id),
 inventory_type_id uuid not null references public.inventory_types(id),
 unit_id uuid not null references public.units(id),
 rate_plan_id uuid not null references public.rate_plans(id)
);
create table pms_private.site_booking_map(
 site_booking_id integer primary key references site.reservas(id) on delete cascade,
 reservation_id uuid not null unique references public.reservations(id),
 buffer_id uuid unique references public.inventory_blocks(id),
 fingerprint text
);
create table pms_private.site_block_map(
 site_block_id integer primary key references site.blocked_dates(id) on delete cascade,
 block_id uuid not null unique references public.inventory_blocks(id)
);
create table site.integration_alerts(
 id uuid primary key default gen_random_uuid(), booking_id integer not null references site.reservas(id),
 code text not null, status text not null default 'open' check(status in ('open','resolved')),
 created_at timestamptz not null default now(),unique(booking_id,code)
);
alter table site.integration_alerts enable row level security;
create policy server_only on site.integration_alerts for all to cala_site_app using(true) with check(true);
grant select,insert,update on site.integration_alerts to cala_site_app;

-- Only the trusted server connection can read a guest-free projection for the public booking UI.
create function site.cala_availability(site_id integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m pms_private.site_property_map;result jsonb;local_today date;begin
 select * into strict m from pms_private.site_property_map where site_property_id=site_id;
 select (now() at time zone p.timezone)::date into local_today from public.properties p where p.id=m.property_id;
 select jsonb_build_object(
  'reservations',coalesce((select jsonb_agg(jsonb_build_object('checkIn',r.arrival_date,'checkOut',r.departure_date)) from public.reservations r where r.property_id=m.property_id and r.status in('pending','confirmed','checked_in','checked_out') and r.departure_date>=local_today),'[]'::jsonb),
  'blocks',coalesce((select jsonb_agg(jsonb_build_object('startDate',b.start_date,'endDate',b.end_date-1)) from public.inventory_blocks b where b.property_id=m.property_id and b.status='active' and b.end_date>local_today),'[]'::jsonb),
  'pricingRules',coalesce((select jsonb_agg(jsonb_build_object('date',d.stay_date,'priceOverride',d.amount_minor::numeric/100)) from public.rate_day d where d.property_id=m.property_id and d.inventory_type_id=m.inventory_type_id and d.rate_plan_id=m.rate_plan_id and d.occupancy_key='base' and d.stay_date>=local_today),'[]'::jsonb),
  'basePrice',(select t.base_rate_minor::numeric/100 from public.inventory_types t where t.id=m.inventory_type_id)
 ) into result;return result;
end $$;
create function site.cala_quote(site_id integer,arrival date,departure date) returns bigint
language plpgsql security definer set search_path='' as $$
declare m pms_private.site_property_map;day date;rate public.rate_day;amount bigint;base bigint;total bigint:=0;tax integer;begin
 if departure<=arrival or departure-arrival>366 then raise exception 'INVALID_DATES';end if;
 select * into strict m from pms_private.site_property_map where site_property_id=site_id;
 select t.base_rate_minor into strict base from public.inventory_types t join public.units u on u.inventory_type_id=t.id where t.id=m.inventory_type_id and t.active and u.id=m.unit_id and u.active;
 for day in select generate_series(arrival,departure-1,interval '1 day')::date loop
  select * into rate from public.rate_day d where d.rate_plan_id=m.rate_plan_id and d.inventory_type_id=m.inventory_type_id and d.stay_date=day and d.occupancy_key='base';
  if found then
   if rate.closed or departure-arrival<rate.min_stay or departure-arrival>rate.max_stay or day=arrival and rate.cta then raise exception 'RATE_RESTRICTION';end if;
   amount:=rate.amount_minor;
  else amount:=base;end if;total:=total+amount;
 end loop;
 if exists(select 1 from public.rate_day where rate_plan_id=m.rate_plan_id and inventory_type_id=m.inventory_type_id and stay_date=departure and ctd) then raise exception 'RATE_RESTRICTION';end if;
 select tax_bps into tax from public.property_settings where property_id=m.property_id;
 return total+round(total::numeric*coalesce(tax,0)/10000)::bigint;
end $$;
grant execute on function site.cala_availability(integer),site.cala_quote(integer,date,date) to cala_site_app;
revoke all on all functions in schema site from public,anon,authenticated;

-- Honor the existing villa's preparation night. Hide only this reservation's own old buffer
-- while validating a move; all other reservations/blocks remain visible under the property lock.
alter function pms_private.assert_inventory(uuid,uuid,uuid,date,date,uuid,integer) rename to assert_inventory_core;
create function pms_private.assert_inventory(prop uuid,type_id uuid,unit uuid,arrival date,departure date,exclude_reservation uuid,people integer) returns void
language plpgsql security definer set search_path='' as $$
declare m pms_private.site_property_map;buffer uuid;buffer_status text;prior text:=current_setting('cala.bridge_origin',true);begin
 select * into m from pms_private.site_property_map where property_id=prop;
 if found and (type_id<>m.inventory_type_id or unit is distinct from m.unit_id) then raise exception 'SITE_INVENTORY_SCOPE';end if;
 perform pg_advisory_xact_lock(hashtextextended(prop::text,0));
 select buffer_id into buffer from pms_private.site_booking_map where reservation_id=exclude_reservation;
 select status into buffer_status from public.inventory_blocks where id=buffer;
 perform set_config('cala.bridge_origin','inventory_check',true);
 update public.inventory_blocks set status='released' where id=buffer;
 perform pms_private.assert_inventory_core(prop,type_id,unit,arrival,departure,exclude_reservation,people);
 if m.property_id is not null then perform pms_private.assert_inventory_core(prop,type_id,unit,departure,departure+1,exclude_reservation,people);end if;
 update public.inventory_blocks set status=buffer_status where id=buffer;
 perform set_config('cala.bridge_origin',coalesce(prior,''),true);
end $$;
revoke all on function pms_private.assert_inventory(uuid,uuid,uuid,date,date,uuid,integer) from public,anon,authenticated;

create function pms_private.site_booking_fingerprint(site_id integer) returns text language sql stable security definer set search_path='' as $$
 select md5((to_jsonb(b)-'updated_at')::text||coalesce((select jsonb_agg(to_jsonb(a) order by a.id)::text from site.booking_addons a where a.booking_id=b.id),'')) from site.reservas b where b.id=site_id;
$$;
create function pms_private.sync_site_booking(site_id integer) returns void
language plpgsql security definer set search_path='' as $$
declare b site.reservas;m pms_private.site_property_map;link pms_private.site_booking_map;rid uuid;gid uuid;fid uuid;bid uuid;
 desired text;prior text:=current_setting('cala.bridge_origin',true);extra bigint;room bigint;grand bigint;review boolean:=false;people integer:=1;begin
 select * into b from site.reservas where id=site_id;if not found then return;end if;
 select * into strict m from pms_private.site_property_map where site_property_id=b.property_id;
 perform pg_advisory_xact_lock(hashtextextended(m.property_id::text,0));
 perform set_config('cala.bridge_origin','site',true);
 select * into link from pms_private.site_booking_map where site_booking_id=site_id;
 if link.fingerprint=pms_private.site_booking_fingerprint(site_id) then perform set_config('cala.bridge_origin',coalesce(prior,''),true);return;end if;
 if link.reservation_id is null then
  b.notes:=concat_ws(E'\n',nullif(b.notes,''),'Revisar número de huéspedes: la reserva de la web no guardaba ocupación; se muestra un adulto provisional.');
  update site.reservas set notes=b.notes where id=site_id;
 end if;
 rid:=coalesce(link.reservation_id,gen_random_uuid());
 select guest_id into gid from public.reservations where id=rid;
 gid:=coalesce(gid,gen_random_uuid());
 select coalesce((select adults+children from public.reservations where id=rid),1) into people;
 desired:=case when b.payment_status='PENDING' then 'pending' when b.payment_status in('PAID','CONFIRMED') then 'confirmed' when b.payment_status='PAYMENT_REVIEW' then 'draft' else 'cancelled' end;
 -- CHECKED_IN/OUT is a PMS lifecycle, not a new payment state.
 if desired='confirmed' and exists(select 1 from public.reservations where id=rid and status in('checked_in','checked_out')) then select status into desired from public.reservations where id=rid;end if;
 if desired in('pending','confirmed','checked_in','checked_out') then
  begin
   perform pms_private.assert_inventory(m.property_id,m.inventory_type_id,m.unit_id,b.start_date::date,b.end_date::date,rid,people);
  exception when raise_exception then
   if b.payment_status in('PAID','CONFIRMED') then
    review:=true;desired:='draft';
    update site.reservas set payment_status='PAYMENT_REVIEW',updated_at=now() where id=site_id;
    insert into site.integration_alerts(booking_id,code) values(site_id,'PAID_INVENTORY_CONFLICT') on conflict(booking_id,code) do update set status='open';
   else raise;end if;
  end;
 end if;
 grand:=round(b."totalPrice"::numeric*100)::bigint;
 select coalesce(sum(round(price::numeric*100)),0)::bigint into extra from site.booking_addons where booking_id=site_id;
 room:=greatest(0,grand-extra);
 insert into public.guests(id,organization_id,first_name,last_name,email,phone_e164,notes,language)
 values(gid,m.organization_id,b."guestName",'',nullif(b."guestEmail",''),case when b."guestPhone" ~ '^\+[1-9][0-9]{6,14}$' then b."guestPhone" else null end,'',case when b.invoice_language='es' then 'es' else 'en' end)
 on conflict(id) do update set
 first_name=case when trim(public.guests.first_name||' '||public.guests.last_name)=excluded.first_name then public.guests.first_name else excluded.first_name end,
 last_name=case when trim(public.guests.first_name||' '||public.guests.last_name)=excluded.first_name then public.guests.last_name else '' end,
 email=excluded.email,phone_e164=excluded.phone_e164,version=public.guests.version+1;
 insert into public.reservations(id,organization_id,property_id,guest_id,confirmation_code,arrival_date,departure_date,adults,children,status,source,currency,total_minor,notes,booked_at)
 values(rid,m.organization_id,m.property_id,gid,'WEB-'||site_id,b.start_date::date,b.end_date::date,1,0,desired,case when b.origin='WEBSITE' then 'website' else 'imported' end,b.deposit_currency,room,coalesce(b.notes,'')||case when review then E'\nPago recibido: resolver conflicto de inventario antes de confirmar.' else '' end,b.created_at)
 on conflict(id) do update set guest_id=excluded.guest_id,arrival_date=excluded.arrival_date,departure_date=excluded.departure_date,status=excluded.status,total_minor=excluded.total_minor,notes=excluded.notes,version=public.reservations.version+1;
 delete from public.reservation_units where reservation_id=rid;
 insert into public.reservation_units(organization_id,property_id,reservation_id,inventory_type_id,unit_id,rate_plan_id,arrival_date,departure_date,guests_count)
 values(m.organization_id,m.property_id,rid,m.inventory_type_id,m.unit_id,m.rate_plan_id,b.start_date::date,b.end_date::date,people);
 insert into public.folios(organization_id,property_id,reservation_id,currency) values(m.organization_id,m.property_id,rid,b.deposit_currency) on conflict(reservation_id) do nothing;
 select id into fid from public.folios where reservation_id=rid;
 delete from public.folio_items where folio_id=fid and description like '[web] %';
 insert into public.folio_items(organization_id,property_id,folio_id,type,description,unit_amount_minor,total_minor,service_date)
 values(m.organization_id,m.property_id,fid,'room','[web] Alojamiento',room,room,b.start_date::date);
 insert into public.folio_items(organization_id,property_id,folio_id,type,description,quantity,unit_amount_minor,total_minor,service_date)
 select m.organization_id,m.property_id,fid,'extra','[web] '||type,quantity,round(price::numeric*100/quantity)::bigint,round(price::numeric*100)::bigint,b.start_date::date from site.booking_addons where booking_id=site_id;
 if grand-room-extra<0 then insert into public.folio_items(organization_id,property_id,folio_id,type,description,unit_amount_minor,total_minor,service_date) values(m.organization_id,m.property_id,fid,'discount','[web] Descuento',grand-room-extra,grand-room-extra,b.start_date::date);end if;
 bid:=coalesce(link.buffer_id,gen_random_uuid());
 insert into public.inventory_blocks(id,organization_id,property_id,unit_id,start_date,end_date,reason,status)
 values(bid,m.organization_id,m.property_id,m.unit_id,b.end_date::date,b.end_date::date+1,'Preparación después de salida',case when desired in('pending','confirmed','checked_in','checked_out') then 'active' else 'released' end)
 on conflict(id) do update set start_date=excluded.start_date,end_date=excluded.end_date,status=excluded.status;
 insert into pms_private.site_booking_map(site_booking_id,reservation_id,buffer_id,fingerprint) values(site_id,rid,bid,pms_private.site_booking_fingerprint(site_id)) on conflict(site_booking_id) do update set buffer_id=excluded.buffer_id,fingerprint=excluded.fingerprint;
 perform pms_private.recalculate(m.property_id,b.start_date::date,b.end_date::date+1);
 insert into public.audit_logs(organization_id,property_id,actor_type,action,entity_type,entity_id,request_id) values(m.organization_id,m.property_id,'system','site.reservation.sync','reservation',rid,'site:'||site_id);
 perform set_config('cala.bridge_origin',coalesce(prior,''),true);
end $$;

create function pms_private.site_booking_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin if tg_table_name='booking_addons' then if tg_op='DELETE' then perform pms_private.sync_site_booking(old.booking_id);else perform pms_private.sync_site_booking(new.booking_id);end if;else perform pms_private.sync_site_booking(new.id);end if;return null;end $$;
create constraint trigger site_booking_sync after insert or update on site.reservas deferrable initially deferred for each row
 when(current_setting('cala.bridge_origin',true) is distinct from 'pms' and current_setting('cala.bridge_origin',true) is distinct from 'site') execute function pms_private.site_booking_changed();
create constraint trigger site_addon_sync after insert or update or delete on site.booking_addons deferrable initially deferred for each row
 when(current_setting('cala.bridge_origin',true) is distinct from 'pms' and current_setting('cala.bridge_origin',true) is distinct from 'site') execute function pms_private.site_booking_changed();

create function pms_private.sync_pms_booking(rid uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.reservations;u public.reservation_units;g public.guests;m pms_private.site_property_map;link pms_private.site_booking_map;b site.reservas;
 sid integer;bid uuid;extra bigint;prior text:=current_setting('cala.bridge_origin',true);paystate text;begin
 select * into r from public.reservations where id=rid;if not found then return;end if;
 select * into m from pms_private.site_property_map where property_id=r.property_id;if not found then return;end if;
 perform pg_advisory_xact_lock(hashtextextended(m.property_id::text,0));
 select * into u from public.reservation_units where reservation_id=rid limit 1;
 if u.id is null then raise exception 'SITE_ASSIGNMENT_REQUIRED';end if;
 if u.unit_id is distinct from m.unit_id or u.inventory_type_id<>m.inventory_type_id then raise exception 'SITE_INVENTORY_SCOPE';end if;
 select * into g from public.guests where id=r.guest_id;
 select * into link from pms_private.site_booking_map where reservation_id=rid;
 select * into b from site.reservas where id=link.site_booking_id;
 perform set_config('cala.bridge_origin','pms',true);
 if r.status in('pending','confirmed','checked_in','checked_out') then perform pms_private.assert_inventory(m.property_id,u.inventory_type_id,u.unit_id,r.arrival_date,r.departure_date,r.id,u.guests_count);end if;
 paystate:=case when r.status in('cancelled','no_show') then 'CANCELLED' when r.status='draft' then 'DRAFT' when r.status='pending' then 'PENDING' when b.payment_status in('PAID','CONFIRMED') then b.payment_status else 'CONFIRMED' end;
 select coalesce(sum(total_minor),0)::bigint into extra from public.folio_items i join public.folios f on f.id=i.folio_id where f.reservation_id=rid and i.type<>'room';
 if b.id is null then
  insert into site.reservas(property_id,start_date,end_date,"guestName","guestEmail","guestPhone",payment_status,origin,"totalPrice",deposit_paid,deposit_currency,notes,invoice_language,created_at,updated_at)
  values(m.site_property_id,r.arrival_date,r.departure_date,trim(g.first_name||' '||g.last_name),coalesce(g.email,''),g.phone_e164,paystate,'CALA',(r.total_minor+extra)::numeric/100,0,r.currency,r.notes,case when g.language='es' then 'es' else 'en' end,r.booked_at,now()) returning id into sid;
 else
  sid:=b.id;
  update site.reservas set start_date=r.arrival_date,end_date=r.departure_date,"guestName"=trim(g.first_name||' '||g.last_name),"guestEmail"=coalesce(g.email,''),"guestPhone"=coalesce(g.phone_e164,b."guestPhone"),payment_status=paystate,"totalPrice"=(r.total_minor+extra)::numeric/100,notes=r.notes,updated_at=now() where id=sid;
 end if;
 bid:=coalesce(link.buffer_id,gen_random_uuid());
 insert into public.inventory_blocks(id,organization_id,property_id,unit_id,start_date,end_date,reason,status)
 values(bid,m.organization_id,m.property_id,m.unit_id,r.departure_date,r.departure_date+1,'Preparación después de salida',case when r.status in('pending','confirmed','checked_in','checked_out') then 'active' else 'released' end)
 on conflict(id) do update set start_date=excluded.start_date,end_date=excluded.end_date,status=excluded.status;
 insert into pms_private.site_booking_map(site_booking_id,reservation_id,buffer_id,fingerprint) values(sid,rid,bid,pms_private.site_booking_fingerprint(sid)) on conflict(site_booking_id) do update set buffer_id=excluded.buffer_id,fingerprint=excluded.fingerprint;
 perform pms_private.recalculate(m.property_id,r.arrival_date,r.departure_date+1);
 perform set_config('cala.bridge_origin',coalesce(prior,''),true);
end $$;
create function pms_private.pms_booking_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare rid uuid;begin
 if tg_table_name='reservations' then rid:=new.id;
 elsif tg_table_name='folio_items' then select reservation_id into rid from public.folios where id=case when tg_op='DELETE' then old.folio_id else new.folio_id end;
 else rid:=case when tg_op='DELETE' then old.reservation_id else new.reservation_id end;end if;
 if rid is not null then perform pms_private.sync_pms_booking(rid);end if;return null;
end $$;
create constraint trigger pms_site_reservation_sync after insert or update on public.reservations deferrable initially deferred for each row
 when(current_setting('cala.bridge_origin',true) is distinct from 'site' and current_setting('cala.bridge_origin',true) is distinct from 'pms') execute function pms_private.pms_booking_changed();
create constraint trigger pms_site_assignment_sync after insert or update or delete on public.reservation_units deferrable initially deferred for each row
 when(current_setting('cala.bridge_origin',true) is distinct from 'site' and current_setting('cala.bridge_origin',true) is distinct from 'pms') execute function pms_private.pms_booking_changed();
create constraint trigger pms_site_folio_sync after insert or update or delete on public.folio_items deferrable initially deferred for each row
 when(current_setting('cala.bridge_origin',true) is distinct from 'site' and current_setting('cala.bridge_origin',true) is distinct from 'pms') execute function pms_private.pms_booking_changed();

-- Manual and imported iCal blocks use an inclusive end in the legacy site, exclusive in CALA.
create function pms_private.site_block_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare b site.blocked_dates;m pms_private.site_property_map;bid uuid;prior text:=current_setting('cala.bridge_origin',true);begin
 b:=case when tg_op='DELETE' then old else new end;
 select * into strict m from pms_private.site_property_map where site_property_id=b.property_id;
 perform pg_advisory_xact_lock(hashtextextended(m.property_id::text,0));
 perform set_config('cala.bridge_origin','site',true);
 select block_id into bid from pms_private.site_block_map where site_block_id=b.id;
 if tg_op='DELETE' then update public.inventory_blocks set status='released' where id=bid;
 else
  bid:=coalesce(bid,gen_random_uuid());
  if exists(select 1 from public.reservations r where r.property_id=m.property_id and r.status in('pending','confirmed','checked_in','checked_out') and r.arrival_date<b.end_date::date+1 and r.departure_date>b.start_date::date) then raise exception 'BLOCK_CONFLICT';end if;
  insert into public.inventory_blocks(id,organization_id,property_id,unit_id,start_date,end_date,reason)
  values(bid,m.organization_id,m.property_id,m.unit_id,b.start_date::date,b.end_date::date+1,coalesce(b.reason,'Bloqueo web'))
  on conflict(id) do update set start_date=excluded.start_date,end_date=excluded.end_date,reason=excluded.reason,status='active';
  insert into pms_private.site_block_map values(b.id,bid) on conflict(site_block_id) do nothing;
 end if;
 perform pms_private.recalculate(m.property_id,b.start_date::date,b.end_date::date+1);
 perform set_config('cala.bridge_origin',coalesce(prior,''),true);return null;
end $$;
create trigger site_block_sync after insert or update or delete on site.blocked_dates for each row
 when(current_setting('cala.bridge_origin',true) is distinct from 'pms' and current_setting('cala.bridge_origin',true) is distinct from 'site') execute function pms_private.site_block_changed();
create function pms_private.pms_block_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare b public.inventory_blocks;m pms_private.site_property_map;sid integer;prior text:=current_setting('cala.bridge_origin',true);begin
 b:=new;
 if exists(select 1 from pms_private.site_booking_map where buffer_id=b.id) or b.reason='Preparación después de salida' then return null;end if;
 select * into m from pms_private.site_property_map where property_id=b.property_id;if not found then return null;end if;
 perform set_config('cala.bridge_origin','pms',true);
 select site_block_id into sid from pms_private.site_block_map where block_id=b.id;
 if b.status='released' then delete from site.blocked_dates where id=sid;
 elsif sid is null then
  insert into site.blocked_dates(property_id,start_date,end_date,reason,source,created_at,updated_at) values(m.site_property_id,b.start_date,b.end_date-1,b.reason,'cala',now(),now()) returning id into sid;
  insert into pms_private.site_block_map values(sid,b.id);
 else update site.blocked_dates set start_date=b.start_date,end_date=b.end_date-1,reason=b.reason,updated_at=now() where id=sid;end if;
 perform set_config('cala.bridge_origin',coalesce(prior,''),true);return null;
end $$;
create trigger pms_site_block_sync after insert or update on public.inventory_blocks for each row
 when(current_setting('cala.bridge_origin',true) is distinct from 'site' and current_setting('cala.bridge_origin',true) is distinct from 'pms') execute function pms_private.pms_block_changed();

-- Called ONLY after a valid Stripe signature by the trusted server; provider ids are immutable/idempotent.
create function site.accept_stripe_payment(site_id integer,event_id text,session_id text,amount bigint,currency_code text) returns boolean
language plpgsql security definer set search_path='' as $$
declare b site.reservas;rid uuid;r public.reservations;m pms_private.site_property_map;prior text:=current_setting('cala.bridge_origin',true);begin
 select * into strict b from site.reservas where id=site_id for update;
 if b."externalId" is distinct from session_id or amount<0 or upper(currency_code)<>'MXN' then raise exception 'PAYMENT_MISMATCH';end if;
 select * into strict m from pms_private.site_property_map where site_property_id=b.property_id;
 perform pg_advisory_xact_lock(hashtextextended(m.property_id::text,0));
 perform set_config('cala.bridge_origin','site',true);
 update site.reservas set payment_status=case when payment_status='CONFIRMED' then 'CONFIRMED' else 'PAID' end,deposit_paid=amount::numeric/100,deposit_currency=upper(currency_code),"totalPrice"=amount::numeric/100,updated_at=now() where id=site_id;
 perform pms_private.sync_site_booking(site_id);
 select reservation_id into strict rid from pms_private.site_booking_map where site_booking_id=site_id;
 select * into strict r from public.reservations where id=rid;
 delete from public.payments where reservation_id=rid and provider='legacy_import';
 if amount>0 then
  insert into public.payments(organization_id,property_id,reservation_id,provider,provider_payment_id,amount_minor,currency,status,method_type)
  values(r.organization_id,r.property_id,rid,'stripe',session_id,amount,upper(currency_code),'succeeded','card')
  on conflict(organization_id,provider,provider_payment_id) do nothing;
  if not exists(select 1 from public.payments where provider='stripe' and provider_payment_id=session_id and reservation_id=rid and amount_minor=amount and currency=upper(currency_code)) then raise exception 'PAYMENT_MISMATCH';end if;
 end if;
 insert into public.audit_logs(organization_id,property_id,actor_type,action,entity_type,entity_id,request_id) values(r.organization_id,r.property_id,'system','stripe.payment.received','reservation',rid,event_id);
 perform set_config('cala.bridge_origin',coalesce(prior,''),true);
 return (select payment_status<>'PAYMENT_REVIEW' from site.reservas where id=site_id);
end $$;
revoke all on all functions in schema site from public,anon,authenticated;
grant execute on function site.accept_stripe_payment(integer,text,text,bigint,text) to cala_site_app;
revoke all on all functions in schema pms_private from public,anon,authenticated;

grant execute on function pms_private.can_access(uuid,text,uuid),pms_private.can_guest(uuid,uuid) to authenticated;
