-- 1. Retreats: the configured price is the retreat alone. The room is charged
--    on top at CALA's own rates (Tarifas y restricciones) for the retreat's
--    nights and the room the guest picks, so there are never fixed room prices.
-- 2. Coupons: new "final" type — the order costs exactly that amount
--    (e.g. a 12,500 MXN booking with a 50 MXN final-price coupon pays 50 MXN).
-- 3. Housekeeping can read reservations: they see the CALA calendar, read only
--    (no reservation.write / inventory.write, and no guest personal data).

-- 1. Retreat room price ---------------------------------------------------

-- Lodging price of a room for [s,e) at CALA's rates: the nightly amount of the
-- rates grid (or the inventory type's base rate) plus the property's tax, as
-- site.lodging_quote does. Availability and stay rules are not checked: the
-- retreat already holds the room for those dates.
create function pms_private.retreat_lodging_minor(lodging uuid,s date,e date) returns bigint
language plpgsql stable security definer set search_path='' as $$
declare l site.lodgings;m pms_private.site_property_map;base bigint;total bigint:=0;day date;amount bigint;tax integer;begin
 if s is null or e is null or e<=s then return null;end if;
 select * into l from site.lodgings where id=lodging;
 if l.id is null then return null;end if;
 select * into m from pms_private.site_property_map where site_property_id=l.site_property_id order by organization_id limit 1;
 select t.base_rate_minor into base from public.inventory_types t where t.id=l.inventory_type_id;
 for day in select generate_series(s,e-1,interval '1 day')::date loop
  amount:=null;
  select d.amount_minor into amount from public.rate_day d
   where d.rate_plan_id=l.rate_plan_id and d.inventory_type_id=l.inventory_type_id and d.stay_date=day and d.occupancy_key='base';
  total:=total+case when coalesce(amount,0)>0 then amount else coalesce(base,0) end;
 end loop;
 select tax_bps into tax from public.property_settings where property_id=m.property_id;
 return total+round(total::numeric*coalesce(tax,0)/10000)::bigint;
end $$;

-- Same as 20261126000000_site_retreats, plus each room's lodging price.
create or replace function site.retreat_offers(organization uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare m pms_private.site_property_map;today date;begin
 select * into m from pms_private.site_property_map where organization_id=organization order by site_property_id limit 1;
 if m.property_id is null then return '[]'::jsonb;end if;
 select (now() at time zone p.timezone)::date into today from public.properties p where p.id=m.property_id;
 return coalesce((select jsonb_agg(jsonb_build_object(
   'id',w.id,'startsOn',w.starts_on,'endsOn',w.ends_on,'stock',w.stock,'priceMinor',w.price_minor,'sold',s.sold,
   'onSale',w.is_active and w.starts_on is not null and w.ends_on is not null and w.starts_on>=today and coalesce(w.price_minor,0)>0 and coalesce(w.stock,0)>0,
   'rooms',coalesce((select jsonb_agg(jsonb_build_object('lodgingId',rr.lodging_id,'capacity',t.max_occupancy,
      'lodgingMinor',pms_private.retreat_lodging_minor(rr.lodging_id,w.starts_on,w.ends_on),
      'available',coalesce(b.status='active',false) and not pms_private.retreat_room_busy(m.property_id,l.unit_id,w.starts_on,w.ends_on,rr.block_id,null)))
     from site.retreat_rooms rr join site.lodgings l on l.id=rr.lodging_id join public.inventory_types t on t.id=l.inventory_type_id
     left join public.inventory_blocks b on b.id=rr.block_id where rr.retreat_id=w.id),'[]'::jsonb)
  ) order by w.id)
  from site.writers_workshops w
  cross join lateral(select count(*)::integer as sold from site.retreat_bookings rb join site.reservas b on b.id=rb.booking_id
   where rb.retreat_id=w.id and pms_private.retreat_live(b.payment_status)) s),'[]'::jsonb);
end $$;

-- Same as 20261126000000_site_retreats; the booking total is now the retreat
-- price plus the room's lodging price at CALA's rates.
create or replace function site.retreat_hold(retreat integer,lodging uuid,guests integer,guest jsonb,organization uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare w site.writers_workshops;m pms_private.site_property_map;rr site.retreat_rooms;l site.lodgings;today date;sold integer;sid integer;
 cap integer;turnover integer;stay bigint;prior text:=current_setting('cala.bridge_origin',true);guard text:=current_setting('cala.retreat',true);begin
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
 stay:=coalesce(pms_private.retreat_lodging_minor(l.id,w.starts_on,w.ends_on),0);
 -- Cleaning nights after the retreat only when they are still free: the sale never fails for them.
 turnover:=case when l.turnover_nights>0 and not pms_private.retreat_room_busy(m.property_id,l.unit_id,w.ends_on,w.ends_on+l.turnover_nights,null,null) then l.turnover_nights else 0 end;
 perform set_config('cala.bridge_origin','site',true);perform set_config('cala.retreat','on',true);
 update public.inventory_blocks set status='released' where id=rr.block_id;
 perform set_config('cala.bridge_origin',coalesce(prior,''),true);perform set_config('cala.retreat',coalesce(guard,''),true);
 insert into site.reservas(property_id,start_date,end_date,"guestName","guestEmail","guestPhone",payment_status,origin,"totalPrice",deposit_currency,notes,invoice_language,updated_at)
 values(m.site_property_id,w.starts_on,w.ends_on,left(trim(guest->>'name'),255),left(lower(trim(guest->>'email')),255),nullif(left(trim(coalesce(guest->>'phone','')),50),''),
  'PENDING','WEBSITE',(w.price_minor+stay)::numeric/100,'MXN',
  concat_ws(E'\n','Retiro: '||w.title_es||'. Precio del retiro: $'||to_char(w.price_minor::numeric/100,'FM999,999,990.00')||' MXN + hospedaje según tarifas de CALA: $'||to_char(stay::numeric/100,'FM999,999,990.00')||' MXN.',
   'Alojamiento: '||l.name_es||'. Huéspedes: '||guests||' adultos, 0 menores.'),
  case when guest->>'lang'='es' then 'es' else 'en' end,now()) returning id into sid;
 insert into site.booking_lodging(booking_id,lodging_id,adults,children,turnover_nights) values(sid,lodging,guests,0,turnover);
 insert into site.retreat_bookings(booking_id,retreat_id,lodging_id,guests) values(sid,w.id,lodging,guests);
 return sid;
end $$;

revoke all on function pms_private.retreat_lodging_minor(uuid,date,date) from public,anon,authenticated;
revoke all on function site.retreat_offers(uuid),site.retreat_hold(integer,uuid,integer,jsonb,uuid) from public,anon,authenticated;
grant execute on function site.retreat_offers(uuid),site.retreat_hold(integer,uuid,integer,jsonb,uuid) to cala_site_app;

-- 2. Final-price coupons --------------------------------------------------
-- discount_type 'final': `value` is the amount (MXN) the guest pays in the end.
alter table site.coupons drop constraint if exists coupons_discount_type_check;
alter table site.coupons add constraint coupons_discount_type_check check(discount_type in ('percent','fixed','final'));

-- 3. Housekeeping sees the calendar (read only) ---------------------------
insert into public.role_permissions(role_id,permission_key)
select r.id,'reservation.read' from public.roles r
where r.key='housekeeping' and r.organization_id is null
on conflict do nothing;
