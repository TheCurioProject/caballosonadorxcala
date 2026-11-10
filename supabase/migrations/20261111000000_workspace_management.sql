-- Workspace management: team, units, inventory types and property settings.
--
-- * Team: owner, admin, manager and front desk can invite, edit and remove
--   members. Nobody manages a member of equal or higher rank, and nobody grants
--   a role of equal or higher rank than their own (the owner may grant admin).
--   The MFA (aal2) step-up is no longer required for these commands; every
--   change is still authorized here and written to the audit log.
-- * team.update accepted a "<org>:<user>" membership id the core handler could
--   not cast; this handler accepts both that and a bare user id.
-- * inventory.update / unit.update / richer property.update so the CALA
--   inventory screen can manage everything the "Nueva propiedad" wizard sets.
-- * public.pms_team(org) lists the team (names/emails from auth.users) for
--   members who can manage it; everyone else only sees themselves.
-- * site.lodging_catalog only publishes lodgings of the property mapped to the
--   website (Casa Caballo Soñador), never other CALA properties.

-- 1. Team management rights for manager and front desk.
insert into public.role_permissions(role_id, permission_key)
select r.id, 'team.manage' from public.roles r
where r.key in ('manager', 'front_desk') and r.organization_id is null
on conflict do nothing;

create or replace function pms_private.role_rank(role_key text) returns integer
language sql immutable set search_path='' as $$
 select case role_key when 'owner' then 5 when 'admin' then 4 when 'manager' then 3 when 'front_desk' then 2 else 1 end
$$;

-- 2. Team list (names and emails live in auth.users).
create or replace function public.pms_team(org uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 return (select coalesce(jsonb_agg(jsonb_build_object(
   'userId', m.user_id,
   'name', coalesce(nullif(trim(u.raw_user_meta_data->>'name'), ''), split_part(u.email, '@', 1)),
   'email', u.email,
   'role', r.key,
   'status', m.status,
   'propertyIds', case when m.all_properties then '[]'::jsonb else coalesce((
     select jsonb_agg(s.property_id) from public.member_property_scopes s
     where s.organization_id = m.organization_id and s.user_id = m.user_id), '[]'::jsonb) end,
   'lastSignInAt', u.last_sign_in_at
 ) order by pms_private.role_rank(r.key) desc, u.email), '[]'::jsonb)
 from public.organization_members m
 join public.roles r on r.id = m.role_id
 join auth.users u on u.id = m.user_id
 where m.organization_id = org
   and (m.user_id = auth.uid() or pms_private.can_access(org, 'team.manage')));
end $$;
revoke all on function public.pms_team(uuid) from public, anon;
grant execute on function public.pms_team(uuid) to authenticated;

-- 3. Command handler.
alter function public.pms_command(jsonb, text) rename to pms_command_before_management;
revoke all on function public.pms_command_before_management(jsonb, text) from public, anon, authenticated;

create function public.pms_command(command jsonb, idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 kind text := command->>'type';
 org uuid; prop uuid; entity uuid; cached jsonb; message text := 'Cambios guardados';
 actor_role text; target uuid; target_role text; next_role uuid; raw_id text; invite_email text;
begin
 if kind is null or kind not in ('inventory.update','unit.update','property.update','team.invite','team.update','team.remove') then
  return public.pms_command_before_management(command, idempotency_key);
 end if;
 if auth.uid() is null then raise exception 'UNAUTHORIZED' using errcode = '42501'; end if;
 org := (command->>'organizationId')::uuid;
 prop := nullif(command->>'propertyId', '')::uuid;
 if kind like 'team.%' then
  perform pms_private.require_access(org, 'team.manage', null);
 elsif kind = 'property.update' then
  perform pms_private.require_access(org, 'property.write', prop);
 else
  perform pms_private.require_access(org, 'inventory.write', prop);
 end if;
 cached := pms_private.idempotency_start(org, idempotency_key, command);
 if cached is not null then return cached; end if;

 if kind like 'team.%' then
  select r.key into actor_role from public.organization_members m join public.roles r on r.id = m.role_id
   where m.organization_id = org and m.user_id = auth.uid() and m.status = 'active';
  if kind <> 'team.remove' then
   if coalesce(command->>'role', '') = 'owner' then raise exception 'OWNER_TRANSFER_REQUIRED'; end if;
   select id into next_role from public.roles where key = command->>'role' and is_system and organization_id is null;
   if next_role is null then raise exception 'INVALID_ROLE'; end if;
   if actor_role <> 'owner' and pms_private.role_rank(command->>'role') >= pms_private.role_rank(actor_role) then
    raise exception 'ROLE_ESCALATION' using errcode = '42501';
   end if;
   if jsonb_typeof(command->'propertyIds') is distinct from 'array'
    or exists(select 1 from jsonb_array_elements_text(command->'propertyIds') x
              where not exists(select 1 from public.properties p where p.id = x::uuid and p.organization_id = org)) then
    raise exception 'INVALID_SCOPE';
   end if;
  end if;

  if kind = 'team.invite' then
   invite_email := lower(trim(command->>'email'));
   select u.id into target from auth.users u where lower(u.email) = invite_email;
   if target is null then raise exception 'INVITE_USER_MISSING'; end if;
   if exists(select 1 from public.organization_members where organization_id = org and user_id = target) then
    raise exception 'DUPLICATE_MEMBER';
   end if;
   insert into public.organization_members(organization_id, user_id, role_id, status, all_properties, invited_by)
    values(org, target, next_role, 'active', jsonb_array_length(command->'propertyIds') = 0, auth.uid());
   message := 'Miembro añadido al equipo';
  else
   raw_id := command->>'id';
   target := (case when position(':' in raw_id) > 0 then split_part(raw_id, ':', 2) else raw_id end)::uuid;
   if target = auth.uid() then raise exception 'SELF_ROLE'; end if;
   select r.key into target_role from public.organization_members m join public.roles r on r.id = m.role_id
    where m.organization_id = org and m.user_id = target;
   if target_role is null then raise exception 'NOT_FOUND'; end if;
   if target_role = 'owner' then raise exception 'OWNER_TRANSFER_REQUIRED'; end if;
   if actor_role <> 'owner' and pms_private.role_rank(target_role) >= pms_private.role_rank(actor_role) then
    raise exception 'ROLE_ESCALATION' using errcode = '42501';
   end if;
   if kind = 'team.update' then
    if coalesce(command->>'status', '') not in ('active', 'suspended') then raise exception 'INVALID_STATUS'; end if;
    update public.organization_members
     set role_id = next_role, status = command->>'status', all_properties = jsonb_array_length(command->'propertyIds') = 0
     where organization_id = org and user_id = target;
    message := 'Acceso actualizado';
   else
    message := 'Miembro retirado del equipo';
   end if;
   delete from public.member_property_scopes where organization_id = org and user_id = target;
   if kind = 'team.remove' then
    delete from public.organization_members where organization_id = org and user_id = target;
   end if;
  end if;
  if kind <> 'team.remove' then
   insert into public.member_property_scopes(organization_id, user_id, property_id)
    select org, target, x::uuid from jsonb_array_elements_text(command->'propertyIds') x
    on conflict do nothing;
  end if;
  entity := target;

 elsif kind = 'inventory.update' then
  entity := (command->>'id')::uuid;
  if length(trim(coalesce(command->>'name', ''))) not between 1 and 160 then raise exception 'INVALID_NAME'; end if;
  if (command->>'maxOccupancy')::integer not between 1 and 100 then raise exception 'INVALID_OCCUPANCY'; end if;
  if (command->>'baseRateMinor')::bigint not between 0 and 100000000000 then raise exception 'INVALID_AMOUNT'; end if;
  update public.inventory_types
   set name = trim(command->>'name'), max_occupancy = (command->>'maxOccupancy')::integer,
       base_rate_minor = (command->>'baseRateMinor')::bigint, active = coalesce((command->>'active')::boolean, active)
   where id = entity and organization_id = org and property_id = prop;
  if not found then raise exception 'NOT_FOUND'; end if;
  message := 'Alojamiento actualizado';

 elsif kind = 'unit.update' then
  entity := (command->>'id')::uuid;
  if length(trim(coalesce(command->>'name', ''))) not between 1 and 160 then raise exception 'INVALID_NAME'; end if;
  if not exists(select 1 from public.inventory_types t where t.id = (command->>'inventoryTypeId')::uuid and t.organization_id = org and t.property_id = prop) then
   raise exception 'INVALID_INVENTORY';
  end if;
  if exists(select 1 from public.units u where u.property_id = prop and u.name = trim(command->>'name') and u.id <> entity) then
   raise exception 'DUPLICATE_UNIT';
  end if;
  update public.units
   set name = trim(command->>'name'), inventory_type_id = (command->>'inventoryTypeId')::uuid,
       active = coalesce((command->>'active')::boolean, active), version = version + 1
   where id = entity and organization_id = org and property_id = prop and version = (command->>'version')::bigint;
  if not found then raise exception 'VERSION_CONFLICT'; end if;
  if command ? 'attributes' and jsonb_typeof(command->'attributes') = 'object' then
   insert into public.unit_attributes(unit_id, key, value_json)
    select entity, a.key, a.value from jsonb_each(command->'attributes') a
    where a.key in ('bedrooms', 'beds', 'bathrooms') and jsonb_typeof(a.value) = 'number'
   on conflict (unit_id, key) do update set value_json = excluded.value_json;
  end if;
  message := 'Unidad actualizada';

 else -- property.update
  entity := prop;
  update public.properties
   set name = trim(command->>'name'), city = trim(command->>'city'),
       address = coalesce(command->>'address', address),
       concept = coalesce(command->>'concept', concept),
       version = version + 1
   where id = prop and organization_id = org and version = (command->>'version')::bigint;
  if not found then raise exception 'VERSION_CONFLICT'; end if;
  update public.property_settings
   set policy = coalesce(command->>'policy', policy),
       allowed_overbooking = coalesce((command->>'allowedOverbooking')::integer, allowed_overbooking),
       check_in_from = coalesce((command->>'checkIn')::time, check_in_from),
       check_out_until = coalesce((command->>'checkOut')::time, check_out_until),
       tax_bps = coalesce((command->>'taxBps')::integer, tax_bps)
   where property_id = prop;
  message := 'Propiedad actualizada';
 end if;

 perform pms_private.audit(org, prop, kind, entity, idempotency_key);
 return pms_private.idempotency_finish(org, idempotency_key, jsonb_build_object('id', entity, 'message', message));
end $$;
revoke all on function public.pms_command(jsonb, text) from public, anon;
grant execute on function public.pms_command(jsonb, text) to authenticated;

-- 4. Website catalog: only the CALA property mapped to the website.
create or replace function site.lodging_catalog(include_unpublished boolean, organization uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',l.id,'kind',l.kind,'slug',l.slug,'name',jsonb_build_object('es',l.name_es,'en',coalesce(nullif(l.name_en,''),l.name_es)),
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
