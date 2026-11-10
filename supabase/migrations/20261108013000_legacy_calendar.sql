-- HTTP compatibility with existing public busy-only iCal URLs. Not a PostgREST RPC.
create function site.legacy_calendar(site_id integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m pms_private.site_property_map;begin
 select * into strict m from pms_private.site_property_map where site_property_id=site_id;
 return coalesce((select jsonb_agg(to_jsonb(event)) from (
  select 'reservation' as kind,r.id,r.arrival_date as arrival,r.departure_date as departure,r.version as sequence from public.reservations r
  where r.property_id=m.property_id and r.status in('pending','confirmed','checked_in','checked_out')
  union all
  select 'block',b.id,b.start_date,b.end_date,0 from public.inventory_blocks b
  where b.property_id=m.property_id and b.status='active' and not exists(
   select 1 from pms_private.site_block_map map join site.blocked_dates original on original.id=map.site_block_id
   where map.block_id=b.id and original.source like 'ical-%'
  )
 ) event),'[]'::jsonb);
end $$;
revoke all on function site.legacy_calendar(integer) from public,anon,authenticated;
grant execute on function site.legacy_calendar(integer) to cala_site_app;
