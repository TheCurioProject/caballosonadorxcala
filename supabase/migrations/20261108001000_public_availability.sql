-- Revocable availability capabilities. No anonymous table access, PII or financial DTOs.
create function pms_private.ical_link_command(command jsonb,idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=(command->>'organizationId')::uuid;prop uuid:=(command->>'propertyId')::uuid;unit uuid:=(command->>'unitId')::uuid;
 kind text:=command->>'type';cached jsonb;response jsonb;token text;
begin
 if kind not in ('ical.rotate','ical.revoke') then raise exception 'UNKNOWN_COMMAND';end if;
 perform pms_private.require_access(org,'channel.manage',prop);
 if not exists(select 1 from public.units u join public.inventory_types t on t.id=u.inventory_type_id join public.properties p on p.id=u.property_id and p.organization_id=u.organization_id where u.id=unit and u.organization_id=org and u.property_id=prop and u.active and t.active and p.status='active') then raise exception 'INVALID_UNIT';end if;
 cached:=pms_private.idempotency_start(org,idempotency_key,command);if cached is not null then return cached;end if;
 perform pg_advisory_xact_lock(hashtextextended('ical:'||unit::text,0));
 update public.ical_feeds set revoked_at=now() where unit_id=unit and organization_id=org and property_id=prop and revoked_at is null;
 response:=jsonb_build_object('id',unit,'message','Enlaces revocados');
 if kind='ical.rotate' then
  token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
  insert into public.ical_feeds(organization_id,property_id,unit_id,token_hash,created_by) values(org,prop,unit,encode(sha256(convert_to(token,'UTF8')),'hex'),auth.uid());
  response:=jsonb_build_object('id',unit,'message','Enlace creado. Los anteriores dejaron de funcionar.','secretUrl','/api/ical?token='||token);
 end if;
 perform pms_private.audit(org,prop,kind,unit,idempotency_key);
 return pms_private.idempotency_finish(org,idempotency_key,response);
end $$;
revoke all on function pms_private.ical_link_command(jsonb,text) from public,anon,authenticated;

create function public.pms_public_calendar(token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare feed public.ical_feeds;current_day date;start_day date;end_day date;events jsonb;
begin
 if token is null or token !~ '^[a-f0-9]{64}$' then raise exception 'NOT_FOUND';end if;
 select f.* into feed from public.ical_feeds f
 join public.units u on u.id=f.unit_id and u.property_id=f.property_id and u.organization_id=f.organization_id
 join public.inventory_types t on t.id=u.inventory_type_id
 join public.properties p on p.id=f.property_id and p.organization_id=f.organization_id and p.status='active'
 join public.organizations o on o.id=f.organization_id
 join public.organization_members m on m.user_id=f.created_by and m.organization_id=f.organization_id
 join public.roles role on role.id=m.role_id
 join public.role_permissions rp on rp.role_id=m.role_id and rp.permission_key='channel.manage'
 where f.token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') and f.revoked_at is null and u.active and t.active and o.status='active' and m.status='active'
 and (role.organization_id is null or role.organization_id=f.organization_id)
 and (m.all_properties or exists(select 1 from public.member_property_scopes s where s.user_id=m.user_id and s.organization_id=m.organization_id and s.property_id=f.property_id));
 if not found then raise exception 'NOT_FOUND';end if;
 select (now() at time zone p.timezone)::date into current_day from public.properties p where p.id=feed.property_id and p.organization_id=feed.organization_id;
 start_day:=current_day-730;end_day:=current_day+731;
 select coalesce(jsonb_agg(jsonb_build_object('uid',encode(sha256(convert_to(feed.token_hash||':'||e.id::text,'UTF8')),'hex')||'@cala.local','arrival',e.arrival,'departure',e.departure,'sequence',e.sequence,'cancelled',e.cancelled,'exportable',e.exportable)),'[]'::jsonb) into events
 from (
  select distinct r.id,ru.arrival_date as arrival,ru.departure_date as departure,r.version as sequence,r.status in ('cancelled','no_show') as cancelled,true as exportable
  from public.reservations r join public.reservation_units ru on ru.reservation_id=r.id and ru.organization_id=r.organization_id and ru.property_id=r.property_id
  where r.organization_id=feed.organization_id and r.property_id=feed.property_id and r.status<>'draft' and ru.arrival_date<end_day and ru.departure_date>start_day
   and (ru.unit_id is not null and pms_private.units_conflict(feed.unit_id,ru.unit_id) or ru.unit_id is null and exists(select 1 from public.units u where u.inventory_type_id=ru.inventory_type_id and u.property_id=feed.property_id and pms_private.units_conflict(feed.unit_id,u.id)))
  union all
  select b.id,b.start_date,b.end_date,case when b.status='active' then 1 else 2 end,b.status<>'active',not exists(select 1 from public.ical_events e where e.block_id=b.id)
  from public.inventory_blocks b where b.organization_id=feed.organization_id and b.property_id=feed.property_id and b.start_date<end_day and b.end_date>start_day and pms_private.units_conflict(feed.unit_id,b.unit_id)
 ) e;
 if jsonb_array_length(events)>4000 then raise exception 'CALENDAR_TOO_LARGE';end if;
 return jsonb_build_object('today',current_day,'coverageStart',start_day,'coverageEnd',end_day,'events',events);
end $$;
revoke all on function public.pms_public_calendar(text) from public;
grant execute on function public.pms_public_calendar(text) to anon,authenticated;

alter function public.pms_command(jsonb,text) rename to pms_command_before_public_calendar;
revoke all on function public.pms_command_before_public_calendar(jsonb,text) from public,anon,authenticated;
create function public.pms_command(command jsonb,idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if command->>'type' in ('ical.rotate','ical.revoke') then return pms_private.ical_link_command(command,idempotency_key);end if;
 return public.pms_command_before_public_calendar(command,idempotency_key);
end $$;
revoke all on function public.pms_command(jsonb,text) from public,anon;
grant execute on function public.pms_command(jsonb,text) to authenticated;
