-- One OTA conversation = one CALA thread. Airbnb puts per-e-mail tracking
-- parameters in its links and uses a different relay address per notice, so
-- threads are now matched by the conversation number inside the link
-- (…/thread/2737368744, …/guest/messages/2737368744). Existing duplicates are
-- merged into the oldest thread.

create or replace function pms_private.ota_conversation(url text) returns text
language sql immutable set search_path='' as $$
 select substring(url from '/(?:thread|threads|messages|conversation|conversations)/([0-9]{4,})')
$$;

create or replace function public.pms_service_inbound(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.mail_inboxes;t public.ota_threads;eid uuid;kind text:=payload->>'kind';ota text:=payload->>'provider';
 reply text:=lower(nullif(payload->>'replyTo',''));code text:=nullif(payload->>'externalCode','');guest text:=coalesce(nullif(trim(payload->>'guestName'),''),'Huésped');res uuid:=nullif(payload->>'reservationId','')::uuid;failed uuid;link text:=nullif(left(payload->>'externalUrl',1000),'');
 conv text:=pms_private.ota_conversation(nullif(left(payload->>'externalUrl',1000),''));named boolean:=nullif(trim(payload->>'guestName'),'') is not null;
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

revoke all on function public.pms_service_inbound(jsonb) from public,anon,authenticated;
grant execute on function public.pms_service_inbound(jsonb) to service_role;
revoke all on function pms_private.ota_conversation(text) from public,anon,authenticated;

-- Merge threads that already split one conversation.
do $$
declare g record;keep uuid;rest uuid[];
begin
 for g in
  select property_id,provider,pms_private.ota_conversation(external_url) conv,array_agg(id order by created_at,id) ids
   from public.ota_threads where pms_private.ota_conversation(external_url) is not null
   group by 1,2,3 having count(*)>1
 loop
  keep:=g.ids[1];rest:=g.ids[2:];
  update public.ota_threads t set
   reply_to=coalesce((select x.reply_to from public.ota_threads x where x.id=any(g.ids) and x.reply_to is not null order by x.last_message_at desc limit 1),t.reply_to),
   external_url=(select x.external_url from public.ota_threads x where x.id=any(g.ids) order by x.last_message_at desc limit 1),
   external_code=coalesce(t.external_code,(select x.external_code from public.ota_threads x where x.id=any(rest) and x.external_code is not null limit 1)),
   reservation_id=coalesce(t.reservation_id,(select x.reservation_id from public.ota_threads x where x.id=any(rest) and x.reservation_id is not null limit 1)),
   assignee_id=coalesce(t.assignee_id,(select x.assignee_id from public.ota_threads x where x.id=any(rest) and x.assignee_id is not null limit 1)),
   guest_name=coalesce((select x.guest_name from public.ota_threads x where x.id=any(g.ids) and x.guest_name !~* '^(huésped|huesped|guest)$' order by x.last_message_at desc limit 1),t.guest_name),
   status=case when exists(select 1 from public.ota_threads x where x.id=any(g.ids) and x.status='open') then 'open' else 'archived' end,
   last_message_at=(select max(x.last_message_at) from public.ota_threads x where x.id=any(g.ids)),
   version=t.version+1
  where t.id=keep;
  update public.ota_messages set thread_id=keep where thread_id=any(rest);
  update public.inbound_emails set thread_id=keep where thread_id=any(rest);
  delete from public.ota_threads where id=any(rest);
 end loop;
end $$;
