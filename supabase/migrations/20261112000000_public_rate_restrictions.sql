-- Rates & restrictions edited in CALA reach the public website in full.
-- Only lodgings mapped to the website property (pms_private.site_property_map,
-- i.e. Casa Caballo Soñador) are exposed; other CALA properties never are.
--
-- 1. lodging_availability now publishes every per-night restriction the
--    rates grid can set (closed, min/max stay, closed to arrival/departure)
--    so the booking calendar can disable dates instead of failing at quote.
-- 2. A rate_day row without a price (amount_minor <= 0, e.g. a
--    restriction-only row) falls back to the base rate in both the calendar
--    and the quote, instead of selling that night for 0.
create or replace function site.lodging_availability(lodging uuid,organization uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare l site.lodgings;m pms_private.site_property_map;local_today date;base_minor bigint;begin
 select * into strict l from site.lodgings where id=lodging and published and enabled;
 select * into strict m from pms_private.site_property_map where site_property_id=l.site_property_id and organization_id=organization;
 if not exists(select 1 from public.units u join public.inventory_types t on t.id=u.inventory_type_id where u.id=l.unit_id and u.active and t.active) then raise exception 'LODGING_INACTIVE';end if;
 select (now() at time zone p.timezone)::date into local_today from public.properties p where p.id=m.property_id;
 select t.base_rate_minor into base_minor from public.inventory_types t where t.id=l.inventory_type_id;
 return jsonb_build_object(
 'reservations',coalesce((select jsonb_agg(jsonb_build_object('checkIn',r.arrival_date,'checkOut',r.departure_date)) from public.reservations r join public.reservation_units ru on ru.reservation_id=r.id where r.property_id=m.property_id and r.status in('pending','confirmed','checked_in','checked_out') and r.departure_date>=local_today and (pms_private.units_conflict(l.unit_id,ru.unit_id) or ru.unit_id is null and ru.inventory_type_id=l.inventory_type_id)),'[]'::jsonb),
 'blocks',coalesce((select jsonb_agg(jsonb_build_object('startDate',b.start_date,'endDate',b.end_date-1,'buffer',b.reason='Preparación después de salida')) from public.inventory_blocks b where b.property_id=m.property_id and b.status='active' and b.end_date>local_today and pms_private.units_conflict(l.unit_id,b.unit_id)),'[]'::jsonb),
 'salesClosures',coalesce((select jsonb_agg(jsonb_build_object('startDate',b.start_date::date,'endDate',b.end_date::date)) from site.blocked_dates b join site.legacy_block_scopes sc on sc.block_id=b.id where b.property_id=l.site_property_id and l.kind='whole_home' and b.end_date::date>=local_today),'[]'::jsonb),
 'pricingRules',coalesce((select jsonb_agg(jsonb_build_object('date',d.stay_date,'priceOverride',(case when d.amount_minor>0 then d.amount_minor else base_minor end)::numeric/100,'closed',d.closed,'minStay',d.min_stay,'maxStay',d.max_stay,'cta',d.cta,'ctd',d.ctd)) from public.rate_day d where d.inventory_type_id=l.inventory_type_id and d.rate_plan_id=l.rate_plan_id and d.occupancy_key='base' and d.stay_date>=local_today),'[]'::jsonb),
 'basePrice',base_minor::numeric/100,
 'today',local_today,'openThrough',l.open_through,'turnoverNights',l.turnover_nights,'minStay',l.min_stay,'maxStay',l.max_stay,'leadTimeDays',l.lead_time_days,
 'checkInTime',(select to_char(check_in_from,'HH24:MI') from public.property_settings where property_id=m.property_id),
 'checkOutTime',(select to_char(check_out_until,'HH24:MI') from public.property_settings where property_id=m.property_id)
 );
end $$;

create or replace function site.lodging_quote(lodging uuid,arrival date,departure date,adults integer,children integer,organization uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare l site.lodgings;m pms_private.site_property_map;day date;rate public.rate_day;base bigint;total bigint:=0;tax integer;local_today date;begin
 select * into strict l from site.lodgings where id=lodging and published and enabled;
 select * into strict m from pms_private.site_property_map where site_property_id=l.site_property_id and organization_id=organization;
 select (now() at time zone p.timezone)::date into local_today from public.properties p where p.id=m.property_id and p.status='active';
 if local_today is null or adults is null or children is null or adults<1 or children<0 or arrival<local_today+l.lead_time_days or departure-arrival<l.min_stay or departure-arrival>l.max_stay or departure is null or arrival is null or l.open_through is not null and departure>l.open_through+1 then raise exception 'LODGING_RULES';end if;
 if l.kind='whole_home' and exists(select 1 from site.blocked_dates b join site.legacy_block_scopes sc on sc.block_id=b.id where b.property_id=l.site_property_id and b.start_date::date<departure and b.end_date::date>=arrival) then raise exception 'LODGING_SALES_CLOSED';end if;
 select t.base_rate_minor into strict base from public.inventory_types t join public.units u on u.inventory_type_id=t.id where t.id=l.inventory_type_id and u.id=l.unit_id and u.active and t.active and t.max_occupancy>=adults+children;
 perform pms_private.assert_inventory(m.property_id,l.inventory_type_id,l.unit_id,arrival,departure,null,adults+children);
 for day in select generate_series(arrival,departure-1,interval '1 day')::date loop
  select * into rate from public.rate_day d where d.rate_plan_id=l.rate_plan_id and d.inventory_type_id=l.inventory_type_id and d.stay_date=day and d.occupancy_key='base';
  if found then
   if rate.closed or departure-arrival<rate.min_stay or departure-arrival>rate.max_stay or day=arrival and rate.cta then raise exception 'RATE_RESTRICTION';end if;
   total:=total+case when rate.amount_minor>0 then rate.amount_minor else base end;
  else total:=total+base;end if;
 end loop;
 if exists(select 1 from public.rate_day where rate_plan_id=l.rate_plan_id and inventory_type_id=l.inventory_type_id and stay_date=departure and ctd) then raise exception 'DEPARTURE_CLOSED';end if;
 select tax_bps into tax from public.property_settings where property_id=m.property_id;
 return total+round(total::numeric*coalesce(tax,0)/10000)::bigint;
end $$;

revoke all on function site.lodging_availability(uuid,uuid),site.lodging_quote(uuid,date,date,integer,integer,uuid) from public,anon,authenticated;
grant execute on function site.lodging_availability(uuid,uuid),site.lodging_quote(uuid,date,date,integer,integer,uuid) to cala_site_app;
