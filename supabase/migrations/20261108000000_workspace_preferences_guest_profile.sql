-- Personal workspace defaults and guest profile data observed in the supplied recording.
create table public.workspace_preferences (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 user_id uuid not null references auth.users(id),
 preferences jsonb not null,
 version bigint not null default 1 check(version>0),
 updated_at timestamptz not null default now(),
 unique(organization_id,user_id)
);
alter table public.workspace_preferences enable row level security;
revoke all on public.workspace_preferences from public,anon,authenticated;
grant select on public.workspace_preferences to authenticated;
create policy own_workspace_preferences on public.workspace_preferences for select to authenticated
 using(user_id=auth.uid() and pms_private.can_access(organization_id,'property.read',null));

alter table public.guests
 add column company text not null default '' check(length(company)<=160),
 add column address text not null default '' check(length(address)<=400),
 add column city text not null default '' check(length(city)<=160),
 add column region text not null default '' check(length(region)<=160),
 add column postal_code text not null default '' check(length(postal_code)<=32),
 add column language text not null default '' check(length(language)<=35 and (language='' or language ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'));

create function pms_private.valid_workspace_preferences(p jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare c jsonb:=p->'calendar';d jsonb:=p->'dashboard';k text;
begin
 if jsonb_typeof(p) is distinct from 'object' or jsonb_typeof(c) is distinct from 'object' or jsonb_typeof(d) is distinct from 'object' then return false;end if;
 if not(p ?& array['calendar','dashboard']) or (select count(*) from jsonb_object_keys(p))<>2 then return false;end if;
 if not(c ?& array['view','scope','days','stickyUnits','guest','channel','guests','price','nights','tooltip']) or (select count(*) from jsonb_object_keys(c))<>10 then return false;end if;
 if not(d ?& array['metrics','daily','activity','setup']) or (select count(*) from jsonb_object_keys(d))<>4 then return false;end if;
 if jsonb_typeof(c->'view') is distinct from 'string' or c->>'view' not in ('timeline','month','year') then return false;end if;
 if jsonb_typeof(c->'scope') is distinct from 'string' or c->>'scope' not in ('property','organization') then return false;end if;
 if jsonb_typeof(c->'days') is distinct from 'number' or c->>'days' not in ('7','14','30','90') then return false;end if;
 foreach k in array array['stickyUnits','guest','channel','guests','price','nights','tooltip'] loop
  if jsonb_typeof(c->k) is distinct from 'boolean' then return false;end if;
 end loop;
 foreach k in array array['metrics','daily','activity','setup'] loop
  if jsonb_typeof(d->k) is distinct from 'boolean' then return false;end if;
 end loop;
 return true;
end $$;
revoke all on function pms_private.valid_workspace_preferences(jsonb) from public,anon,authenticated;
alter table public.workspace_preferences add constraint workspace_preferences_shape check(pms_private.valid_workspace_preferences(preferences));

create function pms_private.video_command(command jsonb,idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare kind text:=command->>'type';org uuid:=(command->>'organizationId')::uuid;prop uuid:=(command->>'propertyId')::uuid;
 entity uuid:=coalesce((command->>'id')::uuid,gen_random_uuid());cached jsonb;response jsonb;pref public.workspace_preferences;guest public.guests;k text;limit_size integer;
begin
 if kind='workspace.preferences.save' then
  perform pms_private.require_access(org,'property.read',null);
 else
  perform pms_private.require_access(org,'reservation.write',prop);
  perform pms_private.require_access(org,'guest.pii.read',prop);
 end if;
 cached:=pms_private.idempotency_start(org,idempotency_key,command);if cached is not null then return cached;end if;
 if kind='workspace.preferences.save' then
  if not pms_private.valid_workspace_preferences(command->'preferences') then raise exception 'INVALID_PREFERENCES';end if;
  if jsonb_typeof(command->'version') is distinct from 'number' or command->>'version' !~ '^[0-9]+$' then raise exception 'INVALID_PREFERENCES';end if;
  perform pg_advisory_xact_lock(hashtextextended(org::text||':'||auth.uid()::text,0));
  select * into pref from public.workspace_preferences where organization_id=org and user_id=auth.uid() for update;
  if coalesce(pref.version,0) is distinct from (command->>'version')::bigint then raise exception 'VERSION_CONFLICT';end if;
  entity:=coalesce(pref.id,gen_random_uuid());
  insert into public.workspace_preferences(id,organization_id,user_id,preferences) values(entity,org,auth.uid(),command->'preferences')
   on conflict(organization_id,user_id) do update set preferences=excluded.preferences,version=public.workspace_preferences.version+1,updated_at=now();
  perform pms_private.audit(org,null,kind,entity,idempotency_key);
 else
  if command ? 'id' then
   select * into guest from public.guests where id=entity and organization_id=org for update;
   if not found then raise exception 'NOT_FOUND';end if;
   if guest.version is distinct from (command->>'version')::bigint then raise exception 'VERSION_CONFLICT';end if;
   if not exists(select 1 from public.organization_members m where m.organization_id=org and m.user_id=auth.uid() and m.all_properties)
    and not exists(select 1 from public.reservations r where r.guest_id=entity and r.property_id=prop and r.organization_id=org)
    then raise exception 'FORBIDDEN' using errcode='42501';end if;
  end if;
  foreach k in array array['firstName','lastName','email','phone','country','notes'] loop
   if jsonb_typeof(command->k) is distinct from 'string' then raise exception 'INVALID_GUEST';end if;
  end loop;
  if length(trim(command->>'firstName')) not between 1 and 160 or length(trim(command->>'lastName')) not between 1 and 160
   or length(command->>'email')>320 or length(command->>'notes')>2000 or command->>'country' !~ '^[A-Z]{2}$'
   or ((command->>'phone')<>'' and command->>'phone' !~ '^\+[1-9][0-9]{6,14}$')
   or ((command->>'email')<>'' and command->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'INVALID_GUEST';end if;
  foreach k in array array['company','address','city','region','postalCode','language'] loop
   limit_size:=case k when 'address' then 400 when 'postalCode' then 32 when 'language' then 35 else 160 end;
   if command ? k and (jsonb_typeof(command->k) is distinct from 'string' or length(trim(command->>k))>limit_size) then raise exception 'INVALID_GUEST_PROFILE';end if;
  end loop;
  if command ? 'language' and command->>'language'<>'' and command->>'language' !~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$' then raise exception 'INVALID_GUEST_PROFILE';end if;
  insert into public.guests(id,organization_id,first_name,last_name,email,phone_e164,country_code,notes,created_by,company,address,city,region,postal_code,language)
   values(entity,org,trim(command->>'firstName'),trim(command->>'lastName'),nullif(lower(command->>'email'),''),nullif(command->>'phone',''),command->>'country',trim(command->>'notes'),auth.uid(),coalesce(trim(command->>'company'),''),coalesce(trim(command->>'address'),''),coalesce(trim(command->>'city'),''),coalesce(trim(command->>'region'),''),coalesce(trim(command->>'postalCode'),''),coalesce(trim(command->>'language'),''))
   on conflict(id) do update set first_name=excluded.first_name,last_name=excluded.last_name,email=excluded.email,phone_e164=excluded.phone_e164,country_code=excluded.country_code,notes=excluded.notes,version=public.guests.version+1,
    company=case when command ? 'company' then excluded.company else public.guests.company end,
    address=case when command ? 'address' then excluded.address else public.guests.address end,
    city=case when command ? 'city' then excluded.city else public.guests.city end,
    region=case when command ? 'region' then excluded.region else public.guests.region end,
    postal_code=case when command ? 'postalCode' then excluded.postal_code else public.guests.postal_code end,
    language=case when command ? 'language' then excluded.language else public.guests.language end;
  perform pms_private.audit(org,prop,kind,entity,idempotency_key);
 end if;
 response:=jsonb_build_object('id',entity,'message','Cambios guardados');
 return pms_private.idempotency_finish(org,idempotency_key,response);
end $$;
revoke all on function pms_private.video_command(jsonb,text) from public,anon,authenticated;
alter function public.pms_command(jsonb,text) rename to pms_command_before_video;
revoke all on function public.pms_command_before_video(jsonb,text) from public,anon,authenticated;
create function public.pms_command(command jsonb,idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if command->>'type' in ('workspace.preferences.save','guest.save') then return pms_private.video_command(command,idempotency_key);end if;
 return public.pms_command_before_video(command,idempotency_key);
end $$;
revoke all on function public.pms_command(jsonb,text) from public,anon;
grant execute on function public.pms_command(jsonb,text) to authenticated;
