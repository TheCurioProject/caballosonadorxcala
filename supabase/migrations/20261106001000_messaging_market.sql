insert into public.permissions(key,description) values ('message.read','Leer conversaciones'),('message.write','Gestionar conversaciones');
insert into public.role_permissions(role_id,permission_key)
 select r.id,p.key from public.roles r cross join public.permissions p
 where r.is_system and r.key in ('owner','admin','manager','front_desk') and p.key in ('message.read','message.write');

create table public.conversations(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,property_id uuid not null,reservation_id uuid not null,
 status text not null default 'open' check(status in ('open','archived')),assignee_id uuid,version bigint not null default 1,
 updated_at timestamptz not null default now(),unique(reservation_id),
 foreign key(organization_id,property_id,reservation_id) references public.reservations(organization_id,property_id,id),
 foreign key(organization_id,assignee_id) references public.organization_members(organization_id,user_id)
);
create table public.message_entries(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,property_id uuid not null,reservation_id uuid not null,
 direction text not null check(direction in ('inbound','outbound','internal')),
 status text not null check(status in ('received','draft','blocked','sent','recorded','cancelled')),
 subject text not null default '' check(length(subject)<=200),body text not null check(length(trim(body)) between 1 and 10000),
 scheduled_at timestamptz,failure_code text,author_id uuid not null references auth.users(id),created_at timestamptz not null default now(),
 version bigint not null default 1,
 foreign key(organization_id,property_id,reservation_id) references public.reservations(organization_id,property_id,id)
);
create table public.message_templates(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,property_id uuid not null,
 name text not null check(length(trim(name)) between 1 and 160),locale text not null check(locale in ('es','en','de','fr','it','pt','nl','pl','el','hu')),
 subject text not null default '' check(length(subject)<=200),body text not null check(length(trim(body)) between 1 and 10000),
 trigger text not null check(trigger in ('manual','booking','arrival','departure')),
 offset_days integer not null default 0 check(offset_days between -30 and 30),version bigint not null default 1,
 foreign key(organization_id,property_id) references public.properties(organization_id,id)
);
create table public.market_observations(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,property_id uuid not null,stay_date date not null,observed_on date not null,
 source text not null check(length(trim(source)) between 1 and 160),market text not null check(length(trim(market)) between 1 and 160),
 currency char(3) not null check(currency in ('MXN','USD','EUR')),adr_minor bigint not null check(adr_minor between 0 and 100000000000),
 occupancy_bps integer not null check(occupancy_bps between 0 and 10000),sample_size integer not null check(sample_size between 1 and 1000000),
 unique(property_id,source,market,stay_date,observed_on),
 foreign key(organization_id,property_id) references public.properties(organization_id,id)
);
create index conversation_property_status on public.conversations(property_id,status,updated_at desc);
create index message_reservation_date on public.message_entries(reservation_id,created_at);
create index market_property_dates on public.market_observations(property_id,stay_date,observed_on desc);

do $$ declare tab text;begin
 for tab in select unnest(array['conversations','message_entries','message_templates','market_observations']) loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('revoke all on public.%I from public,anon,authenticated',tab);
  execute format('grant select on public.%I to authenticated',tab);
 end loop;
end $$;
create policy conversation_read on public.conversations for select to authenticated using(pms_private.can_access(organization_id,'message.read',property_id) and pms_private.can_access(organization_id,'guest.pii.read',property_id));
create policy message_read on public.message_entries for select to authenticated using(pms_private.can_access(organization_id,'message.read',property_id) and pms_private.can_access(organization_id,'guest.pii.read',property_id));
create policy template_read on public.message_templates for select to authenticated using(pms_private.can_access(organization_id,'message.read',property_id));
create policy market_read on public.market_observations for select to authenticated using(pms_private.can_access(organization_id,'report.read',property_id));

create function pms_private.validate_message_template(body text) returns void language plpgsql set search_path='' as $$
 declare match text[];begin
 for match in select regexp_matches(body,'\{\{\s*([^{}]+?)\s*\}\}','g') loop
  if trim(match[1]) not in ('guest_first_name','guest_name','property_name','arrival','departure','check_in','check_out','confirmation_code','unit_name') then raise exception 'UNKNOWN_VARIABLE';end if;
 end loop;
 if regexp_replace(body,'\{\{\s*[^{}]+?\s*\}\}','','g') ~ '\{\{|\}\}' then raise exception 'INVALID_VARIABLE';end if;
end $$;
revoke all on function pms_private.validate_message_template(text) from public,anon,authenticated;

create function pms_private.hospitality_command(command jsonb,idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$
 declare
 kind text:=command->>'type';org uuid:=(command->>'organizationId')::uuid;prop uuid:=(command->>'propertyId')::uuid;
 entity uuid:=coalesce((command->>'id')::uuid,gen_random_uuid());reservation uuid:=(command->>'reservationId')::uuid;
 cached jsonb; row jsonb; old public.message_entries; template public.message_templates; conversation public.conversations;
 mode text:=command->>'mode';entry_status text;member uuid:=(command->>'assigneeId')::uuid;reservation_status text;
 prop_currency char(3);as_of date;response jsonb;scheduled timestamptz:=(command->>'scheduledAt')::timestamptz;
 begin
 if kind='market.import' then
  perform pms_private.require_access(org,'rates.write',prop);perform pms_private.require_access(org,'report.read',prop);
 else
  perform pms_private.require_access(org,'message.write',prop);perform pms_private.require_access(org,'guest.pii.read',prop);
 end if;
 cached:=pms_private.idempotency_start(org,idempotency_key,command);if cached is not null then return cached;end if;
 perform pg_advisory_xact_lock(hashtextextended(prop::text,0));
 if kind='market.import' then
  if jsonb_typeof(command->'rows') is distinct from 'array' or jsonb_array_length(command->'rows') not between 1 and 366 then raise exception 'INVALID_MARKET_ROWS';end if;
  if exists(select 1 from jsonb_array_elements(command->'rows') x group by x->>'date',x->>'observedOn',x->>'source',x->>'market' having count(*)>1) then raise exception 'DUPLICATE_OBSERVATION';end if;
  select p.currency,(now() at time zone p.timezone)::date into prop_currency,as_of from public.properties p where p.id=prop;
  for row in select * from jsonb_array_elements(command->'rows') loop
   if row->>'currency' is distinct from prop_currency::text then raise exception 'MARKET_CURRENCY';end if;
   if row->>'observedOn' is null or (row->>'observedOn')::date>as_of then raise exception 'FUTURE_OBSERVATION';end if;
   insert into public.market_observations(organization_id,property_id,stay_date,observed_on,source,market,currency,adr_minor,occupancy_bps,sample_size)
    values(org,prop,(row->>'date')::date,(row->>'observedOn')::date,trim(row->>'source'),trim(row->>'market'),row->>'currency',(row->>'adrMinor')::bigint,(row->>'occupancyBps')::integer,(row->>'sampleSize')::integer)
    on conflict(property_id,source,market,stay_date,observed_on) do update set adr_minor=excluded.adr_minor,occupancy_bps=excluded.occupancy_bps,sample_size=excluded.sample_size;
  end loop;entity:=prop;
 elsif kind='template.save' then
  perform pms_private.validate_message_template(command->>'body');perform pms_private.validate_message_template(command->>'subject');
  if command ? 'id' then
   select * into template from public.message_templates where id=entity and property_id=prop and organization_id=org for update;
   if not found then raise exception 'NOT_FOUND';end if;
   if template.version is distinct from (command->>'version')::bigint then raise exception 'VERSION_CONFLICT';end if;
   update public.message_templates set name=trim(command->>'name'),locale=command->>'locale',subject=command->>'subject',body=trim(command->>'body'),trigger=command->>'trigger',offset_days=(command->>'offsetDays')::integer,version=version+1 where id=entity;
  else insert into public.message_templates(id,organization_id,property_id,name,locale,subject,body,trigger,offset_days) values(entity,org,prop,trim(command->>'name'),command->>'locale',command->>'subject',trim(command->>'body'),command->>'trigger',(command->>'offsetDays')::integer);end if;
 elsif kind='template.delete' then
  delete from public.message_templates where id=entity and property_id=prop and organization_id=org and version=(command->>'version')::bigint;
  if not found then raise exception 'VERSION_CONFLICT';end if;
 elsif kind='message.cancel' then
  update public.message_entries set status='cancelled',version=version+1 where id=entity and property_id=prop and organization_id=org and status in ('draft','blocked') and version=(command->>'version')::bigint;
  if not found then raise exception 'VERSION_CONFLICT_OR_MESSAGE_STATE';end if;
 elsif kind in ('message.save','conversation.update') then
  select r.status into reservation_status from public.reservations r where r.id=reservation and r.property_id=prop and r.organization_id=org;
  if not found then raise exception 'NOT_FOUND';end if;
  select * into conversation from public.conversations where reservation_id=reservation for update;
  if kind='conversation.update' then
   if conversation.id is not null and conversation.version is distinct from (command->>'version')::bigint or conversation.id is null and command ? 'version' then raise exception 'VERSION_CONFLICT';end if;
   if member is not null and not exists(select 1 from public.organization_members m where m.organization_id=org and m.user_id=member and m.status='active' and (m.all_properties or exists(select 1 from public.member_property_scopes p where p.user_id=member and p.organization_id=org and p.property_id=prop))) then raise exception 'INVALID_ASSIGNEE';end if;
   entity:=coalesce(conversation.id,entity);
   insert into public.conversations(id,organization_id,property_id,reservation_id,status,assignee_id) values(entity,org,prop,reservation,command->>'status',member)
    on conflict(reservation_id) do update set status=excluded.status,assignee_id=excluded.assignee_id,version=public.conversations.version+1,updated_at=now();
  else
   if mode is null or mode not in ('draft','note','prepare') then raise exception 'INVALID_MESSAGE_MODE';end if;
   if mode<>'note' and reservation_status in ('cancelled','no_show') then raise exception 'RESERVATION_INACTIVE';end if;
   if scheduled is not null and scheduled<=now() then raise exception 'PAST_SCHEDULE';end if;
   entry_status:=case mode when 'note' then 'recorded' when 'draft' then 'draft' else 'blocked' end;
   if command ? 'id' then
    select * into old from public.message_entries where id=entity and property_id=prop and organization_id=org and reservation_id=reservation for update;
    if not found then raise exception 'NOT_FOUND';end if;
    if old.version is distinct from (command->>'version')::bigint or old.status<>'draft' then raise exception 'VERSION_CONFLICT_OR_MESSAGE_STATE';end if;
   end if;
   insert into public.message_entries(id,organization_id,property_id,reservation_id,direction,status,subject,body,scheduled_at,failure_code,author_id)
    values(entity,org,prop,reservation,case mode when 'note' then 'internal' else 'outbound' end,entry_status,command->>'subject',trim(command->>'body'),case mode when 'note' then null else scheduled end,case when entry_status='blocked' then 'MESSAGING_PROVIDER_NOT_CONFIGURED' else null end,auth.uid())
    on conflict(id) do update set direction=excluded.direction,status=excluded.status,subject=excluded.subject,body=excluded.body,scheduled_at=excluded.scheduled_at,failure_code=excluded.failure_code,version=public.message_entries.version+1;
   insert into public.conversations(organization_id,property_id,reservation_id) values(org,prop,reservation)
    on conflict(reservation_id) do update set updated_at=now(),version=public.conversations.version+1,status=case when mode='note' then public.conversations.status else 'open' end;
  end if;
 else raise exception 'COMMAND_NOT_AVAILABLE';end if;
 perform pms_private.audit(org,prop,kind,entity,idempotency_key,jsonb_build_object('status',entry_status));
 response:=jsonb_build_object('id',entity,'message','Cambios guardados');
 if entry_status='blocked' then response:=response||jsonb_build_object('warning','Mensaje guardado sin enviar. Conecta un proveedor de mensajería para entregarlo.');end if;
 return pms_private.idempotency_finish(org,idempotency_key,response);
 end $$;
revoke all on function pms_private.hospitality_command(jsonb,text) from public,anon,authenticated;

create or replace function public.pms_command(command jsonb,idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if command->>'type'='reservation.move' then return public.pms_move_reservation(command,idempotency_key);end if;
 if command->>'type' in ('market.import','conversation.update','message.save','message.cancel','template.save','template.delete') then return pms_private.hospitality_command(command,idempotency_key);end if;
 return public.pms_command_core(command,idempotency_key);
end $$;
