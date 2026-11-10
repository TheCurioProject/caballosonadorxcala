-- Old server actions remain authenticated, but cannot erase financial history or leave ghost inventory.
create function pms_private.site_booking_deleting() returns trigger language plpgsql security definer set search_path='' as $$
declare link pms_private.site_booking_map;r public.reservations;prior text:=current_setting('cala.bridge_origin',true);begin
 select * into link from pms_private.site_booking_map where site_booking_id=old.id;
 if link.reservation_id is null then return old;end if;
 select * into strict r from public.reservations where id=link.reservation_id;
 perform pg_advisory_xact_lock(hashtextextended(r.property_id::text,0));
 if exists(select 1 from public.payments where reservation_id=r.id and status='succeeded') then raise exception 'PAID_RESERVATION_CANNOT_DELETE';end if;
 perform set_config('cala.bridge_origin','site',true);
 update public.reservations set status='cancelled',version=version+1,cancelled_at=now() where id=r.id;
 update public.inventory_blocks set status='released' where id=link.buffer_id;
 perform pms_private.recalculate(r.property_id,r.arrival_date,r.departure_date+1);
 insert into public.audit_logs(organization_id,property_id,actor_type,action,entity_type,entity_id,request_id) values(r.organization_id,r.property_id,'system','site.reservation.deleted','reservation',r.id,'site-delete:'||old.id);
 perform set_config('cala.bridge_origin',coalesce(prior,''),true);return old;
end $$;
create trigger site_booking_delete before delete on site.reservas for each row execute function pms_private.site_booking_deleting();
create function pms_private.protect_checkout_buffer() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if coalesce(current_setting('cala.bridge_origin',true),'') not in('site','pms','inventory_check') and exists(select 1 from pms_private.site_booking_map where buffer_id=old.id) then raise exception 'CHECKOUT_BUFFER_MANAGED';end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
create trigger site_protect_preparation before update or delete on public.inventory_blocks for each row execute function pms_private.protect_checkout_buffer();
revoke execute on function pms_private.site_booking_deleting(),pms_private.protect_checkout_buffer() from public,anon,authenticated;
