-- Run through `supabase test db` (pgTAP). Detailed transactional fixtures also run
-- against PostgreSQL/WASM in tests/integration/postgres.test.ts, without Docker.
begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(5);
select is((select count(*)::integer from pg_tables where schemaname='public' and not rowsecurity),0,'Every application table has RLS');
select is((select count(*)::integer from information_schema.role_table_grants where table_schema='public' and grantee='anon'),0,'No anonymous table grants');
select ok(not has_table_privilege('authenticated','public.reservations','INSERT'),'No direct reservation inserts');
select ok(not has_function_privilege('authenticated','public.pms_claim_job(uuid)','EXECUTE'),'User cannot claim worker jobs');
select ok(has_function_privilege('authenticated','public.pms_save_reservation(jsonb,text)','EXECUTE'),'Authenticated reservation command available');
select * from finish();
rollback;
