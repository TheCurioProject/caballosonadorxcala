-- Retreats (the former writers' workshops, same table) are sold with a room
-- included. A retreat on sale closes every room of the website house for its
-- dates: for the public site and, through the iCal feeds, for the OTAs. Only
-- retreat guests can take those rooms.
--
-- During the window each room is covered by exactly one thing: the retreat's
-- own block while it is free, or the retreat guest's reservation once sold.
-- Selling swaps the block for the reservation; an expired or cancelled sale
-- puts the block back. OTAs therefore always see the dates busy.
--
-- OTAs re-export the dates CALA closed on them (Booking.com, Vrbo… write them
-- as plain busy events). Those echoes would land in CALA as "external
-- reservations" and lock the retreat's own rooms. The calendar importer now
-- recognises them (see pms_private.retreat_echo) and never turns them into
-- blocks.

alter table site.writers_workshops
 add column starts_on date,
 add column ends_on date,
 add column stock integer check(stock is null or stock between 0 and 200),
 add column price_minor bigint check(price_minor is null or price_minor between 0 and 100000000000),
 add column blocked_at timestamptz,
 add constraint retreat_window check(starts_on is null or ends_on is null or (ends_on>starts_on and ends_on-starts_on<=120));

create table site.retreat_rooms(
 retreat_id integer not null references site.writers_workshops(id) on delete cascade,
 lodging_id uuid not null references site.lodgings(id),
 block_id uuid unique references public.inventory_blocks(id) on delete set null,
 primary key(retreat_id,lodging_id)
);
create table site.retreat_bookings(
 booking_id integer primary key references site.reservas(id) on delete cascade,
 retreat_id integer not null references site.writers_workshops(id) on delete cascade,
 lodging_id uuid not null references site.lodgings(id),
 guests integer not null check(guests between 1 and 2),
 created_at timestamptz not null default now()
);
create index retreat_bookings_retreat on site.retreat_bookings(retreat_id,lodging_id);

do $$ declare tab text; begin
 for tab in select unnest(array['retreat_rooms','retreat_bookings']) loop
  execute format('alter table site.%I enable row level security',tab);
  execute format('create policy server_only on site.%I for all to cala_site_app using (true) with check (true)',tab);
  execute format('revoke all on site.%I from public,anon,authenticated',tab);
  execute format('grant select,insert,update,delete on site.%I to cala_site_app',tab);
 end loop;
end $$;

alter table public.ical_events add column retreat_echo boolean not null default false;

-- A website payment state that still holds a place.
create function pms_private.retreat_live(status text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(status in ('PENDING','PAID','CONFIRMED','PAYMENT_REVIEW'),false)
$$;

-- Anything else that occupies the unit (or a related one) in [s,e).
create function pms_private.retreat_room_busy(prop uuid,unit uuid,s date,e date,own_block uuid,own_reservation uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.reservations r join public.reservation_units ru on ru.reservation_id=r.id
   where r.property_id=prop and r.status in('pending','confirmed','checked_in','checked_out') and r.id is distinct from own_reservation
    and ru.arrival_date<e and ru.departure_date>s and ru.unit_id is not null and pms_private.units_conflict(unit,ru.unit_id))
 or exists(select 1 from public.inventory_blocks b
   where b.property_id=prop and b.status='active' and b.id is distinct from own_block
    and b.start_date<e and b.end_date>s and pms_private.units_conflict(unit,b.unit_id)
    and not exists(select 1 from pms_private.site_booking_map bm where bm.buffer_id=b.id and own_reservation is not null and bm.reservation_id=own_reservation))
$$;

-- Retreat blocks change only through the retreat (CALA shows a clear message).
create function pms_private.protect_retreat_block() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if coalesce(current_setting('cala.retreat',true),'')<>'on' and exists(select 1 from site.retreat_rooms where block_id=old.id) then
  raise exception 'RETREAT_BLOCK_MANAGED';
 end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
create trigger site_protect_retreat before update or delete on public.inventory_blocks for each row execute function pms_private.protect_retreat_block();

-- Puts the retreat's blocks in line with its dates, status and sales.
-- Returns, per room: open (blocked for the retreat), sold, busy (something
-- else already occupies it, so the retreat cannot offer it) or off.
create function site.retreat_sync(retreat integer,organization uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare w site.writers_workshops;m pms_private.site_property_map;room record;rr site.retreat_rooms;today date;on_sale boolean;
 prior text:=current_setting('cala.bridge_origin',true);guard text:=current_setting('cala.retreat',true);
 rooms jsonb:='[]'::jsonb;state text;bid uuid;label text;changed boolean:=false;kept uuid[]:='{}';begin
 select * into m from pms_private.site_property_map where organization_id=organization order by site_property_id limit 1;
 if m.property_id is null then raise exception 'NOT_FOUND';end if;
 perform pg_advisory_xact_lock(hashtextextended(m.property_id::text,0));
 select * into w from site.writers_workshops where id=retreat for update;
 if w.id is null then raise exception 'NOT_FOUND';end if;
 select (now() at time zone p.timezone)::date into today from public.properties p where p.id=m.property_id;
 if exists(select 1 from site.retreat_bookings rb join site.reservas b on b.id=rb.booking_id
   where rb.retreat_id=w.id and pms_private.retreat_live(b.payment_status) and b.end_date::date>=today
    and (w.starts_on is null or w.ends_on is null or b.start_date::date<>w.starts_on or b.end_date::date<>w.ends_on)) then
  raise exception 'RETREAT_HAS_BOOKINGS';
 end if;
 on_sale:=w.is_active and w.starts_on is not null and w.ends_on is not null and w.ends_on>today;
 label:=left('Retiro · '||w.title_es,200);
 perform set_config('cala.bridge_origin','site',true);perform set_config('cala.retreat','on',true);
 for room in select l.id,l.unit_id from site.lodgings l join public.units u on u.id=l.unit_id
   where l.site_property_id=m.site_property_id and l.kind='room' and l.enabled and u.active order by l.sort_order,l.name_es loop
  kept:=kept||room.id;
  rr:=null;
  select * into rr from site.retreat_rooms where retreat_id=w.id and lodging_id=room.id;
  if exists(select 1 from site.retreat_bookings rb join site.reservas b on b.id=rb.booking_id
    where rb.retreat_id=w.id and rb.lodging_id=room.id and pms_private.retreat_live(b.payment_status)) then
   update public.inventory_blocks set status='released' where id=rr.block_id and status<>'released';
   state:='sold';
  elsif not on_sale then
   update public.inventory_blocks set status='released' where id=rr.block_id and status<>'released';
   state:='off';
  elsif pms_private.retreat_room_busy(m.property_id,room.unit_id,w.starts_on,w.ends_on,rr.block_id,null) then
   update public.inventory_blocks set status='released' where id=rr.block_id and status<>'released';
   state:='busy';
  else
   if rr.block_id is null then
    insert into public.inventory_blocks(organization_id,property_id,unit_id,start_date,end_date,reason)
    values(m.organization_id,m.property_id,room.unit_id,w.starts_on,w.ends_on,label) returning id into bid;
    insert into site.retreat_rooms(retreat_id,lodging_id,block_id) values(w.id,room.id,bid)
    on conflict(retreat_id,lodging_id) do update set block_id=excluded.block_id;
    changed:=true;
   else
    if exists(select 1 from public.inventory_blocks where id=rr.block_id and (start_date<>w.starts_on or end_date<>w.ends_on or status<>'active')) then changed:=true;end if;
    update public.inventory_blocks set unit_id=room.unit_id,start_date=w.starts_on,end_date=w.ends_on,reason=label,status='active' where id=rr.block_id;
   end if;
   state:='open';
  end if;
  rooms:=rooms||jsonb_build_object('lodgingId',room.id,'state',state);
 end loop;
 -- Rooms that left the website keep no retreat block.
 update public.inventory_blocks set status='released'
  where id in(select block_id from site.retreat_rooms where retreat_id=w.id and not (lodging_id=any(kept))) and status<>'released';
 -- When CALA started showing these dates as busy (the OTAs echo them later).
 if changed then update site.writers_workshops set blocked_at=now() where id=w.id;end if;
 perform pms_private.recalculate(m.property_id,today-1,today+731);
 perform set_config('cala.bridge_origin',coalesce(prior,''),true);perform set_config('cala.retreat',coalesce(guard,''),true);
 return jsonb_build_object('onSale',on_sale,'rooms',rooms);
end $$;

-- Public sales state of every retreat: places sold and which rooms are free.
create function site.retreat_offers(organization uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare m pms_private.site_property_map;today date;begin
 select * into m from pms_private.site_property_map where organization_id=organization order by site_property_id limit 1;
 if m.property_id is null then return '[]'::jsonb;end if;
 select (now() at time zone p.timezone)::date into today from public.properties p where p.id=m.property_id;
 return coalesce((select jsonb_agg(jsonb_build_object(
   'id',w.id,'startsOn',w.starts_on,'endsOn',w.ends_on,'stock',w.stock,'priceMinor',w.price_minor,'sold',s.sold,
   'onSale',w.is_active and w.starts_on is not null and w.ends_on is not null and w.starts_on>=today and coalesce(w.price_minor,0)>0 and coalesce(w.stock,0)>0,
   'rooms',coalesce((select jsonb_agg(jsonb_build_object('lodgingId',rr.lodging_id,'capacity',t.max_occupancy,
      'available',coalesce(b.status='active',false) and not pms_private.retreat_room_busy(m.property_id,l.unit_id,w.starts_on,w.ends_on,rr.block_id,null)))
     from site.retreat_rooms rr join site.lodgings l on l.id=rr.lodging_id join public.inventory_types t on t.id=l.inventory_type_id
     left join public.inventory_blocks b on b.id=rr.block_id where rr.retreat_id=w.id),'[]'::jsonb)
  ) order by w.id)
  from site.writers_workshops w
  cross join lateral(select count(*)::integer as sold from site.retreat_bookings rb join site.reservas b on b.id=rb.booking_id
   where rb.retreat_id=w.id and pms_private.retreat_live(b.payment_status)) s),'[]'::jsonb);
end $$;

-- Takes one place: the room's retreat block becomes a pending website booking
-- (CALA reservation at commit). Called inside the checkout transaction.
create function site.retreat_hold(retreat integer,lodging uuid,guests integer,guest jsonb,organization uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare w site.writers_workshops;m pms_private.site_property_map;rr site.retreat_rooms;l site.lodgings;today date;sold integer;sid integer;
 cap integer;turnover integer;prior text:=current_setting('cala.bridge_origin',true);guard text:=current_setting('cala.retreat',true);begin
 select * into m from pms_private.site_property_map where organization_id=organization order by site_property_id limit 1;
 if m.property_id is null then raise exception 'RETREAT_CLOSED';end if;
 perform pg_advisory_xact_lock(hashtextextended(m.property_id::text,0));
 select * into w from site.writers_workshops where id=retreat for update;
 select (now() at time zone p.timezone)::date into today from public.properties p where p.id=m.property_id;
 if w.id is null or not w.is_active or w.starts_on is null or w.ends_on is null or w.starts_on<today
  or coalesce(w.price_minor,0)<=0 or coalesce(w.stock,0)<=0 then raise exception 'RETREAT_CLOSED';end if;
 if guests is null or guests not between 1 and 2 then raise exception 'RETREAT_GUESTS';end if;
 if length(trim(coalesce(guest->>'name','')))<2 or coalesce(guest->>'email','') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'RETREAT_GUEST';end if;
 select count(*) into sold from site.retreat_bookings rb join site.reservas b on b.id=rb.booking_id
  where rb.retreat_id=w.id and pms_private.retreat_live(b.payment_status);
 if sold>=w.stock then raise exception 'RETREAT_SOLD_OUT';end if;
 select * into l from site.lodgings where id=lodging and site_property_id=m.site_property_id and kind='room';
 select * into rr from site.retreat_rooms where retreat_id=w.id and lodging_id=lodging;
 if l.id is null or rr.block_id is null or not exists(select 1 from public.inventory_blocks where id=rr.block_id and status='active')
  or pms_private.retreat_room_busy(m.property_id,l.unit_id,w.starts_on,w.ends_on,rr.block_id,null) then raise exception 'RETREAT_ROOM_TAKEN';end if;
 select t.max_occupancy into cap from public.inventory_types t where t.id=l.inventory_type_id;
 if coalesce(cap,0)<guests then raise exception 'RETREAT_ROOM_CAPACITY';end if;
 -- Cleaning nights after the retreat only when they are still free: the sale never fails for them.
 turnover:=case when l.turnover_nights>0 and not pms_private.retreat_room_busy(m.property_id,l.unit_id,w.ends_on,w.ends_on+l.turnover_nights,null,null) then l.turnover_nights else 0 end;
 perform set_config('cala.bridge_origin','site',true);perform set_config('cala.retreat','on',true);
 update public.inventory_blocks set status='released' where id=rr.block_id;
 perform set_config('cala.bridge_origin',coalesce(prior,''),true);perform set_config('cala.retreat',coalesce(guard,''),true);
 insert into site.reservas(property_id,start_date,end_date,"guestName","guestEmail","guestPhone",payment_status,origin,"totalPrice",deposit_currency,notes,invoice_language,updated_at)
 values(m.site_property_id,w.starts_on,w.ends_on,left(trim(guest->>'name'),255),left(lower(trim(guest->>'email')),255),nullif(left(trim(coalesce(guest->>'phone','')),50),''),
  'PENDING','WEBSITE',w.price_minor::numeric/100,'MXN',
  concat_ws(E'\n','Retiro: '||w.title_es||' (precio total con habitación incluida).','Alojamiento: '||l.name_es||'. Huéspedes: '||guests||' adultos, 0 menores.'),
  case when guest->>'lang'='es' then 'es' else 'en' end,now()) returning id into sid;
 insert into site.booking_lodging(booking_id,lodging_id,adults,children,turnover_nights) values(sid,lodging,guests,0,turnover);
 insert into site.retreat_bookings(booking_id,retreat_id,lodging_id,guests) values(sid,w.id,lodging,guests);
 return sid;
end $$;

-- An expired, failed or cancelled sale gives the room back to the retreat; a
-- sale that becomes valid again takes it.
create function pms_private.retreat_booking_status() returns trigger language plpgsql security definer set search_path='' as $$
declare rb site.retreat_bookings;w site.writers_workshops;rr site.retreat_rooms;l site.lodgings;m pms_private.site_property_map;rid uuid;today date;
 prior text:=current_setting('cala.bridge_origin',true);guard text:=current_setting('cala.retreat',true);begin
 if pms_private.retreat_live(old.payment_status)=pms_private.retreat_live(new.payment_status) then return null;end if;
 select * into rb from site.retreat_bookings where booking_id=new.id;
 if rb.booking_id is null then return null;end if;
 select * into m from pms_private.site_property_map where site_property_id=new.property_id;
 if m.property_id is null then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended(m.property_id::text,0));
 select * into w from site.writers_workshops where id=rb.retreat_id;
 select * into rr from site.retreat_rooms where retreat_id=rb.retreat_id and lodging_id=rb.lodging_id;
 select * into l from site.lodgings where id=rb.lodging_id;
 select reservation_id into rid from pms_private.site_booking_map where site_booking_id=new.id;
 select (now() at time zone p.timezone)::date into today from public.properties p where p.id=m.property_id;
 if rr.block_id is null then return null;end if;
 perform set_config('cala.bridge_origin','site',true);perform set_config('cala.retreat','on',true);
 if pms_private.retreat_live(new.payment_status) then
  update public.inventory_blocks set status='released' where id=rr.block_id and status<>'released';
 elsif w.is_active and w.ends_on>today
  and not exists(select 1 from site.retreat_bookings o join site.reservas b on b.id=o.booking_id
   where o.retreat_id=rb.retreat_id and o.lodging_id=rb.lodging_id and o.booking_id<>new.id and pms_private.retreat_live(b.payment_status))
  and not pms_private.retreat_room_busy(m.property_id,l.unit_id,w.starts_on,w.ends_on,rr.block_id,rid) then
  update public.inventory_blocks set unit_id=l.unit_id,start_date=w.starts_on,end_date=w.ends_on,status='active' where id=rr.block_id;
 end if;
 perform pms_private.recalculate(m.property_id,w.starts_on,w.ends_on+1);
 perform set_config('cala.bridge_origin',coalesce(prior,''),true);perform set_config('cala.retreat',coalesce(guard,''),true);
 return null;
end $$;
create trigger retreat_booking_status after update of payment_status on site.reservas for each row execute function pms_private.retreat_booking_status();

-- A retreat with places still to be enjoyed cannot be deleted; otherwise its blocks go.
create function pms_private.retreat_deleting() returns trigger language plpgsql security definer set search_path='' as $$
declare prop uuid;prior text:=current_setting('cala.bridge_origin',true);guard text:=current_setting('cala.retreat',true);begin
 if exists(select 1 from site.retreat_bookings rb join site.reservas b on b.id=rb.booking_id
   where rb.retreat_id=old.id and pms_private.retreat_live(b.payment_status) and b.end_date::date>=current_date) then
  raise exception 'RETREAT_HAS_BOOKINGS';
 end if;
 select b.property_id into prop from public.inventory_blocks b join site.retreat_rooms rr on rr.block_id=b.id where rr.retreat_id=old.id limit 1;
 if prop is not null then perform pg_advisory_xact_lock(hashtextextended(prop::text,0));end if;
 perform set_config('cala.bridge_origin','site',true);perform set_config('cala.retreat','on',true);
 update public.inventory_blocks set status='released' where id in(select block_id from site.retreat_rooms where retreat_id=old.id) and status<>'released';
 if prop is not null and old.starts_on is not null then perform pms_private.recalculate(prop,old.starts_on,old.ends_on+1);end if;
 perform set_config('cala.bridge_origin',coalesce(prior,''),true);perform set_config('cala.retreat',coalesce(guard,''),true);
 return old;
end $$;
create trigger retreat_delete before delete on site.writers_workshops for each row execute function pms_private.retreat_deleting();

-- Is this OTA event the OTA repeating dates CALA closed for a retreat?
-- Only when (1) it touches a retreat window on a unit the retreat blocks,
-- (2) that OTA had downloaded CALA's feed after the retreat closed the dates
-- (before that it cannot be an echo, so it is a real booking), and (3) every
-- night of it is busy in CALA itself (retreat window, or CALA's own stays and
-- blocks). Bookings the OTA marks as such (Airbnb) never reach this test.
create function pms_private.retreat_echo(link uuid,a date,d date) returns boolean
language sql stable security definer set search_path='' as $$
 with l as (select * from public.calendar_links where id=link),
 w as (
  select w.starts_on,w.ends_on from site.writers_workshops w cross join l
  where w.blocked_at is not null and w.starts_on is not null and w.ends_on is not null and w.starts_on<d and w.ends_on>a
   and exists(select 1 from site.retreat_rooms rr join site.lodgings lg on lg.id=rr.lodging_id join public.units u on u.id=lg.unit_id
    where rr.retreat_id=w.id and u.property_id=l.property_id and pms_private.units_conflict(l.unit_id,lg.unit_id)
     and exists(select 1 from public.ical_feeds f where f.provider=l.provider and f.organization_id=l.organization_id and f.property_id=l.property_id
      and f.revoked_at is null and f.last_fetched_at>w.blocked_at and pms_private.units_conflict(f.unit_id,lg.unit_id)))
 )
 select exists(select 1 from w) and not exists(
  select 1 from l cross join generate_series(a,d-1,interval '1 day') n(day)
  where not exists(select 1 from w where n.day>=w.starts_on and n.day<w.ends_on)
   and not exists(select 1 from public.reservations r join public.reservation_units ru on ru.reservation_id=r.id
    where r.property_id=l.property_id and r.status in('pending','confirmed','checked_in','checked_out')
     and ru.arrival_date<=n.day and ru.departure_date>n.day and ru.unit_id is not null and pms_private.units_conflict(l.unit_id,ru.unit_id))
   and not exists(select 1 from public.inventory_blocks b
    where b.property_id=l.property_id and b.status='active' and b.start_date<=n.day and b.end_date>n.day and pms_private.units_conflict(l.unit_id,b.unit_id)
     and not exists(select 1 from public.ical_events e join public.calendar_links cl on cl.id::text=e.source_calendar where e.block_id=b.id and cl.provider=l.provider))
 )
$$;

-- Same importer as 20261114000000_ota_connectors, plus retreat echoes: they
-- are remembered (retreat_echo) and never become blocks, also after the
-- retreat ends, until the OTA stops sending them.
create or replace function public.pms_service_calendar_apply(link uuid,events jsonb,failure text) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.calendar_links;today date;ev jsonb;existing public.ical_events;bid uuid;a date;d date;
 created integer:=0;updated integer:=0;released integer:=0;kept integer:=0;echoed integer:=0;seen text[]:='{}';conflicts jsonb:='[]'::jsonb;label text;
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
  existing:=null;
  select * into existing from public.ical_events e where e.organization_id=l.organization_id and e.property_id=l.property_id and e.unit_id=l.unit_id and e.provider=l.provider and e.source_calendar=l.id::text and e.uid=ev->>'uid';
  if existing.id is not null and existing.retreat_echo then echoed:=echoed+1;continue;end if;
  if existing.id is null and not coalesce((ev->>'confirmed')::boolean,false) and pms_private.retreat_echo(l.id,a,d) then
   insert into public.ical_events(organization_id,property_id,unit_id,provider,source_calendar,uid,sequence,fingerprint,block_id,retreat_echo)
    values(l.organization_id,l.property_id,l.unit_id,l.provider,l.id::text,ev->>'uid',0,md5(a::text||d::text),null,true)
    on conflict(organization_id,property_id,unit_id,provider,source_calendar,uid) do update set retreat_echo=true,block_id=null;
   echoed:=echoed+1;continue;
  end if;
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
 update public.calendar_links set status='ok',last_error=null,last_sync_at=now(),event_count=jsonb_array_length(events),block_count=cardinality(seen)-echoed,conflict_count=jsonb_array_length(conflicts) where id=link;
 return jsonb_build_object('ok',true,'events',jsonb_array_length(events),'active',cardinality(seen)-echoed,'created',created,'updated',updated,'released',released,'kept',kept,'echoed',echoed,'conflicts',conflicts);
end $$;

revoke all on function pms_private.retreat_live(text),pms_private.retreat_room_busy(uuid,uuid,date,date,uuid,uuid),pms_private.protect_retreat_block(),
 pms_private.retreat_booking_status(),pms_private.retreat_deleting(),pms_private.retreat_echo(uuid,date,date) from public,anon,authenticated;
revoke all on function site.retreat_sync(integer,uuid),site.retreat_offers(uuid),site.retreat_hold(integer,uuid,integer,jsonb,uuid) from public,anon,authenticated;
grant execute on function site.retreat_sync(integer,uuid),site.retreat_offers(uuid),site.retreat_hold(integer,uuid,integer,jsonb,uuid) to cala_site_app;
revoke all on function public.pms_service_calendar_apply(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.pms_service_calendar_apply(uuid,jsonb,text) to service_role;
