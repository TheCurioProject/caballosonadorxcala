-- Inventory as a property manager: houses → rooms.
--
-- * room.create   creates a sellable room (its own inventory type + unit), optionally
--                 inside a house (top-level unit), with bedrooms/beds/bathrooms.
-- * room.update   edits a room or house in one atomic step: unit name, in service,
--                 attributes, and its type's capacity and base rate (the type name
--                 follows the unit only when the type holds a single unit).
-- * room.delete   removes a room that never had reservations, is not on the website
--                 and has no channel or calendar link; otherwise it must be put out
--                 of service instead, so history is never lost.
-- * property.rentalMode  whole | rooms | both. Rooms are switched with their types'
--                 active flag. The house is switched the same way, except for the
--                 property linked to the public website: there the website lodging
--                 is enabled/disabled instead, because the house type is bridged to
--                 site.properties.is_active (which would hide the whole site).
-- The chosen mode and the website link are kept in property_settings.settings_json.

alter function public.pms_command(jsonb, text) rename to pms_command_before_property_manager;
revoke all on function public.pms_command_before_property_manager(jsonb, text) from public, anon, authenticated;

create function public.pms_command(command jsonb, idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 kind text := command->>'type';
 org uuid; prop uuid; entity uuid; parent uuid; type_id uuid; cached jsonb; message text;
 mode text; house uuid; linked boolean; shared integer; first_day date; last_day date;
begin
 if kind is null or kind not in ('room.create','room.update','room.delete','property.rentalMode') then
  return public.pms_command_before_property_manager(command, idempotency_key);
 end if;
 if auth.uid() is null then raise exception 'UNAUTHORIZED' using errcode = '42501'; end if;
 org := (command->>'organizationId')::uuid;
 prop := nullif(command->>'propertyId', '')::uuid;
 perform pms_private.require_access(org, 'inventory.write', prop);
 cached := pms_private.idempotency_start(org, idempotency_key, command);
 if cached is not null then return cached; end if;
 perform pg_advisory_xact_lock(hashtextextended(prop::text, 0));
 linked := exists(select 1 from pms_private.site_property_map m where m.property_id = prop);

 if kind in ('room.create', 'room.update') then
  if length(trim(coalesce(command->>'name', ''))) not between 1 and 160 then raise exception 'INVALID_NAME'; end if;
  if (command->>'maxOccupancy')::integer not between 1 and 100 then raise exception 'INVALID_OCCUPANCY'; end if;
  if (command->>'baseRateMinor')::bigint not between 0 and 100000000000 then raise exception 'INVALID_AMOUNT'; end if;
 end if;

 if kind = 'room.create' then
  parent := nullif(command->>'parentUnitId', '')::uuid;
  if parent is not null and not exists(select 1 from public.units where id = parent and property_id = prop and organization_id = org and parent_unit_id is null) then
   raise exception 'INVALID_PARENT';
  end if;
  if exists(select 1 from public.units where property_id = prop and name = trim(command->>'name')) then raise exception 'DUPLICATE_UNIT'; end if;
  mode := coalesce((select settings_json->>'rentalMode' from public.property_settings where property_id = prop), 'both');
  type_id := gen_random_uuid(); entity := gen_random_uuid();
  insert into public.inventory_types(id, organization_id, property_id, name, sell_mode, max_occupancy, base_rate_minor, active, sort_order)
   values(type_id, org, prop, trim(command->>'name'), 'unit', (command->>'maxOccupancy')::integer, (command->>'baseRateMinor')::bigint,
          not (parent is not null and mode = 'whole'),
          coalesce((select max(sort_order) + 1 from public.inventory_types where property_id = prop), 0));
  insert into public.units(id, organization_id, property_id, inventory_type_id, name, parent_unit_id)
   values(entity, org, prop, type_id, trim(command->>'name'), parent);
  if parent is not null then
   insert into public.inventory_relations(organization_id, property_id, parent_unit_id, child_unit_id) values(org, prop, parent, entity);
  end if;
  if not exists(select 1 from public.rate_plans where property_id = prop) then
   insert into public.rate_plans(organization_id, property_id, name) values(org, prop, 'Venta directa');
  end if;
  message := 'Habitación registrada';

 elsif kind = 'room.update' then
  entity := (command->>'id')::uuid;
  select inventory_type_id into type_id from public.units where id = entity and property_id = prop and organization_id = org;
  if type_id is null then raise exception 'NOT_FOUND'; end if;
  if exists(select 1 from public.units where property_id = prop and name = trim(command->>'name') and id <> entity) then raise exception 'DUPLICATE_UNIT'; end if;
  update public.units set name = trim(command->>'name'), active = coalesce((command->>'active')::boolean, active), version = version + 1
   where id = entity and version = (command->>'version')::bigint;
  if not found then raise exception 'VERSION_CONFLICT'; end if;
  select count(*) into shared from public.units where inventory_type_id = type_id;
  update public.inventory_types
   set name = case when shared = 1 then trim(command->>'name') else name end,
       max_occupancy = (command->>'maxOccupancy')::integer,
       base_rate_minor = (command->>'baseRateMinor')::bigint
   where id = type_id;
  if jsonb_typeof(command->'attributes') = 'object' then
   insert into public.unit_attributes(unit_id, key, value_json)
    select entity, a.key, a.value from jsonb_each(command->'attributes') a
    where a.key in ('bedrooms', 'beds', 'bathrooms') and jsonb_typeof(a.value) = 'number'
   on conflict (unit_id, key) do update set value_json = excluded.value_json;
  end if;
  message := 'Cambios guardados';

 elsif kind = 'room.delete' then
  entity := (command->>'id')::uuid;
  select inventory_type_id into type_id from public.units where id = entity and property_id = prop and organization_id = org and version = (command->>'version')::bigint;
  if type_id is null then raise exception 'VERSION_CONFLICT'; end if;
  if exists(select 1 from public.units where parent_unit_id = entity) then raise exception 'ROOM_HAS_ROOMS'; end if;
  if exists(select 1 from public.reservation_units where unit_id = entity) then raise exception 'ROOM_HAS_RESERVATIONS'; end if;
  if exists(select 1 from site.lodgings where unit_id = entity) or exists(select 1 from pms_private.site_property_map where unit_id = entity) then raise exception 'ROOM_ON_WEBSITE'; end if;
  if exists(select 1 from public.ical_feeds where unit_id = entity) then raise exception 'ROOM_HAS_CALENDAR_SYNC'; end if;
  select count(*) into shared from public.units where inventory_type_id = type_id;
  if shared = 1 and exists(select 1 from public.reservation_units where inventory_type_id = type_id) then raise exception 'ROOM_HAS_RESERVATIONS'; end if;
  if shared = 1 and exists(select 1 from public.channel_mappings where inventory_type_id = type_id) then raise exception 'ROOM_HAS_CHANNEL'; end if;
  select min(start_date), max(end_date) into first_day, last_day from public.inventory_blocks where unit_id = entity;
  update public.tasks set unit_id = null where unit_id = entity;
  delete from public.ical_events where unit_id = entity;
  delete from public.inventory_blocks where unit_id = entity;
  delete from public.inventory_relations where parent_unit_id = entity or child_unit_id = entity;
  delete from public.unit_attributes where unit_id = entity;
  delete from public.units where id = entity;
  if shared = 1 then
   delete from public.rate_day where inventory_type_id = type_id;
   delete from public.inventory_day where inventory_type_id = type_id;
   delete from public.inventory_types where id = type_id;
  end if;
  if first_day is not null then perform pms_private.recalculate(prop, first_day, last_day); end if;
  message := 'Habitación eliminada';

 else -- property.rentalMode
  mode := command->>'mode';
  if mode is null or mode not in ('whole', 'rooms', 'both') then raise exception 'INVALID_RENTAL_MODE'; end if;
  select u.id into house from public.units u
   where u.property_id = prop and u.parent_unit_id is null and exists(select 1 from public.units c where c.parent_unit_id = u.id)
   order by u.name limit 1;
  if house is null then raise exception 'RENTAL_MODE_NEEDS_ROOMS'; end if;
  entity := prop;
  update public.inventory_types t set active = (mode <> 'whole')
   where t.property_id = prop and exists(select 1 from public.units u where u.inventory_type_id = t.id and u.parent_unit_id = house);
  if linked then
   update site.lodgings l set enabled = (mode <> 'rooms'), version = l.version + 1, updated_at = now() where l.unit_id = house and l.kind = 'whole_home';
  else
   update public.inventory_types t set active = (mode <> 'rooms')
    where t.id = (select inventory_type_id from public.units where id = house);
  end if;
  update public.property_settings set settings_json = coalesce(settings_json, '{}'::jsonb) || jsonb_build_object('rentalMode', mode) where property_id = prop;
  message := case mode when 'whole' then 'Ahora se renta solo la casa completa'
                       when 'rooms' then 'Ahora se rentan solo las habitaciones'
                       else 'Ahora se renta la casa completa y por habitaciones' end;
 end if;

 perform pms_private.audit(org, prop, kind, entity, idempotency_key);
 return pms_private.idempotency_finish(org, idempotency_key, jsonb_build_object('id', entity, 'message', message));
end $$;
revoke all on function public.pms_command(jsonb, text) from public, anon;
grant execute on function public.pms_command(jsonb, text) to authenticated;

-- Mark the property linked to the public website so the manager can say so.
update public.property_settings s set settings_json = coalesce(s.settings_json, '{}'::jsonb) || jsonb_build_object('websiteLinked', true)
 where exists(select 1 from pms_private.site_property_map m where m.property_id = s.property_id);
