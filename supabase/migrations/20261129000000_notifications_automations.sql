-- CALA notifications: the bell in the top bar + browser push on every device.
-- Each notification is one row per recipient, chosen by role / permission and
-- property access, so nobody hears about what their role cannot manage
-- (housekeeping never sees guest names, payments or new bookings).
--
-- It also makes automation rules actually run (until now they were only
-- stored): when a stay is created, cancelled, checked in or checked out, the
-- matching rules create tasks and alert the roles chosen on the rule.
-- Finally `task.complete` lets the person a task belongs to close it with one
-- tap; the leads (owner / admin / manager) are told it is done.

-- ── Automation rule settings ────────────────────────────────────────────────
alter table public.automation_rules
 add column notify_roles text[] not null default '{}',
 add column only_if_pending boolean not null default false,
 add column task_title text check(task_title is null or length(task_title) between 1 and 160),
 add column task_kind text not null default 'housekeeping' check(task_kind in ('housekeeping','maintenance')),
 add column assignee_id uuid references auth.users(id) on delete set null;

-- ── Storage ─────────────────────────────────────────────────────────────────
create table public.notifications(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 property_id uuid references public.properties(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(length(kind) between 1 and 60),
 title text not null check(length(title) between 1 and 200),
 body text not null default '' check(length(body)<=1000),
 url text check(url is null or url ~ '^/admin/'),
 entity_type text,entity_id uuid,
 dedupe_key text not null,
 created_at timestamptz not null default now(),
 read_at timestamptz,pushed_at timestamptz,
 unique(user_id,dedupe_key)
);
create index notifications_user on public.notifications(user_id,created_at desc);
create index notifications_unpushed on public.notifications(created_at) where pushed_at is null;
alter table public.notifications enable row level security;
create policy notifications_own on public.notifications for select to authenticated using(user_id=auth.uid());
grant select on public.notifications to authenticated;

create table public.push_subscriptions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 organization_id uuid not null references public.organizations(id),
 endpoint text not null unique check(endpoint ~ '^https://' and length(endpoint)<=1000),
 p256dh text not null check(length(p256dh) between 20 and 200),
 auth text not null check(length(auth) between 8 and 100),
 user_agent text check(user_agent is null or length(user_agent)<=300),
 created_at timestamptz not null default now(),
 last_used_at timestamptz
);
create index push_subscriptions_user on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_own on public.push_subscriptions for select to authenticated using(user_id=auth.uid());
grant select on public.push_subscriptions to authenticated;

-- ── Fan-out ─────────────────────────────────────────────────────────────────
-- Recipients: active members with access to the property who match a role
-- key, a permission or an explicit user id. The person who caused the event
-- is never notified. `n_body_private` (with the guest's name) only reaches
-- roles allowed to read guest data.
create function pms_private.notify(n_org uuid,n_prop uuid,n_kind text,n_title text,n_body text,n_body_private text,n_url text,
 n_entity_type text,n_entity_id uuid,n_dedupe text,n_permission text,n_roles text[],n_users uuid[]) returns integer
language plpgsql security definer set search_path='' as $$
declare made integer;begin
 insert into public.notifications(organization_id,property_id,user_id,kind,title,body,url,entity_type,entity_id,dedupe_key)
 select n_org,n_prop,m.user_id,n_kind,left(n_title,200),
  left(case when n_body_private is not null and exists(select 1 from public.role_permissions rp where rp.role_id=m.role_id and rp.permission_key='guest.pii.read')
   then n_body_private else coalesce(n_body,'') end,1000),
  n_url,n_entity_type,n_entity_id,n_dedupe
 from public.organization_members m join public.roles r on r.id=m.role_id
 where m.organization_id=n_org and m.status='active'
  and m.user_id is distinct from auth.uid()
  and (n_prop is null or m.all_properties or exists(select 1 from public.member_property_scopes ps where ps.organization_id=n_org and ps.user_id=m.user_id and ps.property_id=n_prop))
  and (m.user_id=any(coalesce(n_users,'{}'::uuid[])) or r.key=any(coalesce(n_roles,'{}'::text[]))
   or (n_permission is not null and exists(select 1 from public.role_permissions rp where rp.role_id=m.role_id and rp.permission_key=n_permission)))
 on conflict do nothing;
 get diagnostics made=row_count;
 return made;
end $$;

create function pms_private.person_name(uid uuid) returns text language plpgsql stable security definer set search_path='' as $$
declare j jsonb;begin
 if uid is null then return null;end if;
 select to_jsonb(u) into j from auth.users u where u.id=uid;
 return coalesce(nullif(trim(j->'raw_user_meta_data'->>'name'),''),nullif(split_part(coalesce(j->>'email',''),'@',1),''));
end $$;

create function pms_private.is_lead(org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_members m join public.roles r on r.id=m.role_id
  where m.organization_id=org and m.user_id=auth.uid() and m.status='active' and r.key in ('owner','admin','manager'));
$$;

-- ── Reservations: built-in notices + automation rules ──────────────────────
create function pms_private.reservation_notify(rid uuid,ev text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.reservations;guest text;unit_names text;dates text;label text;plain text;with_guest text;
 ev_id uuid;rl public.automation_rules;ru record;open_count integer;open_titles text;open_kind text;wanted_title text;
 assignee uuid;link text;begin
 select * into r from public.reservations where id=rid;
 if not found then return;end if;
 select nullif(trim(coalesce(g.first_name,'')||' '||coalesce(g.last_name,'')),'') into guest from public.guests g where g.id=r.guest_id;
 select string_agg(u.name,', ' order by u.name) into unit_names from public.reservation_units x join public.units u on u.id=x.unit_id where x.reservation_id=rid;
 dates:=to_char(r.arrival_date,'DD/MM')||' → '||to_char(r.departure_date,'DD/MM');
 label:=case ev when 'reservation.created' then 'Nueva reserva' when 'reservation.cancelled' then 'Reserva cancelada'
  when 'checkin.completed' then 'Check-in realizado' else 'Check-out realizado' end;
 plain:=concat_ws(' · ',r.confirmation_code,unit_names,dates);
 with_guest:=concat_ws(' · ',guest,r.confirmation_code,unit_names,dates);

 -- Whoever manages reservations hears about new, cancelled and arriving stays.
 if ev in ('reservation.created','reservation.cancelled','checkin.completed') then
  perform pms_private.notify(r.organization_id,r.property_id,ev,label,plain,with_guest,'/admin/reservas/?reservation='||rid,
   'reservation',rid,ev||':'||rid,'reservation.write',null,null);
 end if;

 for rl in select * from public.automation_rules a where a.property_id=r.property_id and a.enabled and a.trigger=ev order by a.name,a.id loop
  -- One run per rule and stay event (a pending stay confirmed later is still "created" once).
  if ev_id is null then
   select o.id into ev_id from public.outbox_events o where o.entity_id=rid and o.type=ev and o.payload->>'source'='automation' limit 1;
   if ev_id is null then
    insert into public.outbox_events(organization_id,property_id,type,entity_id,payload,processed_at)
    values(r.organization_id,r.property_id,ev,rid,jsonb_build_object('source','automation'),now()) returning id into ev_id;
   end if;
  end if;
  insert into public.automation_runs(organization_id,property_id,rule_id,event_id,status)
  values(r.organization_id,r.property_id,rl.id,ev_id,'running') on conflict(rule_id,event_id) do nothing;
  if not found then continue;end if;

  if rl.action='create_task' then
   wanted_title:=coalesce(rl.task_title,rl.name);
   select m.user_id into assignee from public.organization_members m
    where m.organization_id=r.organization_id and m.user_id=rl.assignee_id and m.status='active'
     and (m.all_properties or exists(select 1 from public.member_property_scopes ps where ps.organization_id=m.organization_id and ps.user_id=m.user_id and ps.property_id=r.property_id));
   perform set_config('cala.automation','on',true);
   for ru in select x.unit_id,u.name from public.reservation_units x join public.units u on u.id=x.unit_id where x.reservation_id=rid loop
    if not exists(select 1 from public.tasks t where t.unit_id=ru.unit_id and t.kind=rl.task_kind and t.status<>'completed' and t.title=left(wanted_title||' · '||ru.name,160)) then
     insert into public.tasks(organization_id,property_id,unit_id,kind,title,status,priority,assignee_id)
     values(r.organization_id,r.property_id,ru.unit_id,rl.task_kind,left(wanted_title||' · '||ru.name,160),'pending','normal',assignee);
    end if;
   end loop;
   if not exists(select 1 from public.reservation_units x where x.reservation_id=rid and x.unit_id is not null) then
    insert into public.tasks(organization_id,property_id,unit_id,kind,title,status,priority,assignee_id)
    values(r.organization_id,r.property_id,null,rl.task_kind,left(wanted_title||' · '||r.confirmation_code,160),'pending','normal',assignee);
   end if;
   perform set_config('cala.automation','',true);
  end if;

  if cardinality(rl.notify_roles)>0 or rl.action='notify_team' then
   select count(*),string_agg(t.title,', ' order by t.title),min(t.kind) into open_count,open_titles,open_kind
   from public.tasks t where t.property_id=r.property_id and t.status<>'completed'
    and t.unit_id in (select x.unit_id from public.reservation_units x where x.reservation_id=rid);
   if not (rl.only_if_pending and open_count=0) then
    link:=case when open_count>0 then '/admin/'||case when open_kind='maintenance' then 'mantenimiento' else 'limpieza' end||'/' else '/admin/calendario/' end;
    perform pms_private.notify(r.organization_id,r.property_id,'automation',rl.name,
     concat_ws(' · ',label,plain)||case when open_count>0 then E'\n'||open_count||' por hacer: '||left(open_titles,300) else '' end,
     concat_ws(' · ',label,with_guest)||case when open_count>0 then E'\n'||open_count||' por hacer: '||left(open_titles,300) else '' end,
     link,'reservation',rid,'automation:'||rl.id||':'||ev||':'||rid,null,
     case when cardinality(rl.notify_roles)>0 then rl.notify_roles else array['owner','admin','manager'] end,null);
   end if;
  end if;
  update public.automation_runs set status='completed' where rule_id=rl.id and automation_runs.event_id=ev_id;
 end loop;
end $$;

create function pms_private.reservation_event() returns trigger language plpgsql security definer set search_path='' as $$
declare ev text;begin
 if tg_op='INSERT' then
  -- A website checkout is "pending" until Stripe pays; it is announced when it becomes confirmed.
  if new.status='confirmed' or (new.status='pending' and new.source<>'website') then ev:='reservation.created';end if;
 elsif old.status is distinct from new.status then
  ev:=case
   when new.status='confirmed' and old.status in ('draft','pending') then 'reservation.created'
   -- An abandoned website checkout expiring is not a cancellation anyone needs to hear about.
   when new.status='cancelled' and old.status<>'draft' and not (old.status='pending' and new.source='website') then 'reservation.cancelled'
   when new.status='checked_in' then 'checkin.completed'
   when new.status='checked_out' then 'checkout.completed'
  end;
 end if;
 if ev is null or new.departure_date<current_date-1 then return null;end if;
 -- Notifications never block the reservation write itself.
 begin
  perform pms_private.reservation_notify(new.id,ev);
 exception when others then
  raise warning 'CALA notification for reservation % failed: %',new.id,sqlerrm;
 end;
 return null;
end $$;
create trigger reservation_notifications after insert or update of status on public.reservations
 for each row execute function pms_private.reservation_event();

-- ── Tasks ───────────────────────────────────────────────────────────────────
create function pms_private.task_event() returns trigger language plpgsql security definer set search_path='' as $$
declare place text;link text;who text;begin
 begin
  select u.name into place from public.units u where u.id=new.unit_id;
  place:=coalesce(place,'Propiedad / área común');
  -- Rule-made titles already name the unit ("Limpieza · Room 3").
  place:=case when strpos(new.title,place)>0 then '' else ' · '||place end;
  link:='/admin/'||case when new.kind='maintenance' then 'mantenimiento' else 'limpieza' end||'/';
  if new.assignee_id is not null and new.status<>'completed' and (tg_op='INSERT' or old.assignee_id is distinct from new.assignee_id) then
   perform pms_private.notify(new.organization_id,new.property_id,'task.assigned','Tarea asignada a ti',
    new.title||place||case when new.priority='high' then ' · Prioridad alta' else '' end,null,link,
    'task',new.id,'task.assigned:'||new.id||':'||new.assignee_id,null,null,array[new.assignee_id]);
  elsif tg_op='INSERT' and new.assignee_id is null and coalesce(current_setting('cala.automation',true),'')<>'on' then
   -- Unassigned work goes to the team that does it (rules notify the roles they choose instead).
   perform pms_private.notify(new.organization_id,new.property_id,'task.created',
    case when new.kind='maintenance' then 'Nueva tarea de mantenimiento' else 'Nueva tarea de limpieza' end,
    new.title||place,null,link,'task',new.id,'task.created:'||new.id,null,
    case when new.kind='maintenance' then array['front_desk'] else array['housekeeping'] end,null);
  end if;
  if new.status='completed' and (tg_op='INSERT' or old.status is distinct from 'completed') then
   who:=pms_private.person_name(auth.uid());
   perform pms_private.notify(new.organization_id,new.property_id,'task.completed','Tarea completada',
    new.title||place||coalesce(' · por '||who,''),null,link,'task',new.id,'task.completed:'||new.id||':'||new.version,
    null,array['owner','admin','manager'],null);
  end if;
 exception when others then
  raise warning 'CALA notification for task % failed: %',new.id,sqlerrm;
 end;
 return null;
end $$;
create trigger task_notifications after insert or update of status,assignee_id on public.tasks
 for each row execute function pms_private.task_event();

-- ── Money ───────────────────────────────────────────────────────────────────
create function pms_private.payment_event() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.reservations;guest text;amount text;begin
 if new.provider<>'stripe' or new.status<>'succeeded' then return null;end if;
 begin
  select * into r from public.reservations where id=new.reservation_id;
  select nullif(trim(coalesce(g.first_name,'')||' '||coalesce(g.last_name,'')),'') into guest from public.guests g where g.id=r.guest_id;
  amount:='$'||to_char(new.amount_minor/100.0,'FM999,999,999,990.00')||' '||new.currency;
  perform pms_private.notify(new.organization_id,new.property_id,'payment.received','Pago recibido con tarjeta',
   concat_ws(' · ',amount,r.confirmation_code),concat_ws(' · ',amount,guest,r.confirmation_code),
   '/admin/finanzas/?reservation='||new.reservation_id,'reservation',new.reservation_id,'payment:'||new.id,'finance.read',null,null);
 exception when others then
  raise warning 'CALA notification for payment % failed: %',new.id,sqlerrm;
 end;
 return null;
end $$;
create trigger payment_notifications after insert on public.payments for each row execute function pms_private.payment_event();

-- A website payment that could not be confirmed (dates taken meanwhile).
create function pms_private.integration_alert_event() returns trigger language plpgsql security definer set search_path='' as $$
declare m pms_private.site_property_map;b site.reservas;begin
 if new.status<>'open' or (tg_op='UPDATE' and old.status='open') then return null;end if;
 begin
  select * into b from site.reservas where id=new.booking_id;
  select * into m from pms_private.site_property_map where site_property_id=b.property_id;
  if m.organization_id is null then return null;end if;
  perform pms_private.notify(m.organization_id,m.property_id,'payment.review','Pago web en revisión',
   'Cobrado por Stripe, pero las fechas ya no estaban libres. Reserva web #'||new.booking_id||'.',
   b."guestName"||' pagó, pero las fechas ya no estaban libres. Reserva web #'||new.booking_id||'.',
   '/admin/finanzas/?tab=web','site_booking',null,'alert:'||new.id||':'||to_char(now(),'YYYYMMDDHH24'),'finance.write',null,null);
 exception when others then
  raise warning 'CALA notification for alert % failed: %',new.id,sqlerrm;
 end;
 return null;
end $$;
create trigger integration_alert_notifications after insert or update of status on site.integration_alerts
 for each row execute function pms_private.integration_alert_event();

-- ── Guest messages ──────────────────────────────────────────────────────────
create function pms_private.ota_message_event() returns trigger language plpgsql security definer set search_path='' as $$
declare th public.ota_threads;begin
 if new.direction<>'inbound' then return null;end if;
 begin
  select * into th from public.ota_threads where id=new.thread_id;
  perform pms_private.notify(new.organization_id,new.property_id,'message.received',
   'Mensaje de '||th.guest_name||' ('||initcap(th.provider)||')',left(regexp_replace(new.body,'\s+',' ','g'),180),null,
   '/admin/inbox/','ota_thread',th.id,'message:'||new.id,'message.read',null,null);
 exception when others then
  raise warning 'CALA notification for message % failed: %',new.id,sqlerrm;
 end;
 return null;
end $$;
create trigger ota_message_notifications after insert on public.ota_messages for each row execute function pms_private.ota_message_event();

create function pms_private.guest_message_event() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.reservations;guest text;begin
 if new.direction<>'inbound' then return null;end if;
 begin
  select * into r from public.reservations where id=new.reservation_id;
  select nullif(trim(coalesce(g.first_name,'')||' '||coalesce(g.last_name,'')),'') into guest from public.guests g where g.id=r.guest_id;
  perform pms_private.notify(new.organization_id,new.property_id,'message.received','Mensaje de '||coalesce(guest,'un huésped'),
   left(regexp_replace(new.body,'\s+',' ','g'),180),null,'/admin/inbox/','reservation',new.reservation_id,'message:'||new.id,'message.read',null,null);
 exception when others then
  raise warning 'CALA notification for message % failed: %',new.id,sqlerrm;
 end;
 return null;
end $$;
create trigger guest_message_notifications after insert on public.message_entries for each row execute function pms_private.guest_message_event();

-- ── Commands: task.complete + richer automation.save ───────────────────────
alter function public.pms_command(jsonb,text) rename to pms_command_before_notifications;
revoke all on function public.pms_command_before_notifications(jsonb,text) from public,anon,authenticated;

create function public.pms_command(command jsonb,idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare org uuid:=(command->>'organizationId')::uuid;prop uuid:=(command->>'propertyId')::uuid;
 t public.tasks;target text;cached jsonb;result jsonb;picked text[];member uuid;begin
 if command->>'type'='task.complete' then
  perform pms_private.require_access(org,'operations.write',prop);
  cached:=pms_private.idempotency_start(org,idempotency_key,command);if cached is not null then return cached;end if;
  target:=coalesce(command->>'status','completed');
  if target not in ('pending','in_progress','completed') then raise exception 'INVALID_STATUS';end if;
  select * into t from public.tasks where id=(command->>'id')::uuid and property_id=prop and organization_id=org for update;
  if not found then raise exception 'NOT_FOUND';end if;
  -- A task assigned to someone is theirs; owner, admin and manager may close anyone's.
  if t.assignee_id is not null and t.assignee_id is distinct from auth.uid() and not pms_private.is_lead(org) then raise exception 'TASK_NOT_YOURS';end if;
  if t.status<>target then
   update public.tasks set status=target,version=version+1 where id=t.id;
   if t.kind='housekeeping' and target='completed' and t.unit_id is not null then
    update public.units set housekeeping_status='clean',version=version+1 where id=t.unit_id and property_id=prop;
   end if;
  end if;
  perform pms_private.audit(org,prop,'task.complete',t.id,idempotency_key,jsonb_build_object('status',target));
  return pms_private.idempotency_finish(org,idempotency_key,jsonb_build_object('id',t.id,'message',
   case target when 'completed' then 'Tarea completada' when 'in_progress' then 'Tarea en proceso' else 'Tarea reabierta' end));
 end if;
 if command->>'type'='task.save' and command ? 'id' then
  -- Editing someone else's task is for leads; everyone may edit their own or unassigned work.
  select * into t from public.tasks where id=(command->>'id')::uuid and property_id=prop and organization_id=org;
  if found and t.assignee_id is not null and t.assignee_id is distinct from auth.uid() and not pms_private.is_lead(org) then raise exception 'TASK_NOT_YOURS';end if;
 end if;
 if command->>'type' is distinct from 'automation.save' then
  return public.pms_command_before_notifications(command,idempotency_key);
 end if;
 if command->>'trigger' not in ('reservation.created','reservation.cancelled','checkin.completed','checkout.completed') then raise exception 'INVALID_TRIGGER';end if;
 select coalesce(array_agg(distinct x order by x),'{}') into picked from jsonb_array_elements_text(coalesce(command->'notifyRoles','[]'::jsonb)) x;
 if exists(select 1 from unnest(picked) x where x not in ('owner','admin','manager','front_desk','housekeeping','finance','viewer')) then raise exception 'INVALID_ROLE';end if;
 if coalesce(command->>'taskKind','housekeeping') not in ('housekeeping','maintenance') then raise exception 'INVALID_TASK_KIND';end if;
 member:=nullif(command->>'assigneeId','')::uuid;
 if member is not null and not exists(select 1 from public.organization_members m where m.organization_id=org and m.user_id=member and m.status='active'
   and (m.all_properties or exists(select 1 from public.member_property_scopes ps where ps.organization_id=org and ps.user_id=member and ps.property_id=prop))) then
  raise exception 'INVALID_ASSIGNEE';
 end if;
 result:=public.pms_command_before_notifications(command,idempotency_key);
 update public.automation_rules set notify_roles=picked,only_if_pending=coalesce((command->>'onlyIfPending')::boolean,false),
  task_title=nullif(left(trim(coalesce(command->>'taskTitle','')),160),''),task_kind=coalesce(command->>'taskKind','housekeeping'),assignee_id=member
 where id=(result->>'id')::uuid and property_id=prop;
 return result;
end $$;
revoke all on function public.pms_command(jsonb,text) from public,anon;
grant execute on function public.pms_command(jsonb,text) to authenticated;

-- ── Bell + device subscriptions (signed-in user) ───────────────────────────
create function public.pms_notifications(command jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();act text:=command->>'action';org uuid:=nullif(command->>'organizationId','')::uuid;items jsonb;begin
 if me is null then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if org is null or not exists(select 1 from public.organization_members m where m.organization_id=org and m.user_id=me and m.status='active') then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 if act='list' then
  select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'kind',n.kind,'title',n.title,'body',n.body,'url',n.url,'propertyId',n.property_id,
   'createdAt',n.created_at,'read',n.read_at is not null) order by n.created_at desc),'[]'::jsonb) into items
  from (select * from public.notifications x where x.user_id=me and x.organization_id=org order by x.created_at desc limit 60) n;
  return jsonb_build_object('items',items,
   'unread',(select count(*) from public.notifications x where x.user_id=me and x.organization_id=org and x.read_at is null),
   'devices',(select count(*) from public.push_subscriptions s where s.user_id=me and s.organization_id=org));
 elsif act='read' then
  update public.notifications x set read_at=now() where x.user_id=me and x.organization_id=org and x.read_at is null
   and (command->'ids' is null or x.id in (select v::uuid from jsonb_array_elements_text(command->'ids') v));
  return jsonb_build_object('ok',true);
 elsif act='subscribe' then
  insert into public.push_subscriptions(user_id,organization_id,endpoint,p256dh,auth,user_agent)
  values(me,org,command->>'endpoint',command->>'p256dh',command->>'auth',left(command->>'userAgent',300))
  on conflict(endpoint) do update set user_id=excluded.user_id,organization_id=excluded.organization_id,
   p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent;
  return jsonb_build_object('ok',true);
 elsif act='unsubscribe' then
  delete from public.push_subscriptions s where s.endpoint=command->>'endpoint' and s.user_id=me;
  return jsonb_build_object('ok',true);
 elsif act='test' then
  insert into public.notifications(organization_id,user_id,kind,title,body,url,dedupe_key)
  values(org,me,'test','Notificaciones activadas','Así llegarán los avisos de CALA a este dispositivo.','/admin/inicio/','test:'||gen_random_uuid());
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'INVALID_ACTION';
end $$;
revoke all on function public.pms_notifications(jsonb) from public,anon;
grant execute on function public.pms_notifications(jsonb) to authenticated;

-- ── Push delivery (server, service role) ───────────────────────────────────
create function public.pms_service_push_claim(max_items integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 -- Too old to be useful as a push: keep it on the bell only.
 update public.notifications set pushed_at=now() where pushed_at is null and created_at<now()-interval '6 hours';
 delete from public.notifications where created_at<now()-interval '120 days';
 with picked as (
  select id from public.notifications where pushed_at is null order by created_at limit greatest(1,least(coalesce(max_items,50),200)) for update skip locked
 ), done as (
  update public.notifications n set pushed_at=now() from picked where n.id=picked.id returning n.*
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'kind',d.kind,'title',d.title,'body',d.body,'url',d.url,
  'subscriptions',(select coalesce(jsonb_agg(jsonb_build_object('endpoint',s.endpoint,'p256dh',s.p256dh,'auth',s.auth)),'[]'::jsonb)
   from public.push_subscriptions s where s.user_id=d.user_id and s.organization_id=d.organization_id))),'[]'::jsonb)
 into result from done d;
 return result;
end $$;
create function public.pms_service_push_report(delivered text[],gone text[]) returns void
language sql security definer set search_path='' as $$
 update public.push_subscriptions set last_used_at=now() where endpoint=any(coalesce(delivered,'{}'));
 delete from public.push_subscriptions where endpoint=any(coalesce(gone,'{}'));
$$;
revoke all on function public.pms_service_push_claim(integer),public.pms_service_push_report(text[],text[]) from public,anon,authenticated;
grant execute on function public.pms_service_push_claim(integer),public.pms_service_push_report(text[],text[]) to service_role;

revoke execute on all functions in schema pms_private from public;
