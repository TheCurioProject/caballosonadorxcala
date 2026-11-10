-- Expose operational columns directly under RLS; sensitive fields require the filtered RPC.
revoke select on public.reservations from authenticated;
grant select(id,organization_id,property_id,guest_id,confirmation_code,arrival_date,departure_date,adults,children,status,source,currency,version,booked_at,cancelled_at) on public.reservations to authenticated;
create function public.pms_reservations(org uuid,prop uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform pms_private.require_access(org,'reservation.read',prop);
 return coalesce((select jsonb_agg((to_jsonb(r)-'notes'-'total_minor') || jsonb_build_object('notes',case when pms_private.can_access(org,'guest.pii.read',prop) then r.notes else '' end,'total_minor',case when pms_private.can_access(org,'finance.read',prop) then r.total_minor else 0 end)) from public.reservations r where r.organization_id=org and r.property_id=prop),'[]');
end $$;
revoke all on function public.pms_reservations(uuid,uuid) from public,anon;
grant execute on function public.pms_reservations(uuid,uuid) to authenticated;
alter table public.migration_records add constraint migration_records_tenant_unique unique(organization_id,property_id,job_id,id);
alter table public.migration_conflicts add constraint migration_conflicts_record_tenant foreign key(organization_id,property_id,job_id,record_id) references public.migration_records(organization_id,property_id,job_id,id);
drop policy jobs_read on public.jobs;
create policy jobs_read on public.jobs for select to authenticated using(pms_private.can_access(organization_id,case type when 'migration' then 'migration.manage' when 'channel_sync' then 'channel.manage' when 'report' then 'report.read' when 'payment' then 'finance.write' else 'automation.write' end,property_id));
