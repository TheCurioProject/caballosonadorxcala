-- The public site numbers rooms the way CALA names their units
-- ("Room 6- Madera Viva" → 6). There is no room 5, so the site can't number
-- them by position. roomNumber is null for the whole house and for units whose
-- name doesn't start with "Room/Habitación/Hab./Cuarto <n>".
-- save_lodging used to overwrite the unit name with the website name, which
-- dropped that number; it now keeps the "Room 6- " prefix.
create or replace function site.lodging_catalog(include_unpublished boolean, organization uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',l.id,'kind',l.kind,'slug',l.slug,'name',jsonb_build_object('es',l.name_es,'en',coalesce(nullif(l.name_en,''),l.name_es)),
  'roomNumber',case when l.kind='room' then substring(u.name from '(?i)^\s*(?:room|habitaci[oó]n|hab\.?|cuarto)\s*#?\s*(\d{1,4})')::integer end,
  'description',jsonb_build_object('es',l.description_es,'en',coalesce(nullif(l.description_en,''),l.description_es)),
  'beds',jsonb_build_object('es',l.beds_es,'en',coalesce(nullif(l.beds_en,''),l.beds_es)),
  'bathrooms',l.bathrooms,'photoKeys',l.photo_keys,'amenities',l.amenities,
  'policy',jsonb_build_object('es',l.policy_es,'en',coalesce(nullif(l.policy_en,''),l.policy_es)),
  'capacity',t.max_occupancy,'baseRateMinor',t.base_rate_minor,'fromRateMinor',coalesce((select min(d.amount_minor) from public.rate_day d where d.inventory_type_id=t.id and d.rate_plan_id=l.rate_plan_id and d.occupancy_key='base' and not d.closed and d.amount_minor>0 and d.stay_date>=(now() at time zone p.timezone)::date and (l.open_through is null or d.stay_date<=l.open_through)),t.base_rate_minor),'currency',p.currency,
  'minStay',l.min_stay,'maxStay',l.max_stay,'turnoverNights',l.turnover_nights,'leadTimeDays',l.lead_time_days,
  'openThrough',l.open_through,'published',l.published,'enabled',l.enabled,'sortOrder',l.sort_order,'version',l.version,
  'checkInTime',to_char(s.check_in_from,'HH24:MI'),'checkOutTime',to_char(s.check_out_until,'HH24:MI')
 ) order by l.sort_order,l.name_es),'[]'::jsonb)
 from site.lodgings l join public.units u on u.id=l.unit_id
 join public.inventory_types t on t.id=l.inventory_type_id join public.properties p on p.id=u.property_id
 join public.property_settings s on s.property_id=p.id
 where p.organization_id=organization
  and exists(select 1 from pms_private.site_property_map m where m.site_property_id=l.site_property_id and m.organization_id=organization and m.property_id=p.id)
  and (include_unpublished or (l.published and l.enabled and u.active and t.active and p.status='active'));
$$;

create or replace function site.save_lodging(lodging uuid,expected_version bigint,payload jsonb,organization uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare l site.lodgings;m pms_private.site_property_map;new_version bigint;actor uuid:=(payload->>'actorId')::uuid;begin
 select * into strict l from site.lodgings where id=lodging;
 select * into strict m from pms_private.site_property_map where site_property_id=l.site_property_id and organization_id=organization;
 perform pg_advisory_xact_lock(hashtextextended(m.property_id::text,0));
 select * into strict l from site.lodgings where id=lodging for update;
 if not exists(select 1 from public.organization_members mb join public.roles r on r.id=mb.role_id where mb.organization_id=organization and mb.user_id=actor and mb.status='active' and mb.all_properties and r.key in('owner','admin','manager')) then raise exception 'FORBIDDEN';end if;
 if expected_version is null or l.version<>expected_version then raise exception 'VERSION_CONFLICT';end if;
 if exists(select 1 from public.reservation_units ru join public.reservations r on r.id=ru.reservation_id where ru.unit_id=l.unit_id and r.status in('pending','confirmed','checked_in') and r.departure_date>=current_date and ru.guests_count>(payload->>'capacity')::integer) then raise exception 'OCCUPANCY_CONFLICT';end if;
 update site.lodgings set name_es=payload->'name'->>'es',name_en=payload->'name'->>'en',
 description_es=payload->'description'->>'es',description_en=payload->'description'->>'en',
 beds_es=payload->'beds'->>'es',beds_en=payload->'beds'->>'en',
 policy_es=payload->'policy'->>'es',policy_en=payload->'policy'->>'en',
 bathrooms=(payload->>'bathrooms')::integer,amenities=array(select jsonb_array_elements_text(payload->'amenities')),
 min_stay=(payload->>'minStay')::integer,max_stay=(payload->>'maxStay')::integer,
 turnover_nights=(payload->>'turnoverNights')::integer,lead_time_days=(payload->>'leadTimeDays')::integer,
 open_through=(payload->>'openThrough')::date,published=(payload->>'published')::boolean,enabled=(payload->>'enabled')::boolean,
 version=version+1,updated_at=now() where id=lodging returning version into new_version;
 update public.inventory_types set name=payload->'name'->>'es',max_occupancy=(payload->>'capacity')::integer,base_rate_minor=(payload->>'baseRateMinor')::bigint where id=l.inventory_type_id;
 -- Keep CALA's room number ("Room 6- ") when the website name changes, so the
 -- unit stays numbered in CALA and on the website.
 update public.units u set name=case
   when x.prefix is null or (payload->'name'->>'es') ~* '^\s*(room|habitaci[oó]n|hab\.?|cuarto)\s*#?\s*\d' then payload->'name'->>'es'
   when x.prefix ~ '[-–·:|.]$' then x.prefix||' '||(payload->'name'->>'es')
   else x.prefix||'- '||(payload->'name'->>'es') end,
  version=u.version+1
  from (select rtrim(substring(name from '(?i)^(\s*(?:room|habitaci[oó]n|hab\.?|cuarto)\s*#?\s*\d{1,4}\s*[-–·:|.]?)')) as prefix from public.units where id=l.unit_id) x
  where u.id=l.unit_id;
 if l.kind='whole_home' and payload ? 'checkInTime' and payload ? 'checkOutTime' then
  update public.property_settings set check_in_from=(payload->>'checkInTime')::time,check_out_until=(payload->>'checkOutTime')::time where property_id=m.property_id;
 end if;
 insert into public.audit_logs(organization_id,property_id,actor_type,action,entity_type,entity_id,request_id)
 values(m.organization_id,m.property_id,'user','site.lodging.save','lodging',lodging,'lodging:'||lodging||':'||new_version);
 update public.audit_logs set actor_id=actor where request_id='lodging:'||lodging||':'||new_version and organization_id=organization;
 return new_version;
end $$;
