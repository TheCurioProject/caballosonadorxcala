-- All inventory mutations serialize on the same property lock. Conservative and correct;
-- replace with ordered per-day locks only after equivalent concurrency tests.
create function pms_private.units_conflict(left_id uuid,right_id uuid) returns boolean language sql stable set search_path='' as $$
 with recursive l(id) as (select left_id union all select u.id from public.units u join l on u.parent_unit_id=l.id where u.active), r(id) as(select right_id union all select u.id from public.units u join r on u.parent_unit_id=r.id where u.active)
 select exists(select 1 from l join r using(id));
$$;
create function pms_private.recalculate(prop uuid,start_date date,end_date date) returns void language plpgsql security definer set search_path='' as $$ begin
 insert into public.inventory_day(organization_id,property_id,inventory_type_id,stay_date,physical_capacity,held,sold,out_of_service,adjustment)
 select t.organization_id,prop,t.id,day::date,
 (select count(*) from public.units u where u.inventory_type_id=t.id and u.active),
 (select count(*) from public.reservation_units ru join public.reservations r on r.id=ru.reservation_id where ru.inventory_type_id=t.id and r.status='pending' and ru.arrival_date<=day and ru.departure_date>day),
 (select count(*) from public.reservation_units ru join public.reservations r on r.id=ru.reservation_id where ru.inventory_type_id=t.id and r.status in ('confirmed','checked_in','checked_out') and ru.arrival_date<=day and ru.departure_date>day),
 (select count(*) from public.units u where u.inventory_type_id=t.id and u.active and exists(select 1 from public.inventory_blocks b where b.status='active' and b.start_date<=day and b.end_date>day and pms_private.units_conflict(u.id,b.unit_id))),0
 from public.inventory_types t cross join generate_series(start_date,end_date-1,interval '1 day') day where t.property_id=prop
 on conflict(property_id,inventory_type_id,stay_date) do update set physical_capacity=excluded.physical_capacity,held=excluded.held,sold=excluded.sold,out_of_service=excluded.out_of_service,version=public.inventory_day.version+1;
 end $$;
create function pms_private.assert_inventory(prop uuid,type_id uuid,unit uuid,arrival date,departure date,exclude_reservation uuid,people integer) returns void language plpgsql security definer set search_path='' as $$
 declare day date;capacity integer;occupied integer;unassigned integer;overbooking integer; begin
 if departure<=arrival or departure-arrival>730 then raise exception 'INVALID_DATES';end if;
 if not exists(select 1 from public.inventory_types t where t.id=type_id and t.property_id=prop and t.active and t.max_occupancy>=people) then raise exception 'INVALID_INVENTORY_OR_OCCUPANCY';end if;
 if unit is not null and not exists(select 1 from public.units u where u.id=unit and u.inventory_type_id=type_id and u.property_id=prop and u.active) then raise exception 'INVALID_UNIT';end if;
 if unit is null and exists(select 1 from public.units u where u.inventory_type_id=type_id and (u.parent_unit_id is not null or exists(select 1 from public.units child where child.parent_unit_id=u.id))) then raise exception 'COMPOSITE_UNIT_REQUIRED';end if;
 if unit is not null and (exists(select 1 from public.reservation_units ru join public.reservations r on r.id=ru.reservation_id where r.id is distinct from exclude_reservation and r.status in ('pending','confirmed','checked_in','checked_out') and ru.arrival_date<departure and ru.departure_date>arrival and pms_private.units_conflict(unit,ru.unit_id)) or exists(select 1 from public.inventory_blocks b where b.status='active' and b.start_date<departure and b.end_date>arrival and pms_private.units_conflict(unit,b.unit_id))) then raise exception 'UNIT_CONFLICT' using errcode='P0001';end if;
 select coalesce(ps.allowed_overbooking,0) into overbooking from public.property_settings ps where ps.property_id=prop;
 for day in select generate_series(arrival,departure-1,interval '1 day')::date loop
  select count(*) into capacity from public.units u where u.inventory_type_id=type_id and u.active;
  select count(*) into occupied from public.units u where u.inventory_type_id=type_id and u.active and (exists(select 1 from public.reservation_units ru join public.reservations r on r.id=ru.reservation_id where r.id is distinct from exclude_reservation and r.status in ('pending','confirmed','checked_in','checked_out') and ru.arrival_date<=day and ru.departure_date>day and pms_private.units_conflict(u.id,ru.unit_id)) or exists(select 1 from public.inventory_blocks b where b.status='active' and b.start_date<=day and b.end_date>day and pms_private.units_conflict(u.id,b.unit_id)));
  select count(*) into unassigned from public.reservation_units ru join public.reservations r on r.id=ru.reservation_id where ru.inventory_type_id=type_id and ru.unit_id is null and r.id is distinct from exclude_reservation and r.status in ('pending','confirmed','checked_in','checked_out') and ru.arrival_date<=day and ru.departure_date>day;
  if capacity-occupied-unassigned+coalesce(overbooking,0)<1 then raise exception 'NO_AVAILABILITY';end if;
 end loop;end $$;

create function public.pms_save_reservation(command jsonb,idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$
 declare org uuid:=(command->>'organizationId')::uuid;prop uuid:=(command->>'propertyId')::uuid;rid uuid:=coalesce((command->>'id')::uuid,gen_random_uuid());guest uuid:=(command->>'guestId')::uuid;type_id uuid:=(command->>'inventoryTypeId')::uuid;unit uuid:=(command->>'unitId')::uuid;plan uuid:=(command->>'ratePlanId')::uuid;arrival date:=(command->>'arrival')::date;departure date:=(command->>'departure')::date;status text:=command->>'status';old public.reservations;cached jsonb;day date;rate public.rate_day;subtotal bigint:=0;amount bigint;base bigint;tax_bps integer;total bigint;currency char(3);folio uuid;begin
 perform pms_private.require_access(org,'reservation.write',prop);
 cached:=pms_private.idempotency_start(org,idempotency_key,command);if cached is not null then return cached;end if;
 perform pg_advisory_xact_lock(hashtextextended(prop::text,0));
 if not pms_private.can_guest(org,guest) then raise exception 'FORBIDDEN_GUEST' using errcode='42501';end if;
 if not exists(select 1 from public.rate_plans p where p.id=plan and p.property_id=prop and p.active) then raise exception 'INVALID_RATE_PLAN';end if;
 if status not in ('draft','pending','confirmed') or status is null then raise exception 'INVALID_STATUS';end if;
 if departure<=arrival or departure-arrival>730 then raise exception 'INVALID_DATES';end if;
 if command ? 'id' then select * into old from public.reservations r where r.id=rid and r.organization_id=org and r.property_id=prop for update;if not found then raise exception 'NOT_FOUND';end if;if old.version<>(command->>'version')::bigint then raise exception 'VERSION_CONFLICT';end if;if old.status not in ('draft','pending','confirmed') or old.status<>status then raise exception 'INVALID_TRANSITION';end if;end if;
 select t.base_rate_minor into base from public.inventory_types t where t.id=type_id and t.property_id=prop and t.active;if base is null then raise exception 'INVALID_INVENTORY';end if;
 select p.currency into currency from public.properties p where p.id=prop;
 for day in select generate_series(arrival,departure-1,interval '1 day')::date loop
  select * into rate from public.rate_day d where d.rate_plan_id=plan and d.inventory_type_id=type_id and d.stay_date=day and d.occupancy_key='base';
  if found then if rate.closed or departure-arrival<rate.min_stay or departure-arrival>rate.max_stay or day=arrival and rate.cta then raise exception 'RATE_RESTRICTION';end if;amount:=rate.amount_minor;else amount:=base;end if;subtotal:=subtotal+amount;
 end loop;
 if exists(select 1 from public.rate_day d where d.rate_plan_id=plan and d.inventory_type_id=type_id and d.stay_date=departure and d.ctd) then raise exception 'DEPARTURE_CLOSED';end if;
 select s.tax_bps into tax_bps from public.property_settings s where s.property_id=prop;total:=subtotal+round(subtotal::numeric*coalesce(tax_bps,0)/10000)::bigint;
 if status<>'draft' then perform pms_private.assert_inventory(prop,type_id,unit,arrival,departure,rid,(command->>'adults')::integer+(command->>'children')::integer);end if;
 insert into public.reservations(id,organization_id,property_id,guest_id,confirmation_code,arrival_date,departure_date,adults,children,status,source,currency,total_minor,notes)
 values(rid,org,prop,guest,'EST-'||upper(substr(rid::text,1,8)),arrival,departure,(command->>'adults')::integer,(command->>'children')::integer,status,'direct',currency,total,coalesce(command->>'notes',''))
 on conflict(id) do update set guest_id=excluded.guest_id,arrival_date=excluded.arrival_date,departure_date=excluded.departure_date,adults=excluded.adults,children=excluded.children,total_minor=excluded.total_minor,notes=excluded.notes,version=public.reservations.version+1;
 delete from public.reservation_units where reservation_id=rid;
 insert into public.reservation_units(organization_id,property_id,reservation_id,inventory_type_id,unit_id,rate_plan_id,arrival_date,departure_date,guests_count) values(org,prop,rid,type_id,unit,plan,arrival,departure,(command->>'adults')::integer+(command->>'children')::integer);
 insert into public.folios(organization_id,property_id,reservation_id,currency) values(org,prop,rid,currency) on conflict(reservation_id) do nothing;
 select f.id into folio from public.folios f where f.reservation_id=rid;
 if exists(select 1 from public.folio_items i where i.folio_id=folio and i.type='room') then update public.folio_items set unit_amount_minor=subtotal,tax_minor=total-subtotal,total_minor=total,service_date=arrival where folio_id=folio and type='room';else insert into public.folio_items(organization_id,property_id,folio_id,type,description,unit_amount_minor,tax_minor,total_minor,service_date) values(org,prop,folio,'room','Alojamiento',subtotal,total-subtotal,total,arrival);end if;
 perform pms_private.recalculate(prop,least(arrival,coalesce(old.arrival_date,arrival)),greatest(departure,coalesce(old.departure_date,departure)));
 perform pms_private.audit(org,prop,'reservation.save',rid,idempotency_key,jsonb_build_object('status',status,'version',coalesce(old.version,0)+1));
 insert into public.outbox_events(organization_id,property_id,type,entity_id) values(org,prop,case when old.id is null then 'reservation.created' else 'reservation.updated' end,rid);
 return pms_private.idempotency_finish(org,idempotency_key,jsonb_build_object('id',rid,'message','Reserva guardada'));
 end $$;

create function public.pms_transition_reservation(command jsonb,idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$
 declare org uuid:=(command->>'organizationId')::uuid;prop uuid:=(command->>'propertyId')::uuid;rid uuid:=(command->>'id')::uuid;target text:=command->>'status';r public.reservations;ru public.reservation_units;cached jsonb;begin
 perform pms_private.require_access(org,case when target='cancelled' then 'reservation.cancel' else 'reservation.write' end,prop);cached:=pms_private.idempotency_start(org,idempotency_key,command);if cached is not null then return cached;end if;
 perform pg_advisory_xact_lock(hashtextextended(prop::text,0));select * into r from public.reservations where id=rid and property_id=prop and organization_id=org for update;if not found then raise exception 'NOT_FOUND';end if;if r.version<>(command->>'version')::bigint then raise exception 'VERSION_CONFLICT';end if;
 if not (r.status='draft' and target in ('confirmed','cancelled') or r.status='pending' and target in ('confirmed','cancelled','no_show') or r.status='confirmed' and target in ('checked_in','cancelled','no_show') or r.status='checked_in' and target='checked_out') then raise exception 'INVALID_TRANSITION';end if;
 for ru in select * from public.reservation_units where reservation_id=rid loop
  if target in ('confirmed','checked_in','checked_out') then perform pms_private.assert_inventory(prop,ru.inventory_type_id,ru.unit_id,r.arrival_date,r.departure_date,rid,ru.guests_count);end if;
  if target='checked_in' and (ru.unit_id is null or exists(select 1 from public.units u where u.id=ru.unit_id and u.housekeeping_status='dirty')) then raise exception 'ROOM_NOT_READY';end if;
  if target='checked_out' then update public.units set housekeeping_status='dirty',version=version+1 where id=ru.unit_id;end if;
 end loop;
 update public.reservations set status=target,version=version+1,cancelled_at=case when target='cancelled' then now() else cancelled_at end where id=rid;
 perform pms_private.recalculate(prop,r.arrival_date,r.departure_date);perform pms_private.audit(org,prop,'reservation.transition',rid,idempotency_key,jsonb_build_object('status',target));
 insert into public.outbox_events(organization_id,property_id,type,entity_id) values(org,prop,case when target='checked_out' then 'checkout.completed' when target='cancelled' then 'reservation.cancelled' else 'reservation.updated' end,rid);
 return pms_private.idempotency_finish(org,idempotency_key,jsonb_build_object('id',rid,'message','Estado actualizado'));end $$;

create function public.pms_block_unit(command jsonb,idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$
 declare org uuid:=(command->>'organizationId')::uuid;prop uuid:=(command->>'propertyId')::uuid;unit uuid:=(command->>'unitId')::uuid;arrival date:=(command->>'arrival')::date;departure date:=(command->>'departure')::date;bid uuid:=gen_random_uuid();cached jsonb;held record;begin
 perform pms_private.require_access(org,'inventory.write',prop);cached:=pms_private.idempotency_start(org,idempotency_key,command);if cached is not null then return cached;end if;perform pg_advisory_xact_lock(hashtextextended(prop::text,0));
 if exists(select 1 from public.reservation_units ru join public.reservations r on r.id=ru.reservation_id where r.status in ('pending','confirmed','checked_in','checked_out') and ru.arrival_date<departure and ru.departure_date>arrival and pms_private.units_conflict(unit,ru.unit_id)) then raise exception 'BLOCK_CONFLICT';end if;
 insert into public.inventory_blocks(id,organization_id,property_id,unit_id,start_date,end_date,reason) values(bid,org,prop,unit,arrival,departure,command->>'reason');for held in select ru.*,r.adults+r.children as people from public.reservation_units ru join public.reservations r on r.id=ru.reservation_id where r.property_id=prop and ru.unit_id is null and r.status in ('pending','confirmed','checked_in','checked_out') and ru.arrival_date<departure and ru.departure_date>arrival loop perform pms_private.assert_inventory(prop,held.inventory_type_id,null,held.arrival_date,held.departure_date,held.reservation_id,held.people);end loop;perform pms_private.recalculate(prop,arrival,departure);perform pms_private.audit(org,prop,'block.create',bid,idempotency_key);insert into public.outbox_events(organization_id,property_id,type,entity_id) values(org,prop,'inventory.changed',bid);return pms_private.idempotency_finish(org,idempotency_key,jsonb_build_object('id',bid,'message','Unidad bloqueada'));end $$;

create function public.pms_claim_job(worker_id uuid) returns setof public.jobs language sql security definer set search_path='' as $$
 update public.jobs set status='running',lock_token=worker_id,locked_until=now()+interval '30 seconds',updated_at=now() where id=(select id from public.jobs where status in ('queued','retry','running') and run_after<=now() and (locked_until is null or locked_until<now()) order by run_after for update skip locked limit 1) returning *;
$$;
create function public.pms_finish_job(job_id uuid,worker_id uuid,succeeded boolean,error_code text default null) returns boolean language plpgsql security definer set search_path='' as $$ declare updated integer;begin
 update public.jobs set status=case when succeeded then 'completed' when attempts+1>=max_attempts then 'dead_letter' else 'retry' end,progress=case when succeeded then 100 else progress end,attempts=case when succeeded then attempts else attempts+1 end,run_after=now()+make_interval(secs=>least(3600,power(2,attempts+1)::integer))+random()*interval '1 second',last_error_code=error_code,lock_token=null,locked_until=null,updated_at=now() where id=job_id and lock_token=worker_id and locked_until>now();get diagnostics updated=row_count;return updated=1;end $$;
revoke all on function public.pms_save_reservation(jsonb,text),public.pms_transition_reservation(jsonb,text),public.pms_block_unit(jsonb,text),public.pms_claim_job(uuid),public.pms_finish_job(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.pms_save_reservation(jsonb,text),public.pms_transition_reservation(jsonb,text),public.pms_block_unit(jsonb,text) to authenticated;
grant execute on function public.pms_claim_job(uuid),public.pms_finish_job(uuid,uuid,boolean,text) to service_role;
revoke execute on all functions in schema pms_private from public;
