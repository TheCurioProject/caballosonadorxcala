-- A single physical house can be sold whole or as rooms. Public content is
-- private to the server; anonymous callers receive only an explicit projection.
create table site.lodgings (
 id uuid primary key default gen_random_uuid(),
 site_property_id integer not null references site.properties(id),
 unit_id uuid not null unique references public.units(id),
 inventory_type_id uuid not null references public.inventory_types(id),
 rate_plan_id uuid not null references public.rate_plans(id),
 kind text not null check(kind in ('whole_home','room')),
 slug text not null unique,
 name_es text not null check(length(name_es) between 1 and 160),
 name_en text not null default '',
 description_es text not null default '', description_en text not null default '',
 beds_es text not null default '', beds_en text not null default '',
 bathrooms integer not null default 1 check(bathrooms between 0 and 100),
 photo_keys text[] not null default '{}', amenities text[] not null default '{}',
 policy_es text not null default '', policy_en text not null default '',
 min_stay integer not null default 2 check(min_stay between 1 and 365),
 max_stay integer not null default 366 check(max_stay between 1 and 366),
 turnover_nights integer not null default 0 check(turnover_nights between 0 and 7),
 lead_time_days integer not null default 0 check(lead_time_days between 0 and 365),
 open_through date,
 published boolean not null default true, enabled boolean not null default true,
 sort_order integer not null default 0, source_apartment_id integer unique,
 version bigint not null default 1, updated_at timestamptz not null default now(),
 check(max_stay>=min_stay)
);
create unique index one_whole_home_per_site_property on site.lodgings(site_property_id) where kind='whole_home';
create table site.booking_lodging (
 booking_id integer primary key references site.reservas(id) on delete cascade,
 lodging_id uuid not null references site.lodgings(id),
 adults integer not null default 1 check(adults between 1 and 100),
 children integer not null default 0 check(children between 0 and 100),
 turnover_nights integer check(turnover_nights between 0 and 7)
);
create function pms_private.snapshot_lodging_terms() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.turnover_nights is null then select turnover_nights into new.turnover_nights from site.lodgings where id=new.lodging_id;end if;
 return new;
end $$;
create trigger snapshot_lodging_terms before insert or update on site.booking_lodging for each row execute function pms_private.snapshot_lodging_terms();
revoke all on function pms_private.snapshot_lodging_terms() from public,anon,authenticated;
-- Legacy closures were house-sale restrictions, not physical room closures.
-- Keeping this explicit prevents flattening six independent room calendars.
create table site.legacy_block_scopes (
 block_id integer primary key references site.blocked_dates(id) on delete cascade,
 scope text not null check(scope='whole_home_sales')
);
create table pms_private.smoobu_imports (
 external_id integer primary key, entity_id uuid not null, kind text not null check(kind in ('reservation','block')),
 fingerprint text not null, original_payload jsonb not null, imported_at timestamptz not null default now()
);
create table pms_private.smoobu_import_state (
 key text primary key, source_fingerprint text not null, completed_at timestamptz not null default now()
);
alter table site.lodgings enable row level security;
alter table site.booking_lodging enable row level security;
alter table site.legacy_block_scopes enable row level security;
create policy server_only on site.lodgings for all to cala_site_app using(true) with check(true);
create policy server_only on site.booking_lodging for all to cala_site_app using(true) with check(true);
create policy server_only on site.legacy_block_scopes for all to cala_site_app using(true) with check(true);
revoke all on site.lodgings,site.booking_lodging,site.legacy_block_scopes from public,anon,authenticated;
grant select,insert,update on site.lodgings,site.booking_lodging to cala_site_app;
grant select on site.legacy_block_scopes to cala_site_app;

create function site.lodging_catalog(include_unpublished boolean,organization uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',l.id,'kind',l.kind,'slug',l.slug,'name',jsonb_build_object('es',l.name_es,'en',coalesce(nullif(l.name_en,''),l.name_es)),
  'description',jsonb_build_object('es',l.description_es,'en',coalesce(nullif(l.description_en,''),l.description_es)),
  'beds',jsonb_build_object('es',l.beds_es,'en',coalesce(nullif(l.beds_en,''),l.beds_es)),
  'bathrooms',l.bathrooms,'photoKeys',l.photo_keys,'amenities',l.amenities,
  'policy',jsonb_build_object('es',l.policy_es,'en',coalesce(nullif(l.policy_en,''),l.policy_es)),
  'capacity',t.max_occupancy,'baseRateMinor',t.base_rate_minor,'fromRateMinor',coalesce((select min(d.amount_minor) from public.rate_day d where d.inventory_type_id=t.id and d.rate_plan_id=l.rate_plan_id and d.occupancy_key='base' and not d.closed and d.amount_minor>0 and d.stay_date>=(now() at time zone p.timezone)::date and (l.open_through is null or d.stay_date<=l.open_through)),t.base_rate_minor),'currency',p.currency,
  'minStay',l.min_stay,'maxStay',l.max_stay,'turnoverNights',l.turnover_nights,'leadTimeDays',l.lead_time_days,
  'openThrough',l.open_through,'published',l.published,'enabled',l.enabled,'sortOrder',l.sort_order,'version',l.version,
  'checkInTime',to_char(s.check_in_from,'HH24:MI'),'checkOutTime',to_char(s.check_out_until,'HH24:MI')
 ) order by l.sort_order,l.name_es),'[]'::jsonb)
 from site.lodgings l join public.units u on u.id=l.unit_id
 join public.inventory_types t on t.id=l.inventory_type_id join public.properties p on p.id=u.property_id
 join public.property_settings s on s.property_id=p.id
 where p.organization_id=organization and (include_unpublished or (l.published and l.enabled and u.active and t.active and p.status='active'));
$$;

create function site.lodging_availability(lodging uuid,organization uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare l site.lodgings;m pms_private.site_property_map;local_today date;begin
 select * into strict l from site.lodgings where id=lodging and published and enabled;
 select * into strict m from pms_private.site_property_map where site_property_id=l.site_property_id and organization_id=organization;
 if not exists(select 1 from public.units u join public.inventory_types t on t.id=u.inventory_type_id where u.id=l.unit_id and u.active and t.active) then raise exception 'LODGING_INACTIVE';end if;
 select (now() at time zone p.timezone)::date into local_today from public.properties p where p.id=m.property_id;
 return jsonb_build_object(
 'reservations',coalesce((select jsonb_agg(jsonb_build_object('checkIn',r.arrival_date,'checkOut',r.departure_date)) from public.reservations r join public.reservation_units ru on ru.reservation_id=r.id where r.property_id=m.property_id and r.status in('pending','confirmed','checked_in','checked_out') and r.departure_date>=local_today and (pms_private.units_conflict(l.unit_id,ru.unit_id) or ru.unit_id is null and ru.inventory_type_id=l.inventory_type_id)),'[]'::jsonb),
 'blocks',coalesce((select jsonb_agg(jsonb_build_object('startDate',b.start_date,'endDate',b.end_date-1,'buffer',b.reason='Preparación después de salida')) from public.inventory_blocks b where b.property_id=m.property_id and b.status='active' and b.end_date>local_today and pms_private.units_conflict(l.unit_id,b.unit_id)),'[]'::jsonb),
 'salesClosures',coalesce((select jsonb_agg(jsonb_build_object('startDate',b.start_date::date,'endDate',b.end_date::date)) from site.blocked_dates b join site.legacy_block_scopes sc on sc.block_id=b.id where b.property_id=l.site_property_id and l.kind='whole_home' and b.end_date::date>=local_today),'[]'::jsonb),
 'pricingRules',coalesce((select jsonb_agg(jsonb_build_object('date',d.stay_date,'priceOverride',d.amount_minor::numeric/100,'closed',d.closed,'minStay',d.min_stay)) from public.rate_day d where d.inventory_type_id=l.inventory_type_id and d.rate_plan_id=l.rate_plan_id and d.occupancy_key='base' and d.stay_date>=local_today),'[]'::jsonb),
 'basePrice',(select t.base_rate_minor::numeric/100 from public.inventory_types t where t.id=l.inventory_type_id),
 'today',local_today,'openThrough',l.open_through,'turnoverNights',l.turnover_nights,'minStay',l.min_stay,'maxStay',l.max_stay,'leadTimeDays',l.lead_time_days,
 'checkInTime',(select to_char(check_in_from,'HH24:MI') from public.property_settings where property_id=m.property_id),
 'checkOutTime',(select to_char(check_out_until,'HH24:MI') from public.property_settings where property_id=m.property_id)
 );
end $$;

create function site.lodging_quote(lodging uuid,arrival date,departure date,adults integer,children integer,organization uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare l site.lodgings;m pms_private.site_property_map;day date;rate public.rate_day;base bigint;total bigint:=0;tax integer;local_today date;begin
 select * into strict l from site.lodgings where id=lodging and published and enabled;
 select * into strict m from pms_private.site_property_map where site_property_id=l.site_property_id and organization_id=organization;
 select (now() at time zone p.timezone)::date into local_today from public.properties p where p.id=m.property_id and p.status='active';
 if local_today is null or adults is null or children is null or adults<1 or children<0 or arrival<local_today+l.lead_time_days or departure-arrival<l.min_stay or departure-arrival>l.max_stay or departure is null or arrival is null or l.open_through is not null and departure>l.open_through+1 then raise exception 'LODGING_RULES';end if;
 if l.kind='whole_home' and exists(select 1 from site.blocked_dates b join site.legacy_block_scopes sc on sc.block_id=b.id where b.property_id=l.site_property_id and b.start_date::date<departure and b.end_date::date>=arrival) then raise exception 'LODGING_SALES_CLOSED';end if;
 select t.base_rate_minor into strict base from public.inventory_types t join public.units u on u.inventory_type_id=t.id where t.id=l.inventory_type_id and u.id=l.unit_id and u.active and t.active and t.max_occupancy>=adults+children;
 perform pms_private.assert_inventory(m.property_id,l.inventory_type_id,l.unit_id,arrival,departure,null,adults+children);
 for day in select generate_series(arrival,departure-1,interval '1 day')::date loop
  select * into rate from public.rate_day d where d.rate_plan_id=l.rate_plan_id and d.inventory_type_id=l.inventory_type_id and d.stay_date=day and d.occupancy_key='base';
  if found then
   if rate.closed or departure-arrival<rate.min_stay or departure-arrival>rate.max_stay or day=arrival and rate.cta then raise exception 'RATE_RESTRICTION';end if;
   total:=total+rate.amount_minor;
  else total:=total+base;end if;
 end loop;
 if exists(select 1 from public.rate_day where rate_plan_id=l.rate_plan_id and inventory_type_id=l.inventory_type_id and stay_date=departure and ctd) then raise exception 'DEPARTURE_CLOSED';end if;
 select tax_bps into tax from public.property_settings where property_id=m.property_id;
 return total+round(total::numeric*coalesce(tax,0)/10000)::bigint;
end $$;
revoke all on function site.lodging_catalog(boolean,uuid),site.lodging_availability(uuid,uuid),site.lodging_quote(uuid,date,date,integer,integer,uuid) from public,anon,authenticated;
grant execute on function site.lodging_catalog(boolean,uuid),site.lodging_availability(uuid,uuid),site.lodging_quote(uuid,date,date,integer,integer,uuid) to cala_site_app;

create function site.save_lodging(lodging uuid,expected_version bigint,payload jsonb,organization uuid) returns bigint
language plpgsql security definer set search_path='' as $$
declare l site.lodgings;m pms_private.site_property_map;new_version bigint;actor uuid:=(payload->>'actorId')::uuid;begin
 select * into strict l from site.lodgings where id=lodging;
 select * into strict m from pms_private.site_property_map where site_property_id=l.site_property_id and organization_id=organization;
 perform pg_advisory_xact_lock(hashtextextended(m.property_id::text,0));
 select * into strict l from site.lodgings where id=lodging for update;
 if not exists(select 1 from public.organization_members mb join public.roles r on r.id=mb.role_id where mb.organization_id=organization and mb.user_id=actor and mb.status='active' and mb.all_properties and r.key in('owner','admin','manager')) then raise exception 'FORBIDDEN';end if;
 if expected_version is null or l.version<>expected_version then raise exception 'VERSION_CONFLICT';end if;
 if exists(select 1 from public.reservation_units ru join public.reservations r on r.id=ru.reservation_id where ru.unit_id=l.unit_id and r.status in('pending','confirmed','checked_in') and r.departure_date>=current_date and ru.guests_count>(payload->>'capacity')::integer) then raise exception 'OCCUPANCY_CONFLICT';end if;
 update site.lodgings set name_es=payload->'name'->>'es',name_en=payload->'name'->>'en',
 description_es=payload->'description'->>'es',description_en=payload->'description'->>'en',
 beds_es=payload->'beds'->>'es',beds_en=payload->'beds'->>'en',
 policy_es=payload->'policy'->>'es',policy_en=payload->'policy'->>'en',
 bathrooms=(payload->>'bathrooms')::integer,amenities=array(select jsonb_array_elements_text(payload->'amenities')),
 min_stay=(payload->>'minStay')::integer,max_stay=(payload->>'maxStay')::integer,
 turnover_nights=(payload->>'turnoverNights')::integer,lead_time_days=(payload->>'leadTimeDays')::integer,
 open_through=(payload->>'openThrough')::date,published=(payload->>'published')::boolean,enabled=(payload->>'enabled')::boolean,
 version=version+1,updated_at=now() where id=lodging returning version into new_version;
 update public.inventory_types set name=payload->'name'->>'es',max_occupancy=(payload->>'capacity')::integer,base_rate_minor=(payload->>'baseRateMinor')::bigint where id=l.inventory_type_id;
 update public.units set name=payload->'name'->>'es',version=version+1 where id=l.unit_id;
 if l.kind='whole_home' and payload ? 'checkInTime' and payload ? 'checkOutTime' then
  update public.property_settings set check_in_from=(payload->>'checkInTime')::time,check_out_until=(payload->>'checkOutTime')::time where property_id=m.property_id;
 end if;
 insert into public.audit_logs(organization_id,property_id,actor_type,action,entity_type,entity_id,request_id)
 values(m.organization_id,m.property_id,'user','site.lodging.save','lodging',lodging,'lodging:'||lodging||':'||new_version);
 update public.audit_logs set actor_id=actor where request_id='lodging:'||lodging||':'||new_version and organization_id=organization;
 return new_version;
end $$;
create function site.save_sales_closure(payload jsonb,organization uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare l site.lodgings;m pms_private.site_property_map;b site.blocked_dates;sid integer;actor uuid:=(payload->>'actorId')::uuid;prior text:=current_setting('cala.bridge_origin',true);begin
 select * into strict l from site.lodgings where id=(payload->>'lodgingId')::uuid and kind='whole_home';
 select * into strict m from pms_private.site_property_map where site_property_id=l.site_property_id and organization_id=organization;
 perform pg_advisory_xact_lock(hashtextextended(m.property_id::text,0));
 if not exists(select 1 from public.organization_members mb join public.roles r on r.id=mb.role_id where mb.organization_id=organization and mb.user_id=actor and mb.status='active' and mb.all_properties and r.key in('owner','admin','manager')) then raise exception 'FORBIDDEN';end if;
 sid:=(payload->>'id')::integer;
 if sid is not null then
  select b0.* into strict b from site.blocked_dates b0 join site.legacy_block_scopes sc on sc.block_id=b0.id where b0.id=sid and b0.property_id=l.site_property_id for update of b0;
  if payload->>'updatedAt' is null or b.updated_at is distinct from ((payload->>'updatedAt')::timestamptz at time zone 'UTC') then raise exception 'VERSION_CONFLICT';end if;
 end if;
 if coalesce((payload->>'remove')::boolean,false) then delete from site.blocked_dates where id=sid;return sid;end if;
 if (payload->>'startDate')::date is null or (payload->>'endDate')::date is null or (payload->>'endDate')::date<(payload->>'startDate')::date then raise exception 'INVALID_DATES';end if;
 perform set_config('cala.bridge_origin','site',true);
 if sid is null then
  insert into site.blocked_dates(property_id,start_date,end_date,reason,source,updated_at) values(l.site_property_id,(payload->>'startDate')::date,(payload->>'endDate')::date,coalesce(nullif(payload->>'reason',''),'Cierre de venta de casa completa'),'manual',now()) returning id into sid;
  insert into site.legacy_block_scopes values(sid,'whole_home_sales');
 else update site.blocked_dates set start_date=(payload->>'startDate')::date,end_date=(payload->>'endDate')::date,reason=coalesce(nullif(payload->>'reason',''),'Cierre de venta de casa completa'),updated_at=now() where id=sid;end if;
 perform set_config('cala.bridge_origin',coalesce(prior,''),true);return sid;
end $$;
revoke all on function site.save_lodging(uuid,bigint,jsonb,uuid),site.save_sales_closure(jsonb,uuid) from public,anon,authenticated;
grant execute on function site.save_lodging(uuid,bigint,jsonb,uuid),site.save_sales_closure(jsonb,uuid) to cala_site_app;

-- Preserve bidirectional website/PMS synchronization for every assigned room.
create or replace function pms_private.assert_inventory(prop uuid,type_id uuid,unit uuid,arrival date,departure date,exclude_reservation uuid,people integer) returns void
language plpgsql security definer set search_path='' as $$
declare m pms_private.site_property_map;buffer uuid;buffer_status text;turnover integer:=1;prior text:=current_setting('cala.bridge_origin',true);begin
 select * into m from pms_private.site_property_map where property_id=prop;
 if found then
  if exists(select 1 from site.lodgings where site_property_id=m.site_property_id) then
   if unit is null or not pms_private.units_conflict(unit,m.unit_id) then raise exception 'SITE_INVENTORY_SCOPE';end if;
   select coalesce((select bl.turnover_nights from site.booking_lodging bl join pms_private.site_booking_map bm on bm.site_booking_id=bl.booking_id where bm.reservation_id=exclude_reservation),(select turnover_nights from site.lodgings where unit_id=unit),0) into turnover;
  elsif type_id<>m.inventory_type_id or unit is distinct from m.unit_id then raise exception 'SITE_INVENTORY_SCOPE';end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(prop::text,0));
 select buffer_id into buffer from pms_private.site_booking_map where reservation_id=exclude_reservation;
 select status into buffer_status from public.inventory_blocks where id=buffer;
 perform set_config('cala.bridge_origin','inventory_check',true);
 update public.inventory_blocks set status='released' where id=buffer;
 perform pms_private.assert_inventory_core(prop,type_id,unit,arrival,departure,exclude_reservation,people);
 if m.property_id is not null and turnover>0 then perform pms_private.assert_inventory_core(prop,type_id,unit,departure,departure+turnover,exclude_reservation,people);end if;
 update public.inventory_blocks set status=buffer_status where id=buffer;
 perform set_config('cala.bridge_origin',coalesce(prior,''),true);
end $$;

create or replace function pms_private.sync_site_booking(site_id integer) returns void
language plpgsql security definer set search_path='' as $$
declare b site.reservas;m pms_private.site_property_map;link pms_private.site_booking_map;rid uuid;gid uuid;fid uuid;bid uuid;
 desired text;prior text:=current_setting('cala.bridge_origin',true);extra bigint;room bigint;grand bigint;review boolean:=false;people integer:=1;selection site.booking_lodging;chosen site.lodgings;existing_unit public.reservation_units;turnover integer:=1;begin
 select * into b from site.reservas where id=site_id;if not found then return;end if;
 select * into strict m from pms_private.site_property_map where site_property_id=b.property_id;
 perform pg_advisory_xact_lock(hashtextextended(m.property_id::text,0));
 perform set_config('cala.bridge_origin','site',true);
 select * into link from pms_private.site_booking_map where site_booking_id=site_id;
 select * into selection from site.booking_lodging where booking_id=site_id;
 select * into chosen from site.lodgings where id=selection.lodging_id and site_property_id=b.property_id;
 if chosen.id is not null then
  m.unit_id:=chosen.unit_id;m.inventory_type_id:=chosen.inventory_type_id;m.rate_plan_id:=chosen.rate_plan_id;turnover:=coalesce(selection.turnover_nights,chosen.turnover_nights);
 elsif link.reservation_id is not null then
  select * into existing_unit from public.reservation_units where reservation_id=link.reservation_id limit 1;
  if existing_unit.id is not null then m.unit_id:=existing_unit.unit_id;m.inventory_type_id:=existing_unit.inventory_type_id;m.rate_plan_id:=existing_unit.rate_plan_id;end if;
  if exists(select 1 from site.lodgings where site_property_id=b.property_id) then turnover:=coalesce((select turnover_nights from site.lodgings where unit_id=m.unit_id),0);end if;
 end if;
 if link.fingerprint=pms_private.site_booking_fingerprint(site_id) then perform set_config('cala.bridge_origin',coalesce(prior,''),true);return;end if;
 if link.reservation_id is null and selection.booking_id is null then
  b.notes:=concat_ws(E'\n',nullif(b.notes,''),'Revisar número de huéspedes: la reserva de la web no guardaba ocupación; se muestra un adulto provisional.');
  update site.reservas set notes=b.notes where id=site_id;
 end if;
 rid:=coalesce(link.reservation_id,gen_random_uuid());
 select guest_id into gid from public.reservations where id=rid;
 gid:=coalesce(gid,gen_random_uuid());
 select coalesce(selection.adults+selection.children,(select adults+children from public.reservations where id=rid),1) into people;
 desired:=case when b.payment_status='PENDING' then 'pending' when b.payment_status in('PAID','CONFIRMED') then 'confirmed' when b.payment_status='PAYMENT_REVIEW' then 'draft' else 'cancelled' end;
 -- CHECKED_IN/OUT is a PMS lifecycle, not a new payment state.
 if desired='confirmed' and exists(select 1 from public.reservations where id=rid and status in('checked_in','checked_out')) then select status into desired from public.reservations where id=rid;end if;
 if desired in('pending','confirmed','checked_in','checked_out') then
  begin
   perform pms_private.assert_inventory(m.property_id,m.inventory_type_id,m.unit_id,b.start_date::date,b.end_date::date,rid,people);
  exception when raise_exception then
   if b.payment_status in('PAID','CONFIRMED') then
    review:=true;desired:='draft';
    update site.reservas set payment_status='PAYMENT_REVIEW',updated_at=now() where id=site_id;
    insert into site.integration_alerts(booking_id,code) values(site_id,'PAID_INVENTORY_CONFLICT') on conflict(booking_id,code) do update set status='open';
   else raise;end if;
  end;
 end if;
 grand:=round(b."totalPrice"::numeric*100)::bigint;
 select coalesce(sum(round(price::numeric*100)),0)::bigint into extra from site.booking_addons where booking_id=site_id;
 room:=greatest(0,grand-extra);
 insert into public.guests(id,organization_id,first_name,last_name,email,phone_e164,notes,language)
 values(gid,m.organization_id,b."guestName",'',nullif(b."guestEmail",''),case when b."guestPhone" ~ '^\+[1-9][0-9]{6,14}$' then b."guestPhone" else null end,'',case when b.invoice_language='es' then 'es' else 'en' end)
 on conflict(id) do update set
 first_name=case when trim(public.guests.first_name||' '||public.guests.last_name)=excluded.first_name then public.guests.first_name else excluded.first_name end,
 last_name=case when trim(public.guests.first_name||' '||public.guests.last_name)=excluded.first_name then public.guests.last_name else '' end,
 email=excluded.email,phone_e164=excluded.phone_e164,version=public.guests.version+1;
 insert into public.reservations(id,organization_id,property_id,guest_id,confirmation_code,arrival_date,departure_date,adults,children,status,source,currency,total_minor,notes,booked_at)
 values(rid,m.organization_id,m.property_id,gid,'WEB-'||site_id,b.start_date::date,b.end_date::date,coalesce(selection.adults,1),coalesce(selection.children,0),desired,case when b.origin='WEBSITE' then 'website' else 'imported' end,b.deposit_currency,room,coalesce(b.notes,'')||case when review then E'\nPago recibido: resolver conflicto de inventario antes de confirmar.' else '' end,b.created_at)
 on conflict(id) do update set adults=coalesce(selection.adults,public.reservations.adults),children=coalesce(selection.children,public.reservations.children),guest_id=excluded.guest_id,arrival_date=excluded.arrival_date,departure_date=excluded.departure_date,status=excluded.status,total_minor=excluded.total_minor,notes=excluded.notes,version=public.reservations.version+1;
 delete from public.reservation_units where reservation_id=rid;
 insert into public.reservation_units(organization_id,property_id,reservation_id,inventory_type_id,unit_id,rate_plan_id,arrival_date,departure_date,guests_count)
 values(m.organization_id,m.property_id,rid,m.inventory_type_id,m.unit_id,m.rate_plan_id,b.start_date::date,b.end_date::date,people);
 insert into public.folios(organization_id,property_id,reservation_id,currency) values(m.organization_id,m.property_id,rid,b.deposit_currency) on conflict(reservation_id) do nothing;
 select id into fid from public.folios where reservation_id=rid;
 delete from public.folio_items where folio_id=fid and description like '[web] %';
 insert into public.folio_items(organization_id,property_id,folio_id,type,description,unit_amount_minor,total_minor,service_date)
 values(m.organization_id,m.property_id,fid,'room','[web] Alojamiento',room,room,b.start_date::date);
 insert into public.folio_items(organization_id,property_id,folio_id,type,description,quantity,unit_amount_minor,total_minor,service_date)
 select m.organization_id,m.property_id,fid,'extra','[web] '||type,quantity,round(price::numeric*100/quantity)::bigint,round(price::numeric*100)::bigint,b.start_date::date from site.booking_addons where booking_id=site_id;
 if grand-room-extra<0 then insert into public.folio_items(organization_id,property_id,folio_id,type,description,unit_amount_minor,total_minor,service_date) values(m.organization_id,m.property_id,fid,'discount','[web] Descuento',grand-room-extra,grand-room-extra,b.start_date::date);end if;
 bid:=coalesce(link.buffer_id,gen_random_uuid());
 insert into public.inventory_blocks(id,organization_id,property_id,unit_id,start_date,end_date,reason,status)
 values(bid,m.organization_id,m.property_id,m.unit_id,b.end_date::date,b.end_date::date+greatest(1,turnover),'Preparación después de salida',case when turnover>0 and desired in('pending','confirmed','checked_in','checked_out') then 'active' else 'released' end)
 on conflict(id) do update set unit_id=excluded.unit_id,start_date=excluded.start_date,end_date=excluded.end_date,status=excluded.status;
 insert into pms_private.site_booking_map(site_booking_id,reservation_id,buffer_id,fingerprint) values(site_id,rid,bid,pms_private.site_booking_fingerprint(site_id)) on conflict(site_booking_id) do update set buffer_id=excluded.buffer_id,fingerprint=excluded.fingerprint;
 perform pms_private.recalculate(m.property_id,b.start_date::date,b.end_date::date+1);
 insert into public.audit_logs(organization_id,property_id,actor_type,action,entity_type,entity_id,request_id) values(m.organization_id,m.property_id,'system','site.reservation.sync','reservation',rid,'site:'||site_id);
 perform set_config('cala.bridge_origin',coalesce(prior,''),true);
end $$;

create or replace function pms_private.sync_pms_booking(rid uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.reservations;u public.reservation_units;g public.guests;m pms_private.site_property_map;link pms_private.site_booking_map;b site.reservas;
 sid integer;bid uuid;extra bigint;prior text:=current_setting('cala.bridge_origin',true);paystate text;chosen site.lodgings;turnover integer:=1;begin
 select * into r from public.reservations where id=rid;if not found then return;end if;
 select * into m from pms_private.site_property_map where property_id=r.property_id;if not found then return;end if;
 perform pg_advisory_xact_lock(hashtextextended(m.property_id::text,0));
 select * into u from public.reservation_units where reservation_id=rid limit 1;
 if u.id is null then raise exception 'SITE_ASSIGNMENT_REQUIRED';end if;
 if exists(select 1 from site.lodgings where site_property_id=m.site_property_id) then
  if u.unit_id is null or not pms_private.units_conflict(u.unit_id,m.unit_id) then raise exception 'SITE_INVENTORY_SCOPE';end if;
  select * into chosen from site.lodgings where unit_id=u.unit_id;
  turnover:=coalesce((select bl.turnover_nights from site.booking_lodging bl join pms_private.site_booking_map bm on bm.site_booking_id=bl.booking_id where bm.reservation_id=rid),chosen.turnover_nights,0);
 elsif u.unit_id is distinct from m.unit_id or u.inventory_type_id<>m.inventory_type_id then raise exception 'SITE_INVENTORY_SCOPE';end if;
 m.unit_id:=u.unit_id;m.inventory_type_id:=u.inventory_type_id;m.rate_plan_id:=u.rate_plan_id;
 select * into g from public.guests where id=r.guest_id;
 select * into link from pms_private.site_booking_map where reservation_id=rid;
 select * into b from site.reservas where id=link.site_booking_id;
 perform set_config('cala.bridge_origin','pms',true);
 if r.status in('pending','confirmed','checked_in','checked_out') then perform pms_private.assert_inventory(m.property_id,u.inventory_type_id,u.unit_id,r.arrival_date,r.departure_date,r.id,u.guests_count);end if;
 paystate:=case when r.status in('cancelled','no_show') then 'CANCELLED' when r.status='draft' then 'DRAFT' when r.status='pending' then 'PENDING' when b.payment_status in('PAID','CONFIRMED') then b.payment_status else 'CONFIRMED' end;
 select coalesce(sum(total_minor),0)::bigint into extra from public.folio_items i join public.folios f on f.id=i.folio_id where f.reservation_id=rid and i.type<>'room';
 if b.id is null then
  insert into site.reservas(property_id,start_date,end_date,"guestName","guestEmail","guestPhone",payment_status,origin,"totalPrice",deposit_paid,deposit_currency,notes,invoice_language,created_at,updated_at)
  values(m.site_property_id,r.arrival_date,r.departure_date,trim(g.first_name||' '||g.last_name),coalesce(g.email,''),g.phone_e164,paystate,'CALA',(r.total_minor+extra)::numeric/100,0,r.currency,r.notes,case when g.language='es' then 'es' else 'en' end,r.booked_at,now()) returning id into sid;
 else
  sid:=b.id;
  update site.reservas set start_date=r.arrival_date,end_date=r.departure_date,"guestName"=trim(g.first_name||' '||g.last_name),"guestEmail"=coalesce(g.email,''),"guestPhone"=coalesce(g.phone_e164,b."guestPhone"),payment_status=paystate,"totalPrice"=(r.total_minor+extra)::numeric/100,notes=r.notes,updated_at=now() where id=sid;
 end if;
 if chosen.id is not null then
  insert into site.booking_lodging(booking_id,lodging_id,adults,children) values(sid,chosen.id,r.adults,r.children)
  on conflict(booking_id) do update set lodging_id=excluded.lodging_id,adults=excluded.adults,children=excluded.children;
 end if;
 bid:=coalesce(link.buffer_id,gen_random_uuid());
 insert into public.inventory_blocks(id,organization_id,property_id,unit_id,start_date,end_date,reason,status)
 values(bid,m.organization_id,m.property_id,m.unit_id,r.departure_date,r.departure_date+greatest(1,turnover),'Preparación después de salida',case when turnover>0 and r.status in('pending','confirmed','checked_in','checked_out') then 'active' else 'released' end)
 on conflict(id) do update set unit_id=excluded.unit_id,start_date=excluded.start_date,end_date=excluded.end_date,status=excluded.status;
 insert into pms_private.site_booking_map(site_booking_id,reservation_id,buffer_id,fingerprint) values(sid,rid,bid,pms_private.site_booking_fingerprint(sid)) on conflict(site_booking_id) do update set buffer_id=excluded.buffer_id,fingerprint=excluded.fingerprint;
 perform pms_private.recalculate(m.property_id,r.arrival_date,r.departure_date+1);
 perform set_config('cala.bridge_origin',coalesce(prior,''),true);
end $$;

create or replace function pms_private.site_block_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare b site.blocked_dates;m pms_private.site_property_map;bid uuid;prior text:=current_setting('cala.bridge_origin',true);begin
 b:=case when tg_op='DELETE' then old else new end;
 select * into strict m from pms_private.site_property_map where site_property_id=b.property_id;
 perform pg_advisory_xact_lock(hashtextextended(m.property_id::text,0));
 perform set_config('cala.bridge_origin','site',true);
 select block_id into bid from pms_private.site_block_map where site_block_id=b.id;
 if exists(select 1 from site.legacy_block_scopes where block_id=b.id) then
  update public.inventory_blocks set status='released' where id=bid;
  perform set_config('cala.bridge_origin',coalesce(prior,''),true);return null;
 end if;
 if bid is not null then select unit_id into m.unit_id from public.inventory_blocks where id=bid;end if;
 if tg_op='DELETE' then update public.inventory_blocks set status='released' where id=bid;
 else
  bid:=coalesce(bid,gen_random_uuid());
  if exists(select 1 from public.reservations r join public.reservation_units ru on ru.reservation_id=r.id where r.property_id=m.property_id and r.status in('pending','confirmed','checked_in','checked_out') and r.arrival_date<b.end_date::date+1 and r.departure_date>b.start_date::date and pms_private.units_conflict(m.unit_id,ru.unit_id)) then raise exception 'BLOCK_CONFLICT';end if;
  insert into public.inventory_blocks(id,organization_id,property_id,unit_id,start_date,end_date,reason)
  values(bid,m.organization_id,m.property_id,m.unit_id,b.start_date::date,b.end_date::date+1,coalesce(b.reason,'Bloqueo web'))
  on conflict(id) do update set start_date=excluded.start_date,end_date=excluded.end_date,reason=excluded.reason,status='active';
  insert into pms_private.site_block_map values(b.id,bid) on conflict(site_block_id) do nothing;
 end if;
 perform pms_private.recalculate(m.property_id,b.start_date::date,b.end_date::date+1);
 perform set_config('cala.bridge_origin',coalesce(prior,''),true);return null;
end $$;
