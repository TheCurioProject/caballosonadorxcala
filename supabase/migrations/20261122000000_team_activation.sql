-- Team list: say whether each member already activated their account (chose
-- a password from the activation email). Invited people stay "pending" until
-- then, and Equipo can resend the activation email.
create or replace function public.pms_team(org uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 return (select coalesce(jsonb_agg(jsonb_build_object(
   'userId', m.user_id,
   'name', coalesce(nullif(trim(u.raw_user_meta_data->>'name'), ''), split_part(u.email, '@', 1)),
   'email', u.email,
   'role', r.key,
   'status', m.status,
   'propertyIds', case when m.all_properties then '[]'::jsonb else coalesce((
     select jsonb_agg(s.property_id) from public.member_property_scopes s
     where s.organization_id = m.organization_id and s.user_id = m.user_id), '[]'::jsonb) end,
   'lastSignInAt', u.last_sign_in_at,
   'activated', u.email_confirmed_at is not null
 ) order by pms_private.role_rank(r.key) desc, u.email), '[]'::jsonb)
 from public.organization_members m
 join public.roles r on r.id = m.role_id
 join auth.users u on u.id = m.user_id
 where m.organization_id = org
   and (m.user_id = auth.uid() or pms_private.can_access(org, 'team.manage')));
end $$;
revoke all on function public.pms_team(uuid) from public, anon;
grant execute on function public.pms_team(uuid) to authenticated;
