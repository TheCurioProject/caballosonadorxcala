create function site.lock_property(site_id integer) returns boolean language plpgsql security definer set search_path='' as $$
declare prop uuid;begin
 select m.property_id into strict prop from pms_private.site_property_map m join public.properties p on p.id=m.property_id where m.site_property_id=site_id and p.status='active';
 perform pg_advisory_xact_lock(hashtextextended(prop::text,0));return true;
end $$;
revoke all on function site.lock_property(integer) from public,anon,authenticated;
grant execute on function site.lock_property(integer) to cala_site_app;
create function pms_private.lock_site_rate_property() returns trigger language plpgsql security definer set search_path='' as $$
begin perform pg_advisory_xact_lock(hashtextextended(case when tg_op='DELETE' then old.property_id else new.property_id end::text,0));return case when tg_op='DELETE' then old else new end;end $$;
create trigger site_rate_lock before insert or update or delete on public.rate_day for each row execute function pms_private.lock_site_rate_property();
create trigger site_type_lock before insert or update or delete on public.inventory_types for each row execute function pms_private.lock_site_rate_property();
create function pms_private.pms_type_to_site() returns trigger language plpgsql security definer set search_path='' as $$
declare m pms_private.site_property_map;prior text:=current_setting('cala.bridge_origin',true);begin
 select * into m from pms_private.site_property_map where inventory_type_id=new.id;if not found then return null;end if;
 perform set_config('cala.bridge_origin','pms',true);
 update site.properties set base_price=new.base_rate_minor::numeric/100,base_capacity=new.max_occupancy,is_active=new.active,updated_at=now() where id=m.site_property_id;
 perform set_config('cala.bridge_origin',coalesce(prior,''),true);return null;
end $$;
create trigger site_type_settings after update on public.inventory_types for each row
 when(current_setting('cala.bridge_origin',true) is distinct from 'site' and current_setting('cala.bridge_origin',true) is distinct from 'pms') execute function pms_private.pms_type_to_site();
-- Stop recursion from settings written by CALA itself.
drop trigger site_property_sync on site.properties;
create trigger site_property_sync after update on site.properties for each row
 when(current_setting('cala.bridge_origin',true) is distinct from 'pms' and current_setting('cala.bridge_origin',true) is distinct from 'site') execute function pms_private.site_property_changed();
revoke execute on function pms_private.lock_site_rate_property(),pms_private.pms_type_to_site() from public,anon,authenticated;
