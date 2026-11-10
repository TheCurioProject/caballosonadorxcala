-- The daily projection must count shared physical resources, including room/bed relations.
create or replace function pms_private.recalculate(prop uuid,start_date date,end_date date) returns void language plpgsql security definer set search_path='' as $$ begin
 insert into public.inventory_day(organization_id,property_id,inventory_type_id,stay_date,physical_capacity,held,sold,out_of_service,adjustment)
 select t.organization_id,prop,t.id,day::date,
 (select count(*) from public.units u where u.inventory_type_id=t.id and u.active),
 (select count(*) from public.units u where u.inventory_type_id=t.id and u.active and exists(select 1 from public.reservation_units ru join public.reservations r on r.id=ru.reservation_id where r.property_id=prop and r.status='pending' and ru.arrival_date<=day and ru.departure_date>day and pms_private.units_conflict(u.id,ru.unit_id)))+
 (select count(*) from public.reservation_units ru join public.reservations r on r.id=ru.reservation_id where ru.inventory_type_id=t.id and ru.unit_id is null and r.status='pending' and ru.arrival_date<=day and ru.departure_date>day),
 (select count(*) from public.units u where u.inventory_type_id=t.id and u.active and exists(select 1 from public.reservation_units ru join public.reservations r on r.id=ru.reservation_id where r.property_id=prop and r.status in ('confirmed','checked_in','checked_out') and ru.arrival_date<=day and ru.departure_date>day and pms_private.units_conflict(u.id,ru.unit_id)))+
 (select count(*) from public.reservation_units ru join public.reservations r on r.id=ru.reservation_id where ru.inventory_type_id=t.id and ru.unit_id is null and r.status in ('confirmed','checked_in','checked_out') and ru.arrival_date<=day and ru.departure_date>day),
 (select count(*) from public.units u where u.inventory_type_id=t.id and u.active and exists(select 1 from public.inventory_blocks b where b.status='active' and b.start_date<=day and b.end_date>day and pms_private.units_conflict(u.id,b.unit_id))),
 coalesce((select ps.allowed_overbooking from public.property_settings ps where ps.property_id=prop),0)
 from public.inventory_types t cross join generate_series(start_date,end_date-1,interval '1 day') day where t.property_id=prop
 on conflict(property_id,inventory_type_id,stay_date) do update set physical_capacity=excluded.physical_capacity,held=excluded.held,sold=excluded.sold,out_of_service=excluded.out_of_service,adjustment=excluded.adjustment,version=public.inventory_day.version+1;
end $$;
