-- OTA replies that behave like a real e-mail reply, and a queue that never
-- sends the same reply twice.
--  * The Message-ID of each OTA notice is kept, so CALA's reply carries
--    In-Reply-To/References (the host's mail client and the OTA relay see it
--    as an answer to that notice).
--  * Each reply remembers the relay address it actually went to: Airbnb uses a
--    new relay per notice, so a later bounce is matched by that address and
--    not by the thread's current one.
--  * A claim older than 10 minutes means the server stopped mid-send. The OTA
--    may already have the reply, so it is marked failed (host checks the OTA)
--    instead of being queued again. The lease is measured from the claim, not
--    from when the reply was written.
--  * The address the OTA wrote to (the notice's To) is kept, so CALA can warn
--    when replies leave from a different mailbox than the one the OTA knows.

alter table public.ota_messages add column if not exists message_id text check(message_id is null or length(message_id)<=500);
alter table public.ota_messages add column if not exists recipient text check(recipient is null or length(recipient)<=320);
alter table public.ota_messages add column if not exists claimed_at timestamptz;
alter table public.inbound_emails add column if not exists to_address text check(to_address is null or length(to_address)<=320);

create or replace function public.pms_service_inbound(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.mail_inboxes;t public.ota_threads;eid uuid;kind text:=payload->>'kind';ota text:=payload->>'provider';
 reply text:=lower(nullif(payload->>'replyTo',''));code text:=nullif(payload->>'externalCode','');guest text:=coalesce(nullif(trim(payload->>'guestName'),''),'Huésped');res uuid:=nullif(payload->>'reservationId','')::uuid;failed uuid;link text:=nullif(left(payload->>'externalUrl',1000),'');
 conv text:=pms_private.ota_conversation(nullif(left(payload->>'externalUrl',1000),''));named boolean:=nullif(trim(payload->>'guestName'),'') is not null;
 mid text:=nullif(left(trim(coalesce(payload->>'messageId','')),500),'');owner text:=nullif(left(lower(trim(coalesce(payload->>'to',''))),320),'');
begin
 select * into i from public.mail_inboxes where local_part=lower(payload->>'localPart');
 if i.property_id is null then return jsonb_build_object('status','unknown_inbox');end if;
 if exists(select 1 from public.inbound_emails where resend_id=payload->>'resendId') then return jsonb_build_object('status','duplicate');end if;
 if ota is not null and ota not in ('airbnb','booking','expedia','vrbo','other') then ota:='other';end if;
 if res is not null and not exists(select 1 from public.reservations r where r.id=res and r.property_id=i.property_id) then res:=null;end if;
 if kind='message' and ota is not null then
  select * into t from public.ota_threads where property_id=i.property_id and (
   link is not null and external_url=link
   or conv is not null and provider=ota and pms_private.ota_conversation(external_url)=conv
   or reply is not null and reply_to=reply
   or code is not null and external_code=code and provider=ota
   or link is null and reply is null and code is null and named and provider=ota and lower(guest_name)=lower(guest) and last_message_at>now()-interval '30 days'
  ) order by (link is not null and external_url=link or conv is not null and pms_private.ota_conversation(external_url)=conv) desc,last_message_at desc limit 1 for update;
  if t.id is null then
   insert into public.ota_threads(organization_id,property_id,provider,guest_name,reply_to,external_code,reservation_id,external_url)
    values(i.organization_id,i.property_id,ota,left(guest,200),reply,code,res,link) returning * into t;
  else
   update public.ota_threads set reply_to=coalesce(reply,reply_to),external_code=coalesce(external_code,code),reservation_id=coalesce(reservation_id,res),external_url=coalesce(link,external_url),
    guest_name=case when named and guest_name ~* '^(huésped|huesped|guest)$' then left(guest,200) else guest_name end,
    status='open',last_message_at=now(),version=version+1 where id=t.id;
  end if;
  insert into public.ota_messages(organization_id,property_id,thread_id,direction,status,subject,body,external_id,message_id)
   values(i.organization_id,i.property_id,t.id,'inbound','received',left(payload->>'subject',300),left(payload->>'body',20000),payload->>'resendId',mid);
 elsif kind='bounce' then
  select m.id into failed from public.ota_messages m join public.ota_threads th on th.id=m.thread_id
   where m.property_id=i.property_id and m.direction='outbound' and m.status in ('sent','sending') and coalesce(m.sent_at,m.claimed_at)>now()-interval '3 days'
    and (reply is null or coalesce(m.recipient,th.reply_to)=reply) order by coalesce(m.sent_at,m.claimed_at) desc limit 1;
  if failed is not null then update public.ota_messages set status='failed',failure=left(coalesce(payload->>'summary','El canal rechazó el correo.'),500) where id=failed;end if;
 end if;
 insert into public.inbound_emails(organization_id,property_id,resend_id,kind,provider,from_address,subject,summary,thread_id,to_address)
  values(i.organization_id,i.property_id,payload->>'resendId',case when kind in ('message','forwarding','bounce') then kind else 'other' end,ota,left(payload->>'from',320),left(payload->>'subject',300),left(payload->>'summary',2000),t.id,case when kind='message' then owner end)
  returning id into eid;
 return jsonb_build_object('status','stored','id',eid,'threadId',t.id,'propertyId',i.property_id);
end $$;

create or replace function public.pms_service_outbox_claim_sender(max_items integer,only_message uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare claimed jsonb;begin
 update public.ota_messages set status='failed',
  failure='No se pudo confirmar si esta respuesta salió. Revisa la conversación en la OTA antes de volver a enviarla.'
  where status='sending' and sent_at is null and coalesce(claimed_at,created_at)<now()-interval '10 minutes';
 with c as (
  update public.ota_messages m set status='sending',claimed_at=now(),recipient=t.reply_to
  from public.ota_threads t
  where t.id=m.thread_id and m.id in (
   select x.id from public.ota_messages x join pms_private.mail_senders s on s.property_id=x.property_id
   where x.status='queued' and x.direction='outbound' and (only_message is null or x.id=only_message)
   order by x.created_at limit greatest(1,least(max_items,50)) for update of x skip locked
  ) returning m.*
 ) select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'propertyId',c.property_id,'body',c.body,'replyTo',c.recipient,'provider',t.provider,'propertyName',p.name,
    'subject',coalesce(c.subject,(select 'Re: '||regexp_replace(x.subject,'^(re:\s*)+','','i') from public.ota_messages x where x.thread_id=c.thread_id and x.direction='inbound' and x.subject is not null order by x.created_at desc limit 1)),
    'inReplyTo',(select x.message_id from public.ota_messages x where x.thread_id=c.thread_id and x.direction='inbound' and x.message_id is not null order by x.created_at desc limit 1),
    'references',(select coalesce(jsonb_agg(r.message_id order by r.created_at),'[]'::jsonb) from (select x.message_id,x.created_at from public.ota_messages x where x.thread_id=c.thread_id and x.direction='inbound' and x.message_id is not null order by x.created_at desc limit 10) r))),'[]'::jsonb)
  into claimed
 from c join public.ota_threads t on t.id=c.thread_id join public.properties p on p.id=c.property_id;
 return claimed;
end $$;

-- Server only: the mailbox the OTAs write to (To of the latest guest notice).
create or replace function public.pms_service_ota_recipient(prop uuid) returns text language sql stable security definer set search_path='' as $$
 select e.to_address from public.inbound_emails e where e.property_id=prop and e.kind='message' and e.to_address is not null order by e.received_at desc limit 1 $$;

do $$ declare fn text; begin
 for fn in select unnest(array['public.pms_service_inbound(jsonb)','public.pms_service_outbox_claim_sender(integer,uuid)','public.pms_service_ota_recipient(uuid)']) loop
  execute format('revoke all on function %s from public,anon,authenticated',fn);
  execute format('grant execute on function %s to service_role',fn);
 end loop;
end $$;
