-- Application command boundary: authorization, validation, idempotency and audit in one transaction.
create function public.pms_command(command jsonb,idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare kind text:=command->>'type';org uuid:=(command->>'organizationId')::uuid;prop uuid:=(command->>'propertyId')::uuid;entity uuid:=coalesce((command->>'id')::uuid,gen_random_uuid());cached jsonb;permission text;type_id uuid;parent uuid;plan uuid;day date;existing bigint;new_role uuid;role_key text;owner_role uuid;folio uuid;reservation uuid;currency char(3);member uuid;total bigint;i integer;begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED' using errcode='42501';end if;
 if kind='organization.create' then
  -- Serialize this user's creation key even though the organization does not yet exist.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||idempotency_key,0));
  select k.response into cached from public.idempotency_keys k where k.actor_id=auth.uid() and k.key=idempotency_key and k.fingerprint=md5(command::text);if cached is not null then return cached;end if;
  if length(command->>'name') not between 1 and 160 then raise exception 'INVALID_NAME';end if;
  org:=entity;insert into public.organizations(id,name) values(org,command->>'name');select id into owner_role from public.roles where key='owner' and is_system;
  insert into public.organization_members(organization_id,user_id,role_id) values(org,auth.uid(),owner_role);
  perform pms_private.idempotency_start(org,idempotency_key,command);perform pms_private.audit(org,null,kind,entity,idempotency_key);
  return pms_private.idempotency_finish(org,idempotency_key,jsonb_build_object('id',entity,'message','Organización creada'));
 end if;
 if kind='reservation.save' then return public.pms_save_reservation(command,idempotency_key);end if;
 if kind='reservation.transition' then return public.pms_transition_reservation(command,idempotency_key);end if;
 if kind='block.create' then return public.pms_block_unit(command,idempotency_key);end if;
 permission:=case
 when kind in ('property.create','property.update','onboarding.save') then 'property.write'
 when kind='guest.save' then 'reservation.write'
 when kind in ('inventory.create','unit.create','block.release') then 'inventory.write'
 when kind in ('ratePlan.create','rates.bulk') then 'rates.write'
 when kind in ('task.save','unit.clean') then 'operations.write'
 when kind='folio.charge' then 'finance.write'
 when kind in ('team.update','team.invite') then 'team.manage'
 when kind in ('channel.create','channel.update','channel.sync') then 'channel.manage'
 when kind in ('migration.start','migration.review') then 'migration.manage'
 when kind='automation.save' then 'automation.write'
 when kind='report.generate' then 'report.read'
 else null end;
 if permission is null then raise exception 'COMMAND_NOT_AVAILABLE';end if;
 perform pms_private.require_access(org,permission,case when kind in ('property.create','onboarding.save','team.update','team.invite') then null else prop end);
 cached:=pms_private.idempotency_start(org,idempotency_key,command);if cached is not null then return cached;end if;
 if prop is not null then perform pg_advisory_xact_lock(hashtextextended(prop::text,0));end if;
 case kind
 when 'onboarding.save' then
  insert into public.onboarding_drafts(organization_id,user_id,step,data) values(org,auth.uid(),(command->>'step')::integer,command->'data') on conflict(organization_id,user_id) do update set step=excluded.step,data=excluded.data,updated_at=now() returning id into entity;
 when 'property.create' then
  if command->>'concept'='entire_home' and ((command->>'unitCount')::integer<>1 or command->>'sellMode'<>'unit') then raise exception 'INVALID_HOME';end if;
  if (command->>'unitCount')::integer not between 1 and 100 or (command->>'maxOccupancy')::integer not between 1 and 100 or not exists(select 1 from pg_timezone_names where name=command->>'timezone') or jsonb_typeof(coalesce(command->'amenities','[]'::jsonb))<>'array' or jsonb_array_length(coalesce(command->'amenities','[]'::jsonb))>30 or exists(select 1 from jsonb_array_elements_text(coalesce(command->'amenities','[]'::jsonb)) selected(key) where not exists(select 1 from public.amenities a where a.key=selected.key)) then raise exception 'INVALID_PROPERTY';end if;
  prop:=entity;insert into public.properties(id,organization_id,name,concept,timezone,currency,city,address,onboarding_state) values(prop,org,command->>'name',command->>'concept',command->>'timezone',command->>'currency',command->>'city',command->>'address','{"complete":true}');
  insert into public.property_settings(property_id,organization_id,check_in_from,check_out_until,tax_bps,policy) values(prop,org,(command->>'checkIn')::time,(command->>'checkOut')::time,(command->>'taxBps')::integer,coalesce(command->>'policy',''));
  insert into public.property_amenities(organization_id,property_id,amenity_id) select org,prop,a.id from public.amenities a where a.key in(select jsonb_array_elements_text(coalesce(command->'amenities','[]'::jsonb)));
  if exists(select 1 from public.organization_members where organization_id=org and user_id=auth.uid() and not all_properties) then insert into public.member_property_scopes values(org,auth.uid(),prop);end if;
  type_id:=gen_random_uuid();insert into public.inventory_types(id,organization_id,property_id,name,sell_mode,max_occupancy,base_rate_minor) values(type_id,org,prop,case when command->>'sellMode'='unit' then 'Unidad estándar' else 'Cama en dormitorio' end,case when command->>'sellMode'='unit' then 'unit' else 'bed' end,case when command->>'sellMode'='unit' then (command->>'maxOccupancy')::integer else 1 end,(command->>'baseRateMinor')::bigint);
  if command->>'sellMode'='both' then plan:=gen_random_uuid();parent:=gen_random_uuid();insert into public.inventory_types(id,organization_id,property_id,name,sell_mode,max_occupancy,base_rate_minor) values(plan,org,prop,'Dormitorio completo','unit',(command->>'unitCount')::integer,(command->>'baseRateMinor')::bigint*(command->>'unitCount')::integer);insert into public.units(id,organization_id,property_id,inventory_type_id,name) values(parent,org,prop,plan,'Dormitorio A');end if;
  for i in 1..(command->>'unitCount')::integer loop insert into public.units(organization_id,property_id,inventory_type_id,name,parent_unit_id) values(org,prop,type_id,case when command->>'sellMode'='unit' then 'Unidad ' else 'Cama ' end||i,parent);end loop;
  insert into public.unit_attributes(unit_id,key,value_json) select u.id,a.key,a.value from public.units u cross join jsonb_each(jsonb_build_object('bedrooms',coalesce((command->>'bedrooms')::integer,1),'beds',coalesce((command->>'beds')::integer,1),'bathrooms',coalesce((command->>'bathrooms')::integer,1))) a where u.property_id=prop;
  insert into public.rate_plans(organization_id,property_id,name) values(org,prop,'Tarifa flexible');delete from public.onboarding_drafts where organization_id=org and user_id=auth.uid();
 when 'property.update' then
  update public.properties set name=command->>'name',city=command->>'city',version=version+1 where id=prop and organization_id=org and version=(command->>'version')::bigint;if not found then raise exception 'VERSION_CONFLICT';end if;
  update public.property_settings set policy=command->>'policy',allowed_overbooking=(command->>'allowedOverbooking')::integer where property_id=prop;entity:=prop;
 when 'guest.save' then
  perform pms_private.require_access(org,'guest.pii.read',prop);
  if command ? 'id' then if not pms_private.can_guest(org,entity) then raise exception 'FORBIDDEN_GUEST';end if;update public.guests set first_name=command->>'firstName',last_name=command->>'lastName',email=nullif(lower(command->>'email'),''),phone_e164=nullif(command->>'phone',''),country_code=command->>'country',notes=coalesce(command->>'notes',''),version=version+1 where id=entity and organization_id=org and version=(command->>'version')::bigint;if not found then raise exception 'VERSION_CONFLICT';end if;
  else insert into public.guests(id,organization_id,first_name,last_name,email,phone_e164,country_code,notes,created_by) values(entity,org,command->>'firstName',command->>'lastName',nullif(lower(command->>'email'),''),nullif(command->>'phone',''),command->>'country',coalesce(command->>'notes',''),auth.uid());end if;
 when 'inventory.create' then
  if (command->>'unitCount')::integer not between 1 and 100 then raise exception 'INVALID_COUNT';end if;
  parent:=(command->>'parentUnitId')::uuid;if parent is not null and not exists(select 1 from public.units where id=parent and property_id=prop and parent_unit_id is null) then raise exception 'INVALID_PARENT';end if;
  insert into public.inventory_types(id,organization_id,property_id,name,sell_mode,max_occupancy,base_rate_minor) values(entity,org,prop,command->>'name',command->>'sellMode',(command->>'maxOccupancy')::integer,(command->>'baseRateMinor')::bigint);
  for i in 1..(command->>'unitCount')::integer loop insert into public.units(organization_id,property_id,inventory_type_id,name,parent_unit_id) values(org,prop,entity,(command->>'name')||' '||i,parent);end loop;
 when 'unit.create' then
  parent:=(command->>'parentUnitId')::uuid;if parent is not null and not exists(select 1 from public.units where id=parent and property_id=prop and parent_unit_id is null) then raise exception 'INVALID_PARENT';end if;
  insert into public.units(id,organization_id,property_id,inventory_type_id,name,parent_unit_id) values(entity,org,prop,(command->>'inventoryTypeId')::uuid,command->>'name',parent);
 when 'block.release' then
  update public.inventory_blocks set status='released' where id=entity and property_id=prop and organization_id=org returning start_date into day;if not found then raise exception 'NOT_FOUND';end if;
  perform pms_private.recalculate(prop,day,(select end_date from public.inventory_blocks where id=entity));
 when 'ratePlan.create' then insert into public.rate_plans(id,organization_id,property_id,name) values(entity,org,prop,command->>'name');
 when 'rates.bulk' then
  if (command->>'departure')::date<=(command->>'arrival')::date or (command->>'departure')::date-(command->>'arrival')::date>730 then raise exception 'INVALID_DATES';end if;
  type_id:=(command->>'inventoryTypeId')::uuid;plan:=(command->>'ratePlanId')::uuid;
  for day in select generate_series((command->>'arrival')::date,(command->>'departure')::date-1,interval '1 day')::date loop
   select version into existing from public.rate_day where inventory_type_id=type_id and rate_plan_id=plan and stay_date=day;
   if coalesce(existing,0)<>coalesce((command->'expectedVersions'->>day::text)::bigint,0) then raise exception 'VERSION_CONFLICT';end if;
   insert into public.rate_day(organization_id,property_id,rate_plan_id,inventory_type_id,stay_date,amount_minor,currency,min_stay,max_stay,closed,cta,ctd) values(org,prop,plan,type_id,day,(command->>'amountMinor')::bigint,(select p.currency from public.properties p where p.id=prop),(command->>'minStay')::integer,(command->>'maxStay')::integer,(command->>'closed')::boolean,(command->>'cta')::boolean,(command->>'ctd')::boolean)
   on conflict(rate_plan_id,inventory_type_id,stay_date,occupancy_key) do update set amount_minor=excluded.amount_minor,min_stay=excluded.min_stay,max_stay=excluded.max_stay,closed=excluded.closed,cta=excluded.cta,ctd=excluded.ctd,version=public.rate_day.version+1;
  end loop;entity:=plan;
 when 'unit.clean' then update public.units set housekeeping_status=command->>'status',version=version+1 where id=entity and property_id=prop and version=(command->>'version')::bigint;if not found then raise exception 'VERSION_CONFLICT';end if;
 when 'task.save' then
  member:=(command->>'assigneeId')::uuid;if member is not null and not exists(select 1 from public.organization_members m where m.organization_id=org and m.user_id=member and m.status='active' and (m.all_properties or exists(select 1 from public.member_property_scopes ps where ps.organization_id=org and ps.user_id=member and ps.property_id=prop))) then raise exception 'INVALID_ASSIGNEE';end if;
  if command ? 'id' then update public.tasks set unit_id=(command->>'unitId')::uuid,kind=command->>'kind',title=command->>'title',status=command->>'status',priority=command->>'priority',assignee_id=member,version=version+1 where id=entity and property_id=prop and version=(command->>'version')::bigint;if not found then raise exception 'VERSION_CONFLICT';end if;
  else insert into public.tasks(id,organization_id,property_id,unit_id,kind,title,status,priority,assignee_id) values(entity,org,prop,(command->>'unitId')::uuid,command->>'kind',command->>'title',command->>'status',command->>'priority',member);end if;
  if command->>'kind'='housekeeping' and command->>'status'='completed' then update public.units set housekeeping_status='clean',version=version+1 where id=(command->>'unitId')::uuid and property_id=prop;end if;
 when 'folio.charge' then
  reservation:=(command->>'reservationId')::uuid;select f.id into folio from public.folios f where f.reservation_id=reservation and f.property_id=prop and f.status='open';if folio is null then raise exception 'FOLIO_NOT_OPEN';end if;total:=(command->>'amountMinor')::bigint;if total<0 or total>100000000000 then raise exception 'INVALID_AMOUNT';end if;
  insert into public.folio_items(id,organization_id,property_id,folio_id,type,description,unit_amount_minor,total_minor,service_date) values(entity,org,prop,folio,'charge',command->>'description',total,total,current_date);
 when 'team.update' then
  perform pms_private.require_step_up();member:=(command->>'id')::uuid;if member=auth.uid() then raise exception 'SELF_ROLE';end if;
  select r.key into role_key from public.organization_members m join public.roles r on r.id=m.role_id where m.organization_id=org and m.user_id=member;
  if role_key is null then raise exception 'NOT_FOUND';end if;if role_key='owner' or command->>'role'='owner' then raise exception 'OWNER_TRANSFER_REQUIRED';end if;
  if (role_key='admin' or command->>'role'='admin') and not exists(select 1 from public.organization_members m join public.roles r on r.id=m.role_id where m.organization_id=org and m.user_id=auth.uid() and r.key='owner') then raise exception 'FORBIDDEN';end if;
  select id into new_role from public.roles where key=command->>'role' and is_system;
  update public.organization_members set role_id=new_role,status=command->>'status',all_properties=jsonb_array_length(command->'propertyIds')=0 where organization_id=org and user_id=member;
  delete from public.member_property_scopes where organization_id=org and user_id=member;
  insert into public.member_property_scopes select org,member,value::uuid from jsonb_array_elements_text(command->'propertyIds');
 when 'team.invite' then raise exception 'INVITATION_PROVIDER_NOT_CONFIGURED';
 when 'automation.save' then
  if command ? 'id' then update public.automation_rules set name=command->>'name',trigger=command->>'trigger',action=command->>'action',enabled=(command->>'enabled')::boolean where id=entity and property_id=prop;if not found then raise exception 'NOT_FOUND';end if;
  else insert into public.automation_rules(id,organization_id,property_id,name,trigger,action,enabled) values(entity,org,prop,command->>'name',command->>'trigger',command->>'action',(command->>'enabled')::boolean);end if;
 when 'report.generate' then
  if (command->>'departure')::date<=(command->>'arrival')::date then raise exception 'INVALID_DATES';end if;
  insert into public.jobs(id,organization_id,property_id,actor_id,type,payload) values(entity,org,prop,auth.uid(),'report',jsonb_build_object('arrival',command->>'arrival','departure',command->>'departure'));
 else raise exception 'PROVIDER_NOT_CONFIGURED';
 end case;
 perform pms_private.audit(org,prop,kind,entity,idempotency_key);
 if kind in ('inventory.create','unit.create','block.release','property.update','rates.bulk') then insert into public.outbox_events(organization_id,property_id,type,entity_id) values(org,prop,case when kind='rates.bulk' then 'rates.changed' else 'inventory.changed' end,entity);end if;
 return pms_private.idempotency_finish(org,idempotency_key,jsonb_build_object('id',entity,'message','Cambios guardados'));
end $$;
revoke all on function public.pms_command(jsonb,text) from public,anon;
grant execute on function public.pms_command(jsonb,text) to authenticated;
