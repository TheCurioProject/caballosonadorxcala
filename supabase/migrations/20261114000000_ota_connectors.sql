-- OTA connectors that work without a certified channel-manager API:
--  * Calendars: per-unit iCal import links (OTA -> CALA blocks) and per-OTA
--    export feeds (CALA -> OTA) whose fetches are recorded, so the assistant
--    can prove that the OTA actually reads CALA's calendar.
--  * Messages: an e-mail relay. OTA notification e-mails are forwarded to a
--    private CALA address; replies go back to the OTA's reply-to relay.
-- Everything is read and written through security-definer RPCs.

-- 1. Export feeds per OTA, with fetch tracking ------------------------------
alter table public.ical_feeds
 add column provider text check(provider in ('airbnb','booking','expedia','vrbo','other')),
 add column last_fetched_at timestamptz,
 add column last_fetch_agent text,
 add column fetch_count integer not null default 0;
create table pms_private.ical_feed_secrets(
 feed_id uuid primary key references public.ical_feeds(id) on delete cascade,
 token text not null
);
revoke all on pms_private.ical_feed_secrets from public,anon,authenticated;

-- The generic "share availability" link no longer revokes the OTA feeds.
create or replace function pms_private.ical_link_command(command jsonb,idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=(command->>'organizationId')::uuid;prop uuid:=(command->>'propertyId')::uuid;unit uuid:=(command->>'unitId')::uuid;
 kind text:=command->>'type';cached jsonb;response jsonb;token text;
begin
 if kind not in ('ical.rotate','ical.revoke') then raise exception 'UNKNOWN_COMMAND';end if;
 perform pms_private.require_access(org,'channel.manage',prop);
 if not exists(select 1 from public.units u join public.inventory_types t on t.id=u.inventory_type_id join public.properties p on p.id=u.property_id and p.organization_id=u.organization_id where u.id=unit and u.organization_id=org and u.property_id=prop and u.active and t.active and p.status='active') then raise exception 'INVALID_UNIT';end if;
 cached:=pms_private.idempotency_start(org,idempotency_key,command);if cached is not null then return cached;end if;
 perform pg_advisory_xact_lock(hashtextextended('ical:'||unit::text,0));
 update public.ical_feeds set revoked_at=now() where unit_id=unit and organization_id=org and property_id=prop and revoked_at is null and provider is null;
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

-- 2. Import links (OTA calendar -> CALA blocks) -----------------------------
create table public.calendar_links(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,property_id uuid not null,unit_id uuid not null,
 provider text not null check(provider in ('airbnb','booking','expedia','vrbo','other')),
 url text not null check(url ~ '^https://[^[:space:]]+$' and length(url)<=2000),
 status text not null default 'pending' check(status in ('pending','ok','error')),
 last_sync_at timestamptz,last_error text,
 event_count integer not null default 0,block_count integer not null default 0,conflict_count integer not null default 0,
 created_by uuid references auth.users(id),created_at timestamptz not null default now(),
 unique(unit_id,provider),
 foreign key(organization_id,property_id,unit_id) references public.units(organization_id,property_id,id) on delete cascade
);
alter table public.calendar_links enable row level security;
revoke all on public.calendar_links from public,anon,authenticated;

-- Exported feeds of an OTA leave out that OTA's own imported events (no echo),
-- but include every other OTA's, so a booking anywhere closes everywhere.
create or replace function public.pms_public_calendar(token text) returns jsonb language plpgsql security definer set search_path='' as $$
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
  select b.id,b.start_date,b.end_date,case when b.status='active' then 1 else 2 end,b.status<>'active',
   case when feed.provider is null then not exists(select 1 from public.ical_events e where e.block_id=b.id)
    else not exists(select 1 from public.ical_events e join public.calendar_links l on l.id::text=e.source_calendar where e.block_id=b.id and l.provider=feed.provider and l.unit_id=feed.unit_id) end
  from public.inventory_blocks b where b.organization_id=feed.organization_id and b.property_id=feed.property_id and b.start_date<end_day and b.end_date>start_day and pms_private.units_conflict(feed.unit_id,b.unit_id)
 ) e;
 if jsonb_array_length(events)>4000 then raise exception 'CALENDAR_TOO_LARGE';end if;
 return jsonb_build_object('today',current_day,'coverageStart',start_day,'coverageEnd',end_day,'events',events);
end $$;
revoke all on function public.pms_public_calendar(text) from public;
grant execute on function public.pms_public_calendar(text) to anon,authenticated;

-- 3. E-mail relay messaging ------------------------------------------------
create table public.mail_inboxes(
 property_id uuid primary key references public.properties(id) on delete cascade,
 organization_id uuid not null references public.organizations(id),
 local_part text not null unique check(local_part ~ '^[a-z0-9-]{8,64}$'),
 created_by uuid references auth.users(id),created_at timestamptz not null default now()
);
create table public.ota_threads(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 property_id uuid not null references public.properties(id) on delete cascade,
 provider text not null check(provider in ('airbnb','booking','expedia','vrbo','other')),
 guest_name text not null check(length(guest_name) between 1 and 200),
 reply_to text check(reply_to is null or length(reply_to)<=320),
 external_code text check(external_code is null or length(external_code)<=60),
 reservation_id uuid references public.reservations(id) on delete set null,
 status text not null default 'open' check(status in ('open','archived')),
 assignee_id uuid references auth.users(id),
 last_message_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 version bigint not null default 1
);
create index ota_threads_property on public.ota_threads(property_id,last_message_at desc);
create index ota_threads_reply on public.ota_threads(property_id,reply_to);
create table public.ota_messages(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,property_id uuid not null,
 thread_id uuid not null references public.ota_threads(id) on delete cascade,
 direction text not null check(direction in ('inbound','outbound','internal')),
 status text not null check(status in ('received','queued','sending','sent','failed','cancelled','recorded')),
 subject text,body text not null check(length(body) between 1 and 20000),
 author_id uuid references auth.users(id),
 external_id text unique,failure text,
 created_at timestamptz not null default now(),sent_at timestamptz,
 version bigint not null default 1
);
create index ota_messages_thread on public.ota_messages(thread_id,created_at);
create index ota_messages_outbox on public.ota_messages(status,created_at) where status in ('queued','sending');
create table public.inbound_emails(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,property_id uuid not null references public.properties(id) on delete cascade,
 resend_id text not null unique,
 kind text not null check(kind in ('message','forwarding','bounce','other')),
 provider text,from_address text,subject text,summary text,
 thread_id uuid references public.ota_threads(id) on delete set null,
 received_at timestamptz not null default now()
);
create index inbound_emails_property on public.inbound_emails(property_id,received_at desc);
do $$ declare tab text; begin
 for tab in select unnest(array['mail_inboxes','ota_threads','ota_messages','inbound_emails']) loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('revoke all on public.%I from public,anon,authenticated',tab);
 end loop;
end $$;

-- 4. Operator RPC ----------------------------------------------------------
create function pms_private.connector_state(org uuid,prop uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'links',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'unitId',l.unit_id,'provider',l.provider,'host',substring(l.url from '^https://([^/?#]+)'),'status',l.status,'lastSyncAt',l.last_sync_at,'lastError',l.last_error,'eventCount',l.event_count,'blockCount',l.block_count,'conflictCount',l.conflict_count,'createdAt',l.created_at) order by l.created_at) from public.calendar_links l where l.organization_id=org and l.property_id=prop),'[]'::jsonb),
  'feeds',coalesce((select jsonb_agg(jsonb_build_object('unitId',f.unit_id,'provider',f.provider,'createdAt',f.created_at,'lastFetchedAt',f.last_fetched_at,'agent',f.last_fetch_agent,'fetchCount',f.fetch_count)) from public.ical_feeds f where f.organization_id=org and f.property_id=prop and f.revoked_at is null and f.provider is not null),'[]'::jsonb),
  'inbox',(select jsonb_build_object('localPart',i.local_part,'createdAt',i.created_at) from public.mail_inboxes i where i.organization_id=org and i.property_id=prop),
  'emails',coalesce((select jsonb_agg(x order by x->>'receivedAt' desc) from (select jsonb_build_object('id',e.id,'kind',e.kind,'provider',e.provider,'from',e.from_address,'subject',e.subject,'summary',e.summary,'threadId',e.thread_id,'receivedAt',e.received_at) x from public.inbound_emails e where e.organization_id=org and e.property_id=prop order by e.received_at desc limit 25) s),'[]'::jsonb),
  'outbound',(select jsonb_build_object('sent',count(*) filter(where m.status='sent'),'failed',count(*) filter(where m.status='failed'),'lastSentAt',max(m.sent_at)) from public.ota_messages m where m.organization_id=org and m.property_id=prop and m.direction='outbound')
 ) $$;
revoke all on function pms_private.connector_state(uuid,uuid) from public,anon,authenticated;

create function pms_private.inbox_list(org uuid,prop uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'threads',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'provider',t.provider,'guestName',t.guest_name,'canReply',t.reply_to is not null,'externalCode',t.external_code,'reservationId',t.reservation_id,'status',t.status,'assigneeId',t.assignee_id,'lastMessageAt',t.last_message_at,'version',t.version) order by t.last_message_at desc) from (select * from public.ota_threads where organization_id=org and property_id=prop order by last_message_at desc limit 300) t),'[]'::jsonb),
  'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'threadId',m.thread_id,'direction',m.direction,'status',m.status,'subject',m.subject,'body',m.body,'failure',m.failure,'authorId',m.author_id,'createdAt',m.created_at,'sentAt',m.sent_at,'version',m.version) order by m.created_at) from public.ota_messages m join (select id from public.ota_threads where organization_id=org and property_id=prop order by last_message_at desc limit 300) t on t.id=m.thread_id),'[]'::jsonb),
  'inbox',(select jsonb_build_object('localPart',i.local_part) from public.mail_inboxes i where i.organization_id=org and i.property_id=prop)
 ) $$;
revoke all on function pms_private.inbox_list(uuid,uuid) from public,anon,authenticated;

create function public.pms_connector(command jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 kind text:=command->>'type';org uuid:=(command->>'organizationId')::uuid;prop uuid:=(command->>'propertyId')::uuid;
 unit uuid;ota text;entity uuid;tok text;t public.ota_threads;m public.ota_messages;lp text;body text;
begin
 if org is null or prop is null then raise exception 'INVALID_COMMAND';end if;
 if not exists(select 1 from public.properties p where p.id=prop and p.organization_id=org) then raise exception 'NOT_FOUND';end if;
 if kind='state' then
  perform pms_private.require_access(org,'channel.manage',prop);
  return pms_private.connector_state(org,prop);
 elsif kind='inbox.list' then
  perform pms_private.require_access(org,'message.read',prop);
  perform pms_private.require_access(org,'guest.pii.read',prop);
  return pms_private.inbox_list(org,prop);
 elsif kind in ('calendar.link','calendar.export') then
  perform pms_private.require_access(org,'channel.manage',prop);
  perform pms_private.require_access(org,'inventory.write',prop);
  unit:=(command->>'unitId')::uuid;ota:=command->>'provider';
  if ota is null or ota not in ('airbnb','booking','expedia','vrbo','other') then raise exception 'INVALID_PROVIDER';end if;
  if not exists(select 1 from public.units u join public.inventory_types ty on ty.id=u.inventory_type_id where u.id=unit and u.organization_id=org and u.property_id=prop and u.active and ty.active) then raise exception 'INVALID_UNIT';end if;
  perform pg_advisory_xact_lock(hashtextextended('ical:'||unit::text,0));
  if kind='calendar.link' then
   if coalesce(command->>'url','') !~ '^https://[^[:space:]]+$' or length(command->>'url')>2000 then raise exception 'INVALID_CALENDAR_URL';end if;
   insert into public.calendar_links(organization_id,property_id,unit_id,provider,url,created_by)
    values(org,prop,unit,ota,command->>'url',auth.uid())
    on conflict(unit_id,provider) do update set url=excluded.url,status='pending',last_error=null
    returning id into entity;
   perform pms_private.audit(org,prop,'calendar.link',entity,'calendar.link:'||entity::text);
   return jsonb_build_object('id',entity);
  end if;
  select f.id,s.token into entity,tok from public.ical_feeds f join pms_private.ical_feed_secrets s on s.feed_id=f.id
   where f.unit_id=unit and f.organization_id=org and f.property_id=prop and f.provider=ota and f.revoked_at is null order by f.created_at desc limit 1;
  if tok is null or coalesce((command->>'rotate')::boolean,false) then
   update public.ical_feeds set revoked_at=now() where unit_id=unit and organization_id=org and property_id=prop and provider=ota and revoked_at is null;
   tok:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
   insert into public.ical_feeds(organization_id,property_id,unit_id,token_hash,created_by,provider)
    values(org,prop,unit,encode(sha256(convert_to(tok,'UTF8')),'hex'),auth.uid(),ota) returning id into entity;
   insert into pms_private.ical_feed_secrets values(entity,tok);
   perform pms_private.audit(org,prop,'calendar.export',unit,'calendar.export:'||entity::text);
  end if;
  return jsonb_build_object('id',entity,'token',tok);
 elsif kind='calendar.unlink' then
  perform pms_private.require_access(org,'channel.manage',prop);
  perform pms_private.require_access(org,'inventory.write',prop);
  entity:=(command->>'id')::uuid;
  select unit_id into unit from public.calendar_links where id=entity and organization_id=org and property_id=prop;
  if unit is null then raise exception 'NOT_FOUND';end if;
  perform pg_advisory_xact_lock(hashtextextended(prop::text,0));
  update public.inventory_blocks b set status='released' from public.ical_events e
   where e.block_id=b.id and e.source_calendar=entity::text and b.status='active';
  delete from public.ical_events where source_calendar=entity::text and organization_id=org;
  delete from public.calendar_links where id=entity;
  perform pms_private.recalculate(prop,(now() at time zone 'utc')::date-1,(now() at time zone 'utc')::date+731);
  perform pms_private.audit(org,prop,'calendar.unlink',entity,'calendar.unlink:'||entity::text);
  return jsonb_build_object('id',entity);
 elsif kind='inbox.enable' then
  perform pms_private.require_access(org,'channel.manage',prop);
  select local_part into lp from public.mail_inboxes where property_id=prop;
  if lp is null then
   lp:='cala-'||substr(replace(gen_random_uuid()::text,'-',''),1,14);
   insert into public.mail_inboxes(property_id,organization_id,local_part,created_by) values(prop,org,lp,auth.uid());
   perform pms_private.audit(org,prop,'inbox.enable',prop,'inbox.enable:'||prop::text);
  end if;
  return jsonb_build_object('localPart',lp);
 elsif kind in ('thread.reply','thread.note','thread.update','thread.cancel') then
  if kind='thread.cancel' then
   perform pms_private.require_access(org,'message.write',prop);
   update public.ota_messages set status='cancelled',version=version+1
    where id=(command->>'id')::uuid and organization_id=org and property_id=prop and status='queued' returning * into m;
   if m.id is null then raise exception 'VERSION_CONFLICT_OR_MESSAGE_STATE';end if;
   return jsonb_build_object('id',m.id);
  end if;
  select * into t from public.ota_threads where id=(command->>'threadId')::uuid and organization_id=org and property_id=prop for update;
  if t.id is null then raise exception 'NOT_FOUND';end if;
  if kind='thread.update' then
   perform pms_private.require_access(org,'message.write',prop);
   if (command->>'version')::bigint is distinct from t.version then raise exception 'VERSION_CONFLICT';end if;
   if command ? 'reservationId' and command->>'reservationId' is not null and not exists(select 1 from public.reservations r where r.id=(command->>'reservationId')::uuid and r.organization_id=org and r.property_id=prop) then raise exception 'NOT_FOUND';end if;
   if command ? 'assigneeId' and command->>'assigneeId' is not null and not exists(select 1 from public.organization_members om where om.organization_id=org and om.user_id=(command->>'assigneeId')::uuid and om.status='active') then raise exception 'NOT_FOUND';end if;
   update public.ota_threads set
    status=case when command->>'status' in ('open','archived') then command->>'status' else status end,
    assignee_id=case when command ? 'assigneeId' then (command->>'assigneeId')::uuid else assignee_id end,
    reservation_id=case when command ? 'reservationId' then (command->>'reservationId')::uuid else reservation_id end,
    version=version+1 where id=t.id;
   return jsonb_build_object('id',t.id);
  end if;
  perform pms_private.require_access(org,'message.write',prop);
  body:=trim(coalesce(command->>'body',''));
  if length(body) not between 1 and 20000 then raise exception 'INVALID_MESSAGE';end if;
  if kind='thread.reply' and t.reply_to is null then raise exception 'NO_REPLY_ADDRESS';end if;
  insert into public.ota_messages(organization_id,property_id,thread_id,direction,status,subject,body,author_id)
   values(org,prop,t.id,case when kind='thread.reply' then 'outbound' else 'internal' end,case when kind='thread.reply' then 'queued' else 'recorded' end,nullif(trim(coalesce(command->>'subject','')),''),body,auth.uid())
   returning * into m;
  update public.ota_threads set last_message_at=now(),status='open' where id=t.id;
  return jsonb_build_object('id',m.id,'status',m.status);
 end if;
 raise exception 'UNKNOWN_COMMAND';
end $$;
revoke all on function public.pms_connector(jsonb) from public,anon;
grant execute on function public.pms_connector(jsonb) to authenticated;

-- 5. Trusted server (service role) RPCs --------------------------------------
create function public.pms_service_calendar_links(only_link uuid default null) returns setof public.calendar_links language sql stable security definer set search_path='' as $$
 select * from public.calendar_links where only_link is null or id=only_link order by last_sync_at nulls first $$;

-- Applies one fetched OTA calendar. events: [{uid,arrival,departure,cancelled}].
-- On error the previous blocks stay untouched (never open dates by accident).
create function public.pms_service_calendar_apply(link uuid,events jsonb,failure text) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.calendar_links;today date;ev jsonb;existing public.ical_events;bid uuid;a date;d date;
 created integer:=0;updated integer:=0;released integer:=0;kept integer:=0;seen text[]:='{}';conflicts jsonb:='[]'::jsonb;label text;
begin
 select * into l from public.calendar_links where id=link for update;
 if l.id is null then raise exception 'NOT_FOUND';end if;
 if failure is not null then
  update public.calendar_links set status='error',last_error=left(failure,500),last_sync_at=now() where id=link;
  return jsonb_build_object('ok',false,'error',failure);
 end if;
 if jsonb_typeof(events) is distinct from 'array' or jsonb_array_length(events)>3000 then raise exception 'INVALID_CALENDAR';end if;
 perform pg_advisory_xact_lock(hashtextextended(l.property_id::text,0));
 select (now() at time zone p.timezone)::date into today from public.properties p where p.id=l.property_id;
 label:=case l.provider when 'airbnb' then 'Airbnb' when 'booking' then 'Booking.com' when 'expedia' then 'Expedia' when 'vrbo' then 'Vrbo' else 'Calendario externo' end||' · reserva externa';
 for ev in select * from jsonb_array_elements(events) loop
  a:=(ev->>'arrival')::date;d:=(ev->>'departure')::date;
  if coalesce((ev->>'cancelled')::boolean,false) or d<=a or d<today or a>today+730 or length(coalesce(ev->>'uid',''))not between 1 and 300 then continue;end if;
  seen:=seen||(ev->>'uid');
  select * into existing from public.ical_events e where e.organization_id=l.organization_id and e.property_id=l.property_id and e.unit_id=l.unit_id and e.provider=l.provider and e.source_calendar=l.id::text and e.uid=ev->>'uid';
  if existing.id is not null and existing.block_id is not null then
   if exists(select 1 from public.inventory_blocks b where b.id=existing.block_id and (b.start_date<>a or b.end_date<>d or b.status<>'active')) then
    update public.inventory_blocks set start_date=a,end_date=d,status='active',reason=label where id=existing.block_id;updated:=updated+1;
   else kept:=kept+1;end if;
   bid:=existing.block_id;
  else
   insert into public.inventory_blocks(organization_id,property_id,unit_id,start_date,end_date,reason) values(l.organization_id,l.property_id,l.unit_id,a,d,label) returning id into bid;
   insert into public.ical_events(organization_id,property_id,unit_id,provider,source_calendar,uid,sequence,fingerprint,block_id)
    values(l.organization_id,l.property_id,l.unit_id,l.provider,l.id::text,ev->>'uid',0,md5(a::text||d::text),bid)
    on conflict(organization_id,property_id,unit_id,provider,source_calendar,uid) do update set block_id=excluded.block_id,fingerprint=excluded.fingerprint;
   created:=created+1;
  end if;
  conflicts:=conflicts||coalesce((select jsonb_agg(jsonb_build_object('code',r.confirmation_code,'arrival',ru.arrival_date,'departure',ru.departure_date,'source',r.source))
   from public.reservations r join public.reservation_units ru on ru.reservation_id=r.id
   where r.property_id=l.property_id and r.status in ('pending','confirmed','checked_in') and ru.arrival_date<d and ru.departure_date>a
    and ru.unit_id is not null and pms_private.units_conflict(l.unit_id,ru.unit_id)),'[]'::jsonb);
 end loop;
 with gone as (
  select e.id,e.block_id from public.ical_events e where e.source_calendar=l.id::text and e.organization_id=l.organization_id and not (e.uid=any(seen))
 ), rel as (
  update public.inventory_blocks b set status='released' from gone where b.id=gone.block_id and b.status='active' returning b.id
 ) select count(*) into released from rel;
 delete from public.ical_events e where e.source_calendar=l.id::text and e.organization_id=l.organization_id and not (e.uid=any(seen));
 perform pms_private.recalculate(l.property_id,today-1,today+731);
 select coalesce(jsonb_agg(distinct x),'[]'::jsonb) into conflicts from jsonb_array_elements(conflicts) x;
 update public.calendar_links set status='ok',last_error=null,last_sync_at=now(),event_count=jsonb_array_length(events),block_count=cardinality(seen),conflict_count=jsonb_array_length(conflicts) where id=link;
 return jsonb_build_object('ok',true,'events',jsonb_array_length(events),'active',cardinality(seen),'created',created,'updated',updated,'released',released,'kept',kept,'conflicts',conflicts);
end $$;

create function public.pms_service_feed_touch(token text,agent text) returns void language sql security definer set search_path='' as $$
 update public.ical_feeds set last_fetched_at=now(),last_fetch_agent=left(agent,300),fetch_count=fetch_count+1
 where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') and revoked_at is null and provider is not null $$;

create function public.pms_service_inbox_owner(local text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('organizationId',i.organization_id,'propertyId',i.property_id,'localPart',i.local_part,
  'reservations',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'code',r.confirmation_code,'source',r.source,'arrival',r.arrival_date,'departure',r.departure_date,'guest',trim(coalesce(g.first_name,'')||' '||coalesce(g.last_name,''))))
   from public.reservations r left join public.guests g on g.id=r.guest_id where r.property_id=i.property_id and r.status<>'draft' and r.departure_date>=current_date-60),'[]'::jsonb))
 from public.mail_inboxes i where i.local_part=lower(local) $$;

-- Stores one received e-mail already parsed by the server.
create function public.pms_service_inbound(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.mail_inboxes;t public.ota_threads;eid uuid;kind text:=payload->>'kind';ota text:=payload->>'provider';
 reply text:=lower(nullif(payload->>'replyTo',''));code text:=nullif(payload->>'externalCode','');guest text:=coalesce(nullif(trim(payload->>'guestName'),''),'Huésped');res uuid:=nullif(payload->>'reservationId','')::uuid;failed uuid;
begin
 select * into i from public.mail_inboxes where local_part=lower(payload->>'localPart');
 if i.property_id is null then return jsonb_build_object('status','unknown_inbox');end if;
 if exists(select 1 from public.inbound_emails where resend_id=payload->>'resendId') then return jsonb_build_object('status','duplicate');end if;
 if ota is not null and ota not in ('airbnb','booking','expedia','vrbo','other') then ota:='other';end if;
 if res is not null and not exists(select 1 from public.reservations r where r.id=res and r.property_id=i.property_id) then res:=null;end if;
 if kind='message' and ota is not null then
  select * into t from public.ota_threads where property_id=i.property_id and (
   reply is not null and reply_to=reply or code is not null and external_code=code and provider=ota
  ) order by last_message_at desc limit 1 for update;
  if t.id is null then
   insert into public.ota_threads(organization_id,property_id,provider,guest_name,reply_to,external_code,reservation_id)
    values(i.organization_id,i.property_id,ota,left(guest,200),reply,code,res) returning * into t;
  else
   update public.ota_threads set reply_to=coalesce(reply,reply_to),external_code=coalesce(external_code,code),reservation_id=coalesce(reservation_id,res),status='open',last_message_at=now() where id=t.id;
  end if;
  insert into public.ota_messages(organization_id,property_id,thread_id,direction,status,subject,body,external_id)
   values(i.organization_id,i.property_id,t.id,'inbound','received',left(payload->>'subject',300),left(payload->>'body',20000),payload->>'resendId');
 elsif kind='bounce' then
  select m.id into failed from public.ota_messages m join public.ota_threads th on th.id=m.thread_id
   where m.property_id=i.property_id and m.direction='outbound' and m.status in ('sent','sending') and m.sent_at>now()-interval '3 days'
    and (reply is null or th.reply_to=reply) order by m.sent_at desc limit 1;
  if failed is not null then update public.ota_messages set status='failed',failure=left(coalesce(payload->>'summary','El canal rechazó el correo.'),500) where id=failed;end if;
 end if;
 insert into public.inbound_emails(organization_id,property_id,resend_id,kind,provider,from_address,subject,summary,thread_id)
  values(i.organization_id,i.property_id,payload->>'resendId',case when kind in ('message','forwarding','bounce') then kind else 'other' end,ota,left(payload->>'from',320),left(payload->>'subject',300),left(payload->>'summary',2000),t.id)
  returning id into eid;
 return jsonb_build_object('status','stored','id',eid,'threadId',t.id,'propertyId',i.property_id);
end $$;

-- Claims queued replies (lease by status), returning what the mailer needs.
create function public.pms_service_outbox_claim(max_items integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare claimed jsonb;begin
 update public.ota_messages set status='queued' where status='sending' and sent_at is null and created_at<now()-interval '10 minutes';
 with c as (
  update public.ota_messages m set status='sending' where m.id in (select id from public.ota_messages where status='queued' order by created_at limit greatest(1,least(max_items,50)) for update skip locked) returning m.*
 ) select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'subject',coalesce(c.subject,(select 'Re: '||regexp_replace(x.subject,'^(re:\s*)+','','i') from public.ota_messages x where x.thread_id=c.thread_id and x.direction='inbound' and x.subject is not null order by x.created_at desc limit 1)),'body',c.body,'replyTo',t.reply_to,'provider',t.provider,'guestName',t.guest_name,'localPart',i.local_part,'propertyName',p.name)),'[]'::jsonb) into claimed
 from c join public.ota_threads t on t.id=c.thread_id join public.mail_inboxes i on i.property_id=c.property_id join public.properties p on p.id=c.property_id;
 return claimed;
end $$;
create function public.pms_service_outbox_done(message uuid,ok boolean,failure text,external text) returns void language sql security definer set search_path='' as $$
 update public.ota_messages set status=case when ok then 'sent' else 'failed' end,sent_at=case when ok then now() else sent_at end,failure=case when ok then null else left(failure,500) end,external_id=coalesce(external,external_id)
 where id=message and status='sending' $$;

-- Resend reported that the OTA relay refused a reply we sent.
create function public.pms_service_message_bounced(external text,reason text) returns void language sql security definer set search_path='' as $$
 update public.ota_messages set status='failed',failure=left(coalesce(reason,'El canal rechazó el correo.'),500)
 where external_id=external and direction='outbound' and status in ('sent','sending') $$;

do $$ declare fn text; begin
 for fn in select unnest(array['public.pms_service_message_bounced(text,text)','public.pms_service_calendar_links(uuid)','public.pms_service_calendar_apply(uuid,jsonb,text)','public.pms_service_feed_touch(text,text)','public.pms_service_inbox_owner(text)','public.pms_service_inbound(jsonb)','public.pms_service_outbox_claim(integer)','public.pms_service_outbox_done(uuid,boolean,text,text)']) loop
  execute format('revoke all on function %s from public,anon,authenticated',fn);
  execute format('grant execute on function %s to service_role',fn);
 end loop;
end $$;
