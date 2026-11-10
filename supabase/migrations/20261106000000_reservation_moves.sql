-- A room move is a separate command: guest, source, payments and agreed price
-- survive a reassignment. The property lock is shared with every inventory writer.
create function public.pms_move_reservation(command jsonb,idempotency_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 org uuid:=(command->>'organizationId')::uuid;
 prop uuid:=(command->>'propertyId')::uuid;
 rid uuid:=(command->>'id')::uuid;
 target uuid:=(command->>'unitId')::uuid;
 arrival date:=(command->>'arrival')::date;
 departure date:=(command->>'departure')::date;
 pricing text:=command->>'pricing';
 r public.reservations; ru public.reservation_units; u public.units;
 cached jsonb; day date; rate public.rate_day; base bigint; subtotal bigint:=0;
 amount bigint; total bigint; tax_bps integer; folio uuid;
begin
 perform pms_private.require_access(org,'reservation.write',prop);
 cached:=pms_private.idempotency_start(org,idempotency_key,command);
 if cached is not null then return cached;end if;
 perform pg_advisory_xact_lock(hashtextextended(prop::text,0));
 select * into r from public.reservations where id=rid and organization_id=org and property_id=prop for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if r.version is distinct from (command->>'version')::bigint then raise exception 'VERSION_CONFLICT';end if;
 if r.status not in ('pending','confirmed','checked_in') then raise exception 'INVALID_TRANSITION';end if;
 if arrival is null or departure is null or departure<=arrival or departure-arrival>730 then raise exception 'INVALID_DATES';end if;
 if departure-arrival<>r.departure_date-r.arrival_date then raise exception 'STAY_DURATION';end if;
 if pricing is null or pricing not in ('preserve','recalculate') then raise exception 'INVALID_PRICING';end if;
 if r.status='checked_in' and (arrival<>r.arrival_date or departure<>r.departure_date) then raise exception 'IN_HOUSE_DATES';end if;
 if (select count(*) from public.reservation_units where reservation_id=rid)<>1 then raise exception 'SINGLE_UNIT_REQUIRED';end if;
 select * into ru from public.reservation_units where reservation_id=rid for update;
 select * into u from public.units where id=target and organization_id=org and property_id=prop and active;
 if not found then raise exception 'INVALID_UNIT';end if;
 if target=ru.unit_id and arrival=r.arrival_date and departure=r.departure_date then raise exception 'NO_CHANGE';end if;
 if r.status='checked_in' and u.housekeeping_status='dirty' then raise exception 'ROOM_NOT_READY';end if;
 perform pms_private.assert_inventory(prop,u.inventory_type_id,target,arrival,departure,rid,r.adults+r.children);
 total:=r.total_minor;
 if pricing='recalculate' then
  perform pms_private.require_access(org,'finance.write',prop);
  select base_rate_minor into base from public.inventory_types where id=u.inventory_type_id and property_id=prop and active;
  for day in select generate_series(arrival,departure-1,interval '1 day')::date loop
   select * into rate from public.rate_day where rate_plan_id=ru.rate_plan_id and inventory_type_id=u.inventory_type_id and stay_date=day and occupancy_key='base';
   if found then
    if rate.closed or departure-arrival<rate.min_stay or departure-arrival>rate.max_stay or day=arrival and rate.cta then raise exception 'RATE_RESTRICTION';end if;
    amount:=rate.amount_minor;
   else amount:=base;end if;
   subtotal:=subtotal+amount;
  end loop;
  if exists(select 1 from public.rate_day where rate_plan_id=ru.rate_plan_id and inventory_type_id=u.inventory_type_id and stay_date=departure and ctd) then raise exception 'DEPARTURE_CLOSED';end if;
  select s.tax_bps into tax_bps from public.property_settings s where s.property_id=prop;
  total:=subtotal+round(subtotal::numeric*coalesce(tax_bps,0)/10000)::bigint;
  select id into folio from public.folios where reservation_id=rid and status='open';
  if folio is null or not exists(select 1 from public.folio_items where folio_id=folio and type='room') then raise exception 'FOLIO_MISSING_OR_CLOSED';end if;
  update public.folio_items set unit_amount_minor=subtotal,tax_minor=total-subtotal,total_minor=total,service_date=arrival where folio_id=folio and type='room';
 end if;
 if r.status='checked_in' and ru.unit_id is not null and ru.unit_id<>target then
  update public.units set housekeeping_status='dirty',version=version+1 where id=ru.unit_id;
 end if;
 update public.reservations set arrival_date=arrival,departure_date=departure,total_minor=total,version=version+1 where id=rid;
 update public.reservation_units set unit_id=target,inventory_type_id=u.inventory_type_id,arrival_date=arrival,departure_date=departure where id=ru.id;
 perform pms_private.recalculate(prop,least(arrival,r.arrival_date),greatest(departure,r.departure_date));
 perform pms_private.audit(org,prop,'reservation.move',rid,idempotency_key,jsonb_build_object('from_unit',ru.unit_id,'to_unit',target,'from_arrival',r.arrival_date,'from_departure',r.departure_date,'arrival',arrival,'departure',departure,'pricing',pricing));
 insert into public.outbox_events(organization_id,property_id,type,entity_id) values(org,prop,'reservation.updated',rid);
 return pms_private.idempotency_finish(org,idempotency_key,jsonb_build_object('id',rid,'message','Estancia movida. Disponibilidad actualizada en CALA.'));
end $$;
revoke all on function public.pms_move_reservation(jsonb,text) from public,anon;
grant execute on function public.pms_move_reservation(jsonb,text) to authenticated;

alter function public.pms_command(jsonb,text) rename to pms_command_core;
revoke all on function public.pms_command_core(jsonb,text) from public,anon,authenticated;
create function public.pms_command(command jsonb,idempotency_key text)
returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if command->>'type'='reservation.move' then return public.pms_move_reservation(command,idempotency_key);end if;
 return public.pms_command_core(command,idempotency_key);
end $$;
revoke all on function public.pms_command(jsonb,text) from public,anon;
grant execute on function public.pms_command(jsonb,text) to authenticated;
