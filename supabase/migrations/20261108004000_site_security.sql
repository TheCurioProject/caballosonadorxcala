-- Private server role. Set LOGIN/password separately in the dashboard, never in source control.
do $$begin
 if not exists(select 1 from pg_roles where rolname='cala_site_app') then create role cala_site_app nologin;end if;
end $$;
revoke all on schema site from public,anon,authenticated;
revoke all on all tables in schema site from public,anon,authenticated;
revoke all on all sequences in schema site from public,anon,authenticated;
revoke all on all functions in schema site from public,anon,authenticated;
grant usage on schema site to cala_site_app;
grant select,insert,update,delete on all tables in schema site to cala_site_app;
grant usage,select on all sequences in schema site to cala_site_app;
alter default privileges in schema site revoke execute on functions from public;
alter default privileges in schema site revoke all on tables from anon,authenticated;
alter default privileges in schema site grant select,insert,update,delete on tables to cala_site_app;
alter default privileges in schema site grant usage,select on sequences to cala_site_app;
do $$declare tab record;begin
 for tab in select tablename from pg_tables where schemaname='site' loop
  execute format('alter table site.%I enable row level security',tab.tablename);
  execute format('create policy server_only on site.%I for all to cala_site_app using (true) with check (true)',tab.tablename);
 end loop;
end $$;
alter table site."AdminUser" add constraint admin_supabase_identity foreign key(supabase_user_id) references auth.users(id);
