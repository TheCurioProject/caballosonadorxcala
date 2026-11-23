-- Scheduled guest e-mails from message templates.
-- A template can be sent automatically (by e-mail, to the guest's registered
-- address) N days before/after the booking, arrival or departure at a local
-- time, with up to three link buttons and up to five documents of the
-- property's library attached. Every send is logged once per template and
-- reservation, so the cron never sends the same message twice.

alter table public.message_templates
 add column auto_send boolean not null default false,
 add column send_time time not null default '10:00',
 add column buttons jsonb not null default '[]'::jsonb check(jsonb_typeof(buttons)='array' and jsonb_array_length(buttons)<=3),
 add column document_ids uuid[] not null default '{}' check(cardinality(document_ids)<=5),
 add constraint message_template_auto_trigger check(not auto_send or trigger<>'manual');

-- Two more variables for personalised messages.
create or replace function pms_private.validate_message_template(body text) returns void language plpgsql set search_path='' as $$
 declare match text[];begin
 for match in select regexp_matches(body,'\{\{\s*([^{}]+?)\s*\}\}','g') loop
  if trim(match[1]) not in ('guest_first_name','guest_name','property_name','arrival','departure','check_in','check_out','confirmation_code','unit_name','nights','guest_count') then raise exception 'UNKNOWN_VARIABLE';end if;
 end loop;
 if regexp_replace(body,'\{\{\s*[^{}]+?\s*\}\}','','g') ~ '\{\{|\}\}' then raise exception 'INVALID_VARIABLE';end if;
end $$;
revoke all on function pms_private.validate_message_template(text) from public,anon,authenticated;

-- Documents of the property (the files live in the private Storage bucket
-- "cala-documents" under <organization>/<property>/...).
create table public.message_documents(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,property_id uuid not null,
 name text not null check(length(trim(name)) between 1 and 160),
 file_name text not null check(length(file_name) between 1 and 200),
 content_type text not null check(length(content_type) between 3 and 200),
 size_bytes integer not null check(size_bytes between 1 and 10485760),
 storage_path text not null unique check(length(storage_path) between 10 and 600),
 created_by uuid references auth.users(id),created_at timestamptz not null default now(),
 foreign key(organization_id,property_id) references public.properties(organization_id,id)
);
create index message_documents_property on public.message_documents(property_id,created_at desc);

-- One row per e-mail CALA tried to send (or the host skipped).
create table public.guest_mail_deliveries(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,property_id uuid not null,
 template_id uuid references public.message_templates(id) on delete set null,
 reservation_id uuid not null,
 kind text not null check(kind in ('auto','manual')),
 status text not null check(status in ('sending','sent','failed','skipped')),
 recipient text,subject text not null default '' check(length(subject)<=300),
 failure text check(failure is null or length(failure)<=500),provider_id text,
 due_at timestamptz,sent_at timestamptz,created_by uuid references auth.users(id),created_at timestamptz not null default now(),
 foreign key(organization_id,property_id,reservation_id) references public.reservations(organization_id,property_id,id)
);
create unique index guest_mail_auto_once on public.guest_mail_deliveries(template_id,reservation_id) where kind='auto';
create index guest_mail_deliveries_property on public.guest_mail_deliveries(property_id,created_at desc);
create index guest_mail_deliveries_sending on public.guest_mail_deliveries(created_at) where status='sending';

do $$ declare tab text;begin
 for tab in select unnest(array['message_documents','guest_mail_deliveries']) loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('revoke all on public.%I from public,anon,authenticated',tab);
  execute format('grant select on public.%I to authenticated',tab);
 end loop;
end $$;
create policy message_document_read on public.message_documents for select to authenticated using(pms_private.can_access(organization_id,'message.read',property_id));
create policy guest_mail_delivery_read on public.guest_mail_deliveries for select to authenticated using(pms_private.can_access(organization_id,'message.read',property_id) and pms_private.can_access(organization_id,'guest.pii.read',property_id));

-- Every e-mail that is due between from_ts and to_ts (property time zone).
-- Templates with the same moment (event + days) in several languages count as
-- translations: each guest gets one, in their language, else Spanish, else the
-- oldest. A late booking still gets messages meant for before its arrival.
create function pms_private.guest_mail_schedule(prop uuid,from_ts timestamptz,to_ts timestamptz)
returns table(template_id uuid,reservation_id uuid,property_id uuid,organization_id uuid,due_at timestamptz,recipient text)
language sql stable security definer set search_path='' as $$
 with cand as (
  select t.id tid,t.locale,t.trigger,t.offset_days,t.id::text tkey,r.id rid,r.property_id pid,r.organization_id oid,
   lower(trim(g.email)) mail,nullif(split_part(lower(coalesce(g.language,'')),'-',1),'') lang,r.booked_at,r.departure_date,p.timezone tz,
   ((case t.trigger when 'arrival' then r.arrival_date when 'departure' then r.departure_date else (r.booked_at at time zone p.timezone)::date end
     + t.offset_days) + t.send_time) at time zone p.timezone nominal
  from public.message_templates t
  join public.properties p on p.id=t.property_id and p.organization_id=t.organization_id
  join public.reservations r on r.property_id=t.property_id and r.organization_id=t.organization_id
  join public.guests g on g.id=r.guest_id and g.organization_id=r.organization_id
  where t.auto_send and t.trigger<>'manual' and (prop is null or t.property_id=prop)
   and r.status in ('confirmed','checked_in','checked_out')
   and coalesce(g.email,'') ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
   and r.departure_date>=(from_ts at time zone p.timezone)::date-31
   and r.arrival_date<=(to_ts at time zone p.timezone)::date+31
 ), ranked as (
  select c.*,greatest(c.nominal,c.booked_at) due,
   row_number() over(partition by c.rid,c.trigger,c.offset_days order by coalesce(c.locale=c.lang,false) desc,(c.locale='es') desc,c.tkey) n
  from cand c
 )
 select x.tid,x.rid,x.pid,x.oid,x.due,x.mail from ranked x
 where x.n=1 and x.due>from_ts and x.due<=to_ts
  -- never after the stay for messages meant for before/during it
  and (x.trigger='departure' or x.due<((x.departure_date+1)::timestamp at time zone x.tz))
$$;
revoke all on function pms_private.guest_mail_schedule(uuid,timestamptz,timestamptz) from public,anon,authenticated;

-- Everything the server needs to render and send one delivery.
create function pms_private.guest_mail_payload(delivery uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'id',d.id,'kind',d.kind,'recipient',d.recipient,'propertyId',d.property_id,
  'template',jsonb_build_object('id',t.id,'name',t.name,'locale',t.locale,'subject',t.subject,'body',t.body,'buttons',t.buttons,
   'documents',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'fileName',m.file_name,'contentType',m.content_type,'storagePath',m.storage_path,'size',m.size_bytes) order by array_position(t.document_ids,m.id))
    from public.message_documents m where m.id=any(t.document_ids) and m.property_id=t.property_id),'[]'::jsonb)),
  'reservation',jsonb_build_object('arrival',r.arrival_date,'departure',r.departure_date,'confirmationCode',r.confirmation_code,'adults',r.adults,'children',r.children),
  'guest',jsonb_build_object('firstName',g.first_name,'lastName',g.last_name),
  'property',jsonb_build_object('name',p.name,'timezone',p.timezone,
   'checkIn',coalesce(to_char(s.check_in_from,'HH24:MI'),'15:00'),'checkOut',coalesce(to_char(s.check_out_until,'HH24:MI'),'11:00')),
  'unitName',(select u.name from public.reservation_units ru join public.units u on u.id=ru.unit_id where ru.reservation_id=r.id and ru.unit_id is not null order by ru.arrival_date limit 1))
 from public.guest_mail_deliveries d
 join public.message_templates t on t.id=d.template_id
 join public.reservations r on r.id=d.reservation_id
 join public.guests g on g.id=r.guest_id and g.organization_id=r.organization_id
 join public.properties p on p.id=d.property_id
 left join public.property_settings s on s.property_id=d.property_id
 where d.id=delivery $$;
revoke all on function pms_private.guest_mail_payload(uuid) from public,anon,authenticated;

-- Host side: library, upcoming e-mails, history, skip and send now.
create function public.pms_guest_mail(command jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 op text:=command->>'type';org uuid:=(command->>'organizationId')::uuid;prop uuid:=(command->>'propertyId')::uuid;
 tid uuid:=nullif(command->>'templateId','')::uuid;rid uuid:=nullif(command->>'reservationId','')::uuid;
 entity uuid;path text;mail text;tpl public.message_templates;due timestamptz;
begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED' using errcode='42501';end if;
 if org is null or prop is null or not exists(select 1 from public.properties p where p.id=prop and p.organization_id=org) then raise exception 'NOT_FOUND';end if;
 perform pms_private.require_access(org,'message.read',prop);
 perform pms_private.require_access(org,'guest.pii.read',prop);
 if op='state' then
  return jsonb_build_object(
   'documents',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'fileName',m.file_name,'contentType',m.content_type,'size',m.size_bytes,'createdAt',m.created_at) order by m.created_at desc)
     from public.message_documents m where m.property_id=prop and m.organization_id=org),'[]'::jsonb),
   'upcoming',coalesce((select jsonb_agg(jsonb_build_object('templateId',s.template_id,'reservationId',s.reservation_id,'dueAt',s.due_at,'recipient',s.recipient) order by s.due_at)
     from (select * from pms_private.guest_mail_schedule(prop,now()-interval '24 hours',now()+interval '45 days') x
      where not exists(select 1 from public.guest_mail_deliveries d where d.template_id=x.template_id and d.reservation_id=x.reservation_id and d.kind='auto')
      order by x.due_at limit 200) s),'[]'::jsonb),
   'history',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'templateId',d.template_id,'reservationId',d.reservation_id,'kind',d.kind,'status',d.status,'recipient',d.recipient,'subject',d.subject,'failure',d.failure,'dueAt',d.due_at,'sentAt',d.sent_at,'createdAt',d.created_at) order by d.created_at desc)
     from (select * from public.guest_mail_deliveries where property_id=prop and organization_id=org order by created_at desc limit 200) d),'[]'::jsonb));
 end if;
 perform pms_private.require_access(org,'message.write',prop);
 if op='gate' then return jsonb_build_object('ok',true);
 elsif op='document.save' then
  path:=command->>'storagePath';
  if path is null or position(org::text||'/'||prop::text||'/' in path)<>1 or path ~ '\.\.' then raise exception 'INVALID_DOCUMENT';end if;
  insert into public.message_documents(organization_id,property_id,name,file_name,content_type,size_bytes,storage_path,created_by)
   values(org,prop,trim(command->>'name'),trim(command->>'fileName'),command->>'contentType',(command->>'size')::integer,path,auth.uid()) returning id into entity;
  perform pms_private.audit(org,prop,op,entity,op||':'||entity::text,jsonb_build_object('name',trim(command->>'name')));
  return jsonb_build_object('id',entity);
 elsif op='document.delete' then
  entity:=(command->>'id')::uuid;
  delete from public.message_documents where id=entity and property_id=prop and organization_id=org returning storage_path into path;
  if not found then raise exception 'NOT_FOUND';end if;
  update public.message_templates set document_ids=array_remove(document_ids,entity) where property_id=prop and entity=any(document_ids);
  perform pms_private.audit(org,prop,op,entity,op||':'||entity::text);
  return jsonb_build_object('storagePath',path);
 elsif op in ('delivery.skip','delivery.restore','delivery.send') then
  select * into tpl from public.message_templates where id=tid and property_id=prop and organization_id=org;
  if not found then raise exception 'NOT_FOUND';end if;
  if not exists(select 1 from public.reservations r where r.id=rid and r.property_id=prop and r.organization_id=org) then raise exception 'NOT_FOUND';end if;
  if op='delivery.restore' then
   delete from public.guest_mail_deliveries where template_id=tid and reservation_id=rid and kind='auto' and status='skipped';
   return jsonb_build_object('ok',true);
  end if;
  select lower(trim(g.email)) into mail from public.reservations r join public.guests g on g.id=r.guest_id and g.organization_id=r.organization_id where r.id=rid;
  select s.due_at into due from pms_private.guest_mail_schedule(prop,now()-interval '400 days',now()+interval '400 days') s where s.template_id=tid and s.reservation_id=rid;
  if op='delivery.skip' then
   insert into public.guest_mail_deliveries(organization_id,property_id,template_id,reservation_id,kind,status,recipient,due_at,created_by)
    values(org,prop,tid,rid,'auto','skipped',mail,due,auth.uid())
    on conflict(template_id,reservation_id) where kind='auto' do update set status='skipped',created_by=auth.uid(),created_at=now()
    where public.guest_mail_deliveries.status='failed';
   return jsonb_build_object('ok',true);
  end if;
  -- delivery.send
  if coalesce(mail,'') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'NO_GUEST_EMAIL';end if;
  if (command->>'mode')='auto' then
   insert into public.guest_mail_deliveries(organization_id,property_id,template_id,reservation_id,kind,status,recipient,subject,due_at,created_by)
    values(org,prop,tid,rid,'auto','sending',mail,left(tpl.subject,300),due,auth.uid())
    on conflict(template_id,reservation_id) where kind='auto' do update set status='sending',recipient=excluded.recipient,failure=null,created_by=auth.uid(),created_at=now()
    where public.guest_mail_deliveries.status in ('failed','skipped')
    returning id into entity;
   if entity is null then raise exception 'ALREADY_SENT';end if;
  else
   insert into public.guest_mail_deliveries(organization_id,property_id,template_id,reservation_id,kind,status,recipient,subject,created_by)
    values(org,prop,tid,rid,'manual','sending',mail,left(tpl.subject,300),auth.uid()) returning id into entity;
  end if;
  perform pms_private.audit(org,prop,'guest_mail.send',entity,'guest_mail.send:'||entity::text,jsonb_build_object('template',tid,'reservation',rid));
  return pms_private.guest_mail_payload(entity);
 end if;
 raise exception 'UNKNOWN_COMMAND';
end $$;
revoke all on function public.pms_guest_mail(jsonb) from public,anon;
grant execute on function public.pms_guest_mail(jsonb) to authenticated;

-- Server (cron): claims what is due now. An interrupted send is never retried
-- on its own (the guest might already have it); the host sees it as failed.
create function public.pms_service_guest_mail_claim(max_items integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare claimed jsonb;claimed_ids uuid[];begin
 update public.guest_mail_deliveries set status='failed',failure='El envío se interrumpió. Revisa con el huésped antes de reenviarlo.'
  where status='sending' and created_at<now()-interval '10 minutes';
 with due as (
  select s.* from pms_private.guest_mail_schedule(null,now()-interval '24 hours',now()) s
  where not exists(select 1 from public.guest_mail_deliveries d where d.template_id=s.template_id and d.reservation_id=s.reservation_id and d.kind='auto')
  order by s.due_at limit greatest(1,least(coalesce(max_items,20),50))
 ), ins as (
  insert into public.guest_mail_deliveries(organization_id,property_id,template_id,reservation_id,kind,status,recipient,subject,due_at)
  select d.organization_id,d.property_id,d.template_id,d.reservation_id,'auto','sending',d.recipient,
   left((select t.subject from public.message_templates t where t.id=d.template_id),300),d.due_at from due d
  on conflict(template_id,reservation_id) where kind='auto' do nothing
  returning id
 ) select coalesce(array_agg(ins.id),'{}') into claimed_ids from ins;
 -- new rows are only visible to the next statement
 select coalesce(jsonb_agg(pms_private.guest_mail_payload(x)),'[]'::jsonb) into claimed from unnest(claimed_ids) x;
 return claimed;
end $$;

create function public.pms_service_guest_mail_done(delivery uuid,ok boolean,error_text text,provider_ref text,rendered_subject text) returns void language sql security definer set search_path='' as $$
 update public.guest_mail_deliveries set status=case when ok then 'sent' else 'failed' end,
  sent_at=case when ok then now() else null end,failure=case when ok then null else left(coalesce(error_text,'Error desconocido'),500) end,
  provider_id=provider_ref,subject=coalesce(left(rendered_subject,300),subject)
 where id=delivery and status='sending' $$;

-- Server: reply-to address of the property (the host's connected mailbox).
create function public.pms_service_guest_mail_reply_to(prop uuid) returns text language sql stable security definer set search_path='' as $$
 select s.email from pms_private.mail_senders s where s.property_id=prop $$;

do $$ declare fn text; begin
 for fn in select unnest(array['public.pms_service_guest_mail_claim(integer)','public.pms_service_guest_mail_done(uuid,boolean,text,text,text)','public.pms_service_guest_mail_reply_to(uuid)']) loop
  execute format('revoke all on function %s from public,anon,authenticated',fn);
  execute format('grant execute on function %s to service_role',fn);
 end loop;
end $$;

-- template.save keeps its checks, versioning and audit; this wrapper also
-- stores the e-mail settings (automatic send, time, buttons, documents).
alter function public.pms_command(jsonb,text) rename to pms_command_before_guest_mail;
revoke all on function public.pms_command_before_guest_mail(jsonb,text) from public,anon,authenticated;

create function public.pms_command(command jsonb,idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 result jsonb;entity uuid;prop uuid:=(command->>'propertyId')::uuid;b jsonb;docs uuid[];auto boolean;
begin
 if command->>'type' is distinct from 'template.save' then
  return public.pms_command_before_guest_mail(command,idempotency_key);
 end if;
 result:=public.pms_command_before_guest_mail(command,idempotency_key);
 entity:=(result->>'id')::uuid;
 b:=coalesce(command->'buttons','[]'::jsonb);
 if jsonb_typeof(b)<>'array' or jsonb_array_length(b)>3 then raise exception 'INVALID_BUTTONS';end if;
 if exists(select 1 from jsonb_array_elements(b) x where jsonb_typeof(x)<>'object'
   or length(trim(coalesce(x->>'label','')))not between 1 and 60
   or length(coalesce(x->>'url',''))>2000
   or coalesce(x->>'url','') !~* '^(https?://[^\s]+|mailto:[^\s]+|tel:\+?[0-9 ()-]{4,})$') then raise exception 'INVALID_BUTTONS';end if;
 perform pms_private.validate_message_template(coalesce(string_agg(x->>'url',' '),'')) from jsonb_array_elements(b) x;
 select coalesce(array_agg(distinct v::uuid),'{}') into docs from jsonb_array_elements_text(coalesce(command->'documentIds','[]'::jsonb)) v;
 if cardinality(docs)>5 then raise exception 'TOO_MANY_DOCUMENTS';end if;
 if exists(select 1 from unnest(docs) d where not exists(select 1 from public.message_documents m where m.id=d and m.property_id=prop)) then raise exception 'INVALID_DOCUMENT';end if;
 auto:=coalesce((command->>'autoSend')::boolean,false);
 if auto and command->>'trigger'='manual' then raise exception 'AUTO_NEEDS_TRIGGER';end if;
 update public.message_templates set auto_send=auto,send_time=coalesce(nullif(command->>'sendTime','')::time,'10:00'),
  buttons=(select coalesce(jsonb_agg(jsonb_build_object('label',trim(x->>'label'),'url',trim(x->>'url'))),'[]'::jsonb) from jsonb_array_elements(b) x),
  document_ids=docs
 where id=entity and property_id=prop;
 return result;
end $$;
revoke all on function public.pms_command(jsonb,text) from public,anon;
grant execute on function public.pms_command(jsonb,text) to authenticated;
