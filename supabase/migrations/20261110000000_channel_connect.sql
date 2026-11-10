-- OTA connection assistant (Inbox → "Conectar canal").
-- Registers a channel connection and its listing mappings in one command so
-- the assistant works end to end before any provider API is wired. Provider
-- sync/messaging delivery stays disabled until a connector processes it.
alter function public.pms_command(jsonb,text) rename to pms_command_before_channel_connect;
revoke all on function public.pms_command_before_channel_connect(jsonb,text) from public,anon,authenticated;

create function public.pms_command(command jsonb,idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 kind text:=command->>'type';
 org uuid;prop uuid;entity uuid;cached jsonb;ota text;
begin
 if kind is null or kind not in ('channel.connect','channel.disconnect') then
  return public.pms_command_before_channel_connect(command,idempotency_key);
 end if;
 org:=(command->>'organizationId')::uuid;prop:=(command->>'propertyId')::uuid;
 perform pms_private.require_access(org,'channel.manage',prop);
 cached:=pms_private.idempotency_start(org,idempotency_key,command);if cached is not null then return cached;end if;
 perform pg_advisory_xact_lock(hashtextextended(prop::text,0));
 if kind='channel.connect' then
  ota:=command->>'provider';
  if ota is null or ota not in ('airbnb','booking','expedia','vrbo','google','tripadvisor') then raise exception 'INVALID_PROVIDER';end if;
  if length(trim(coalesce(command->>'name',''))) not between 1 and 160 then raise exception 'INVALID_NAME';end if;
  if coalesce(command->>'syncMode','') not in ('ari','all') or coalesce(command->>'ownership','') not in ('pms','channel') then raise exception 'INVALID_CHANNEL_SETTINGS';end if;
  if jsonb_typeof(command->'mappings') is distinct from 'array' or jsonb_array_length(command->'mappings')>200 then raise exception 'INVALID_MAPPING';end if;
  if exists(
   select 1 from jsonb_array_elements(command->'mappings') x
   where length(trim(coalesce(x->>'externalId',''))) not between 1 and 120
    or not exists(select 1 from public.inventory_types t where t.id=(x->>'inventoryTypeId')::uuid and t.organization_id=org and t.property_id=prop)
    or not exists(select 1 from public.rate_plans r where r.id=(x->>'ratePlanId')::uuid and r.organization_id=org and r.property_id=prop)
  ) then raise exception 'INVALID_MAPPING';end if;
  if (select count(distinct x->>'inventoryTypeId') from jsonb_array_elements(command->'mappings') x)<>jsonb_array_length(command->'mappings')
   or (select count(distinct trim(x->>'externalId')) from jsonb_array_elements(command->'mappings') x)<>jsonb_array_length(command->'mappings')
   then raise exception 'DUPLICATE_MAPPING';end if;
  select c.id into entity from public.channel_connections c where c.organization_id=org and c.property_id=prop and c.provider=ota order by c.version desc limit 1 for update;
  if entity is null then
   entity:=gen_random_uuid();
   insert into public.channel_connections(id,organization_id,property_id,provider,name,status,sync_mode,field_ownership)
    values(entity,org,prop,ota,trim(command->>'name'),'connected',command->>'syncMode',command->>'ownership');
  else
   update public.channel_connections set name=trim(command->>'name'),status='connected',sync_mode=command->>'syncMode',field_ownership=command->>'ownership',last_error_code=null,version=version+1 where id=entity;
  end if;
  delete from public.channel_mappings where connection_id=entity;
  insert into public.channel_mappings(organization_id,property_id,connection_id,inventory_type_id,rate_plan_id,external_id)
   select org,prop,entity,(x->>'inventoryTypeId')::uuid,(x->>'ratePlanId')::uuid,trim(x->>'externalId') from jsonb_array_elements(command->'mappings') x;
 else
  entity:=(command->>'id')::uuid;
  update public.channel_connections set status='disconnected',version=version+1
   where id=entity and organization_id=org and property_id=prop and version=(command->>'version')::bigint;
  if not found then raise exception 'VERSION_CONFLICT';end if;
 end if;
 perform pms_private.audit(org,prop,kind,entity,idempotency_key);
 return pms_private.idempotency_finish(org,idempotency_key,jsonb_build_object('id',entity,'message',case when kind='channel.connect' then 'Canal conectado en CALA' else 'Canal desconectado' end));
end $$;
revoke all on function public.pms_command(jsonb,text) from public,anon;
grant execute on function public.pms_command(jsonb,text) to authenticated;
