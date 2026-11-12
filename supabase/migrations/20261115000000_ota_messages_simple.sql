-- Simpler OTA messages: Resend settings live in the database (no extra env
-- vars), the OTA conversation link is kept per thread, and replies can be
-- recorded as "sent from the OTA" (copy + open), because Airbnb and
-- Booking.com do not reliably accept e-mail replies.
create table pms_private.mail_settings(
 id boolean primary key default true check(id),
 domain text check(domain is null or domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
 webhook_id text,webhook_secret text,
 updated_at timestamptz not null default now()
);
revoke all on pms_private.mail_settings from public,anon,authenticated;

alter table public.ota_threads add column external_url text check(external_url is null or (external_url ~ '^https://' and length(external_url)<=1000));

create function public.pms_service_mail_settings() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_build_object('domain',domain,'webhookId',webhook_id,'webhookSecret',webhook_secret) from pms_private.mail_settings),'{}'::jsonb) $$;
create function public.pms_service_mail_settings_save(new_domain text,new_webhook text,new_secret text) returns void language sql security definer set search_path='' as $$
 insert into pms_private.mail_settings(id,domain,webhook_id,webhook_secret,updated_at) values(true,lower(new_domain),new_webhook,new_secret,now())
 on conflict(id) do update set domain=excluded.domain,webhook_id=excluded.webhook_id,webhook_secret=excluded.webhook_secret,updated_at=now() $$;

create or replace function pms_private.inbox_list(org uuid,prop uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'threads',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'provider',t.provider,'guestName',t.guest_name,'canReply',t.reply_to is not null,'externalUrl',t.external_url,'externalCode',t.external_code,'reservationId',t.reservation_id,'status',t.status,'assigneeId',t.assignee_id,'lastMessageAt',t.last_message_at,'version',t.version) order by t.last_message_at desc) from (select * from public.ota_threads where organization_id=org and property_id=prop order by last_message_at desc limit 300) t),'[]'::jsonb),
  'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'threadId',m.thread_id,'direction',m.direction,'status',m.status,'subject',m.subject,'body',m.body,'failure',m.failure,'authorId',m.author_id,'createdAt',m.created_at,'sentAt',m.sent_at,'version',m.version) order by m.created_at) from public.ota_messages m join (select id from public.ota_threads where organization_id=org and property_id=prop order by last_message_at desc limit 300) t on t.id=m.thread_id),'[]'::jsonb),
  'inbox',(select jsonb_build_object('localPart',i.local_part) from public.mail_inboxes i where i.organization_id=org and i.property_id=prop)
 ) $$;
revoke all on function pms_private.inbox_list(uuid,uuid) from public,anon,authenticated;

create or replace function public.pms_connector(command jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 kind text:=command->>'type';org uuid:=(command->>'organizationId')::uuid;prop uuid:=(command->>'propertyId')::uuid;
 unit uuid;ota text;entity uuid;tok text;t public.ota_threads;m public.ota_messages;lp text;body text;manual boolean;
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
  manual:=coalesce((command->>'manual')::boolean,false);
  if kind='thread.reply' and not manual and t.reply_to is null then raise exception 'NO_REPLY_ADDRESS';end if;
  insert into public.ota_messages(organization_id,property_id,thread_id,direction,status,subject,body,author_id)
   values(org,prop,t.id,case when kind='thread.reply' then 'outbound' else 'internal' end,case when kind='thread.reply' and not manual then 'queued' else 'recorded' end,nullif(trim(coalesce(command->>'subject','')),''),body,auth.uid())
   returning * into m;
  update public.ota_threads set last_message_at=now(),status='open' where id=t.id;
  return jsonb_build_object('id',m.id,'status',m.status);
 end if;
 raise exception 'UNKNOWN_COMMAND';
end $$;
revoke all on function public.pms_connector(jsonb) from public,anon;
grant execute on function public.pms_connector(jsonb) to authenticated;

create or replace function public.pms_service_inbound(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.mail_inboxes;t public.ota_threads;eid uuid;kind text:=payload->>'kind';ota text:=payload->>'provider';
 reply text:=lower(nullif(payload->>'replyTo',''));code text:=nullif(payload->>'externalCode','');guest text:=coalesce(nullif(trim(payload->>'guestName'),''),'Huésped');res uuid:=nullif(payload->>'reservationId','')::uuid;failed uuid;link text:=nullif(left(payload->>'externalUrl',1000),'');
begin
 select * into i from public.mail_inboxes where local_part=lower(payload->>'localPart');
 if i.property_id is null then return jsonb_build_object('status','unknown_inbox');end if;
 if exists(select 1 from public.inbound_emails where resend_id=payload->>'resendId') then return jsonb_build_object('status','duplicate');end if;
 if ota is not null and ota not in ('airbnb','booking','expedia','vrbo','other') then ota:='other';end if;
 if res is not null and not exists(select 1 from public.reservations r where r.id=res and r.property_id=i.property_id) then res:=null;end if;
 if kind='message' and ota is not null then
  select * into t from public.ota_threads where property_id=i.property_id and (
   link is not null and external_url=link
   or reply is not null and reply_to=reply
   or code is not null and external_code=code and provider=ota
   or link is null and reply is null and code is null and provider=ota and lower(guest_name)=lower(guest) and last_message_at>now()-interval '30 days'
  ) order by (link is not null and external_url=link) desc,last_message_at desc limit 1 for update;
  if t.id is null then
   insert into public.ota_threads(organization_id,property_id,provider,guest_name,reply_to,external_code,reservation_id,external_url)
    values(i.organization_id,i.property_id,ota,left(guest,200),reply,code,res,link) returning * into t;
  else
   update public.ota_threads set reply_to=coalesce(reply,reply_to),external_code=coalesce(external_code,code),reservation_id=coalesce(reservation_id,res),external_url=coalesce(link,external_url),status='open',last_message_at=now() where id=t.id;
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

do $$ declare fn text; begin
 for fn in select unnest(array['public.pms_service_mail_settings()','public.pms_service_mail_settings_save(text,text,text)','public.pms_service_inbound(jsonb)']) loop
  execute format('revoke all on function %s from public,anon,authenticated',fn);
  execute format('grant execute on function %s to service_role',fn);
 end loop;
end $$;
