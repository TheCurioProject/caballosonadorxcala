-- Validate tenant/property tuples before the legacy bulk-rate upsert.
-- Composite insert FKs alone do not protect the ON CONFLICT UPDATE branch.
alter function public.pms_command(jsonb,text) rename to pms_command_before_rate_guard;
revoke all on function public.pms_command_before_rate_guard(jsonb,text) from public,anon,authenticated;
create function public.pms_command(command jsonb,idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;prop uuid;
begin
 if command->>'type'='rates.bulk' then
  org:=(command->>'organizationId')::uuid;prop:=(command->>'propertyId')::uuid;
  perform pms_private.require_access(org,'rates.write',prop);
  if not exists(select 1 from public.rate_plans p where p.id=(command->>'ratePlanId')::uuid and p.organization_id=org and p.property_id=prop)
   or not exists(select 1 from public.inventory_types t where t.id=(command->>'inventoryTypeId')::uuid and t.organization_id=org and t.property_id=prop)
   then raise exception 'INVALID_RATE';end if;
 end if;
 return public.pms_command_before_rate_guard(command,idempotency_key);
end $$;
revoke all on function public.pms_command(jsonb,text) from public,anon;
grant execute on function public.pms_command(jsonb,text) to authenticated;
