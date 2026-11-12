-- A guest can book several rooms in one website checkout. Each room is its own
-- website booking (and its own CALA reservation, unit and folio); one Stripe
-- session pays all of them. The paid amount is split by each booking's own
-- total, so a promotion code discounts every room proportionally. External ids
-- are unique: the first booking stores the session id and every other room
-- stores "<session id>#<booking id>".
create function site.accept_stripe_group_payment(site_ids integer[],event_id text,session_id text,amount bigint,currency_code text) returns boolean
language plpgsql security definer set search_path='' as $$
declare b site.reservas;rid uuid;r public.reservations;m pms_private.site_property_map;prior text:=current_setting('cala.bridge_origin',true);
 n integer:=coalesce(array_length(site_ids,1),0);expected bigint;share bigint;remaining bigint:=amount;payment_id text;begin
 if n<1 or n>12 or amount is null or amount<0 or upper(currency_code)<>'MXN' or (select count(distinct x) from unnest(site_ids) x)<>n then raise exception 'PAYMENT_MISMATCH';end if;
 perform id from site.reservas where id=any(site_ids) order by id for update;
 if (select count(*) from site.reservas where id=any(site_ids) and "externalId"=case when id=site_ids[1] then session_id else session_id||'#'||id end)<>n
  or (select count(distinct property_id) from site.reservas where id=any(site_ids))<>1 then raise exception 'PAYMENT_MISMATCH';end if;
 select * into strict m from pms_private.site_property_map where site_property_id=(select property_id from site.reservas where id=site_ids[1]);
 perform pg_advisory_xact_lock(hashtextextended(m.property_id::text,0));
 perform set_config('cala.bridge_origin','site',true);
 select coalesce(sum(round("totalPrice"::numeric*100)),0)::bigint into expected from site.reservas where id=any(site_ids);
 for i in 1..n loop
  select * into strict b from site.reservas where id=site_ids[i];
  share:=case when i=n then remaining when expected>0 then least(remaining,round(amount::numeric*round(b."totalPrice"::numeric*100)/expected)::bigint) else 0 end;
  remaining:=remaining-share;
  update site.reservas set payment_status=case when payment_status='CONFIRMED' then 'CONFIRMED' else 'PAID' end,deposit_paid=share::numeric/100,deposit_currency=upper(currency_code),"totalPrice"=share::numeric/100,updated_at=now() where id=b.id;
  perform pms_private.sync_site_booking(b.id);
  select reservation_id into strict rid from pms_private.site_booking_map where site_booking_id=b.id;
  select * into strict r from public.reservations where id=rid;
  delete from public.payments where reservation_id=rid and provider='legacy_import';
  -- Payment ids are unique per provider: the first room keeps the session id.
  payment_id:=case when i=1 then session_id else session_id||'#'||b.id end;
  if share>0 then
   insert into public.payments(organization_id,property_id,reservation_id,provider,provider_payment_id,amount_minor,currency,status,method_type)
   values(r.organization_id,r.property_id,rid,'stripe',payment_id,share,upper(currency_code),'succeeded','card')
   on conflict(organization_id,provider,provider_payment_id) do nothing;
   if not exists(select 1 from public.payments where provider='stripe' and provider_payment_id=payment_id and reservation_id=rid and amount_minor=share and currency=upper(currency_code)) then raise exception 'PAYMENT_MISMATCH';end if;
  end if;
  insert into public.audit_logs(organization_id,property_id,actor_type,action,entity_type,entity_id,request_id) values(r.organization_id,r.property_id,'system','stripe.payment.received','reservation',rid,event_id);
 end loop;
 perform set_config('cala.bridge_origin',coalesce(prior,''),true);
 return not exists(select 1 from site.reservas where id=any(site_ids) and payment_status='PAYMENT_REVIEW');
end $$;
revoke all on function site.accept_stripe_group_payment(integer[],text,text,bigint,text) from public,anon,authenticated;
grant execute on function site.accept_stripe_group_payment(integer[],text,text,bigint,text) to cala_site_app;
