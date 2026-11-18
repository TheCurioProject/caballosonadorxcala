-- Replies to OTA guests by e-mail, sent from the host's own mailbox (the one
-- registered in Airbnb / Booking.com). The OTAs only accept relay replies
-- that come from that address, so CALA logs into its SMTP server (for TELUS
-- and Gmail: smtp.gmail.com with a Google app password). The password is
-- encrypted by the server before it reaches this table and is never readable
-- by operators.
create table pms_private.mail_senders(
 property_id uuid primary key references public.properties(id) on delete cascade,
 organization_id uuid not null references public.organizations(id),
 email text not null check(email ~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' and length(email)<=320),
 host text not null check(host ~ '^[a-z0-9.-]+\.[a-z]{2,}$' and length(host)<=253),
 port integer not null check(port in (465,587,2525)),
 username text not null check(length(username) between 1 and 320),
 secret text not null check(length(secret) between 1 and 4000),
 verified_at timestamptz not null default now(),
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now()
);
revoke all on pms_private.mail_senders from public,anon,authenticated;

-- Operator command: save (after the server proved the SMTP login) or remove.
create function public.pms_mail_sender(command jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare kind text:=command->>'type';org uuid:=(command->>'organizationId')::uuid;prop uuid:=(command->>'propertyId')::uuid;addr text;
begin
 if org is null or prop is null then raise exception 'INVALID_COMMAND';end if;
 if not exists(select 1 from public.properties p where p.id=prop and p.organization_id=org) then raise exception 'NOT_FOUND';end if;
 perform pms_private.require_access(org,'channel.manage',prop);
 if kind='save' then
  addr:=lower(trim(coalesce(command->>'email','')));
  insert into pms_private.mail_senders(property_id,organization_id,email,host,port,username,secret,verified_at,updated_by,updated_at)
   values(prop,org,addr,lower(trim(command->>'host')),(command->>'port')::integer,trim(command->>'username'),command->>'secret',now(),auth.uid(),now())
   on conflict(property_id) do update set email=excluded.email,host=excluded.host,port=excluded.port,username=excluded.username,
    secret=excluded.secret,verified_at=now(),updated_by=auth.uid(),updated_at=now();
  perform pms_private.audit(org,prop,'mail.sender_save',prop,'mail.sender_save:'||prop::text,jsonb_build_object('email',addr,'host',lower(trim(command->>'host'))));
  return jsonb_build_object('email',addr);
 elsif kind='remove' then
  delete from pms_private.mail_senders where property_id=prop and organization_id=org;
  update public.ota_messages set status='failed',failure='Se desconectó el correo de envío antes de mandar esta respuesta.'
   where property_id=prop and organization_id=org and direction='outbound' and status='queued';
  perform pms_private.audit(org,prop,'mail.sender_remove',prop,'mail.sender_remove:'||prop::text);
  return jsonb_build_object('removed',true);
 end if;
 raise exception 'UNKNOWN_COMMAND';
end $$;
revoke all on function public.pms_mail_sender(jsonb) from public,anon;
grant execute on function public.pms_mail_sender(jsonb) to authenticated;

-- Server only: the sender of a property, with its encrypted secret.
create function public.pms_service_mail_sender(prop uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('email',s.email,'host',s.host,'port',s.port,'username',s.username,'secret',s.secret,'verifiedAt',s.verified_at)
 from pms_private.mail_senders s where s.property_id=prop $$;

-- Claims queued replies of properties that have a sender (optionally just one).
create function public.pms_service_outbox_claim_sender(max_items integer,only_message uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare claimed jsonb;begin
 update public.ota_messages set status='queued' where status='sending' and sent_at is null and created_at<now()-interval '10 minutes';
 with c as (
  update public.ota_messages m set status='sending' where m.id in (
   select x.id from public.ota_messages x join pms_private.mail_senders s on s.property_id=x.property_id
   where x.status='queued' and x.direction='outbound' and (only_message is null or x.id=only_message)
   order by x.created_at limit greatest(1,least(max_items,50)) for update of x skip locked
  ) returning m.*
 ) select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'propertyId',c.property_id,'body',c.body,'replyTo',t.reply_to,'provider',t.provider,'propertyName',p.name,
    'subject',coalesce(c.subject,(select 'Re: '||regexp_replace(x.subject,'^(re:\s*)+','','i') from public.ota_messages x where x.thread_id=c.thread_id and x.direction='inbound' and x.subject is not null order by x.created_at desc limit 1)))),'[]'::jsonb)
  into claimed
 from c join public.ota_threads t on t.id=c.thread_id join public.properties p on p.id=c.property_id;
 return claimed;
end $$;

do $$ declare fn text; begin
 for fn in select unnest(array['public.pms_service_mail_sender(uuid)','public.pms_service_outbox_claim_sender(integer,uuid)']) loop
  execute format('revoke all on function %s from public,anon,authenticated',fn);
  execute format('grant execute on function %s to service_role',fn);
 end loop;
end $$;
