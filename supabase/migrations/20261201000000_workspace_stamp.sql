-- Workspace change stamp. CALA used to download the whole workspace every 3 seconds to stay live;
-- now the browser asks for this short hash every few seconds and downloads the workspace only when
-- it changed. The hash is computed here (database) so the web server barely works for it.
-- Covers every table the workspace snapshot reads for the organization.
create function public.pms_workspace_stamp(org uuid) returns text
language plpgsql stable security definer set search_path='' as $$
declare t text;part text;parts text[]:='{}';begin
 if auth.uid() is null or not pms_private.can_access(org,'property.read') then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 foreach t in array array['properties','property_settings','organization_members','member_property_scopes',
  'inventory_types','units','guests','reservations','reservation_units','reservation_trash','inventory_blocks',
  'rate_plans','rate_day','folios','folio_items','payments','tasks','channel_connections','channel_mappings',
  'jobs','audit_logs','automation_rules','conversations','message_entries','message_templates',
  'market_observations','workspace_preferences','onboarding_drafts'] loop
  if to_regclass('public.'||t) is null then continue;end if;
  execute format('select count(*)::text||%L||coalesce(md5(string_agg(x::text,%L order by x::text)),%L) from public.%I x where x.organization_id=$1',':','|','',t)
   into part using org;
  parts:=parts||(t||'='||part);
 end loop;
 select count(*)::text||':'||coalesce(md5(string_agg(a::text,'|' order by a::text)),'') into part
  from public.unit_attributes a join public.units u on u.id=a.unit_id where u.organization_id=org;
 parts:=parts||('unit_attributes='||part);
 select coalesce(md5(o::text),'') into part from public.organizations o where o.id=org;
 parts:=parts||('organization='||part);
 return md5(array_to_string(parts,';'));
end $$;
revoke all on function public.pms_workspace_stamp(uuid) from public,anon;
grant execute on function public.pms_workspace_stamp(uuid) to authenticated;
