-- Prepared production storage; private tokens are only returned when rotating through a future reviewed RPC.
create table public.ical_feeds(id uuid primary key default gen_random_uuid(),organization_id uuid not null,property_id uuid not null,unit_id uuid not null,token_hash text not null unique,created_by uuid not null references auth.users(id),revoked_at timestamptz,created_at timestamptz not null default now(),foreign key(organization_id,property_id,unit_id) references public.units(organization_id,property_id,id));
create table public.ical_events(id uuid primary key default gen_random_uuid(),organization_id uuid not null,property_id uuid not null,unit_id uuid not null,provider text not null default 'ical',source_calendar text not null,uid text not null,sequence bigint not null check(sequence>=0),source_stamp text not null default '',fingerprint text not null,block_id uuid references public.inventory_blocks(id),foreign key(organization_id,property_id,unit_id) references public.units(organization_id,property_id,id),unique(organization_id,property_id,unit_id,provider,source_calendar,uid));
alter table public.ical_feeds enable row level security;
alter table public.ical_events enable row level security;
revoke all on public.ical_feeds,public.ical_events from public,anon,authenticated;
grant select on public.ical_events to authenticated;
create policy tenant_read on public.ical_events for select to authenticated using(pms_private.can_access(organization_id,'channel.manage',property_id));
create index ical_feeds_active on public.ical_feeds(token_hash) where revoked_at is null;
