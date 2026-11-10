-- Run once as database owner AFTER importing the site data and creating an Auth user.
-- Repeated calls reuse mappings and do not overwrite CALA rates or duplicate payments.
create function site.bootstrap_cala(owner_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid;owner_email text;p site.properties;m pms_private.site_property_map;prop uuid;typ uuid;unit uuid;plan uuid;booking_row record;begin
 perform pg_advisory_xact_lock(hashtextextended('casa-caballo-sonador-bootstrap',0));
 select email into strict owner_email from auth.users where id=owner_id;
 insert into public.organizations(name,slug,default_currency,default_timezone)
 values('Casa Caballo Soñador','casa-caballo-sonador','MXN','America/Mazatlan') on conflict(slug) do nothing;
 select id into strict org from public.organizations where slug='casa-caballo-sonador';
 insert into public.organization_members(organization_id,user_id,role_id)
 values(org,owner_id,(select id from public.roles where key='owner' and organization_id is null)) on conflict(organization_id,user_id) do update set status='active';
 insert into site."AdminUser"(email,"passwordHash",role,supabase_user_id,"updatedAt")
 values(owner_email,'SUPABASE_AUTH_ONLY','SUPERADMIN',owner_id,now()) on conflict(email) do update set supabase_user_id=excluded.supabase_user_id;
 if not exists(select 1 from site.properties) then
  insert into site.properties(name,admin_emails,updated_at) values('Casa Caballo Soñador',owner_email,now());
 end if;
 update site.properties set admin_emails=owner_email where trim(admin_emails)='';
 for p in select * from site.properties order by id loop
  select * into m from pms_private.site_property_map where site_property_id=p.id;
  if m.property_id is null then
   if p.base_capacity not between 1 and 100 or p.base_price<0 then raise exception 'INVALID_SITE_PROPERTY';end if;
   prop:=gen_random_uuid();typ:=gen_random_uuid();unit:=gen_random_uuid();plan:=gen_random_uuid();
   insert into public.properties(id,organization_id,name,concept,timezone,currency,country_code,city,status,onboarding_state)
   values(prop,org,p.name,'entire_home','America/Mazatlan','MXN','MX','Chacala',case when p.is_active then 'active' else 'inactive' end,'{"complete":true}');
   insert into public.property_settings(organization_id,property_id,check_out_until) values(org,prop,'12:00');
   insert into public.inventory_types(id,organization_id,property_id,name,sell_mode,max_occupancy,base_rate_minor,active)
   values(typ,org,prop,'Villa completa','unit',p.base_capacity,round(p.base_price::numeric*100),p.is_active);
   insert into public.units(id,organization_id,property_id,inventory_type_id,name,active) values(unit,org,prop,typ,p.name,p.is_active);
   insert into public.rate_plans(id,organization_id,property_id,name) values(plan,org,prop,'Venta directa');
   insert into pms_private.site_property_map values(p.id,org,prop,typ,unit,plan);
   -- Recurring legacy rates are materialized for five years; CALA then edits exact dates.
   insert into public.rate_day(organization_id,property_id,rate_plan_id,inventory_type_id,stay_date,amount_minor,currency,min_stay)
   select org,prop,plan,typ,day::date,round(pr.price_override::numeric*100),'MXN',2
   from generate_series((now() at time zone 'America/Mazatlan')::date,(now() at time zone 'America/Mazatlan')::date+interval '5 years',interval '1 day') day
   join lateral(select price_override from site.pricing_rules where property_id=p.id and to_char(date,'MM-DD')=to_char(day,'MM-DD') order by date desc limit 1) pr on true;
  end if;
 end loop;
 update site.reservas set payment_status='EXPIRED',updated_at=now() where payment_status='PENDING' and created_at<now()-interval '35 minutes';
 for booking_row in select id from site.reservas order by start_date,id loop perform pms_private.sync_site_booking(booking_row.id);end loop;
 -- Importing past settlements does not assert Stripe verification.
 insert into public.payments(organization_id,property_id,reservation_id,provider,provider_payment_id,amount_minor,currency,status,method_type)
 select r.organization_id,r.property_id,r.id,'legacy_import','site-'||b.id,round(b.deposit_paid::numeric*100),b.deposit_currency,'succeeded','imported_unverified'
 from site.reservas b join pms_private.site_booking_map map on map.site_booking_id=b.id join public.reservations r on r.id=map.reservation_id
 where b.payment_status in('PAID','CONFIRMED') and b.deposit_paid>0 and not exists(select 1 from public.payments where reservation_id=r.id)
 on conflict(organization_id,provider,provider_payment_id) do nothing;
 -- Fire the inclusive/exclusive conversion, including existing imported calendar blocks.
 update site.blocked_dates set updated_at=updated_at;
 return jsonb_build_object('organizationId',org,'defaultPropertyId',(select property_id from pms_private.site_property_map order by site_property_id limit 1),
 'properties',(select count(*) from pms_private.site_property_map),'reservations',(select count(*) from pms_private.site_booking_map),'openAlerts',(select count(*) from site.integration_alerts where status='open'));
end $$;
revoke all on function site.bootstrap_cala(uuid) from public,anon,authenticated,cala_site_app;

create function pms_private.site_property_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare m pms_private.site_property_map;begin
 select * into m from pms_private.site_property_map where site_property_id=new.id;if not found then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended(m.property_id::text,0));
 update public.properties set name=new.name,status=case when new.is_active then 'active' else 'inactive' end,version=version+1 where id=m.property_id;
 update public.inventory_types set max_occupancy=new.base_capacity,base_rate_minor=round(new.base_price::numeric*100),active=new.is_active where id=m.inventory_type_id;
 update public.units set name=new.name,active=new.is_active,version=version+1 where id=m.unit_id;
 return null;
end $$;
create trigger site_property_sync after update on site.properties for each row execute function pms_private.site_property_changed();
-- Guest edits in CALA are reflected in receipts and the preserved site modules.
create function pms_private.pms_guest_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare rid uuid;begin for rid in select id from public.reservations where guest_id=new.id loop perform pms_private.sync_pms_booking(rid);end loop;return null;end $$;
create constraint trigger pms_site_guest_sync after update on public.guests deferrable initially deferred for each row
 when(current_setting('cala.bridge_origin',true) is distinct from 'site' and current_setting('cala.bridge_origin',true) is distinct from 'pms') execute function pms_private.pms_guest_changed();
revoke all on all functions in schema pms_private from public,anon,authenticated;

grant execute on function pms_private.can_access(uuid,text,uuid),pms_private.can_guest(uuid,uuid) to authenticated;
