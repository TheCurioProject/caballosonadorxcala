-- Removing someone from the team now deletes their Auth account too (they
-- must be invited again and choose a new password). History is kept:
--  * authored records keep the author's id (foreign key dropped, value kept),
--  * per-user scratch data is deleted with the account,
--  * assignments and "invited by" are cleared.
do $$
declare
  spec record;
  con record;
begin
  for spec in
    select * from (values
      -- per-user data: goes with the account
      ('public', 'organization_members', 'user_id', 'cascade'),
      ('public', 'onboarding_drafts', 'user_id', 'cascade'),
      ('public', 'workspace_preferences', 'user_id', 'cascade'),
      ('public', 'idempotency_keys', 'actor_id', 'cascade'),
      ('site', 'AdminUser', 'supabase_user_id', 'cascade'),
      -- references that simply stop pointing at anyone
      ('public', 'organization_members', 'invited_by', 'set null'),
      ('public', 'ota_threads', 'assignee_id', 'set null'),
      -- history: keep the id of whoever did it
      ('public', 'reservation_notes', 'author_user_id', 'keep'),
      ('public', 'message_entries', 'author_id', 'keep'),
      ('public', 'ota_messages', 'author_id', 'keep'),
      ('public', 'jobs', 'actor_id', 'keep'),
      ('public', 'ical_feeds', 'created_by', 'keep'),
      ('public', 'calendar_links', 'created_by', 'keep'),
      ('public', 'mail_inboxes', 'created_by', 'keep'),
      ('public', 'guests', 'created_by', 'keep')
    ) as t(schema_name, table_name, column_name, on_delete)
  loop
    if to_regclass(format('%I.%I', spec.schema_name, spec.table_name)) is null then
      continue;
    end if;
    for con in
      select c.conname
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
      where c.contype = 'f'
        and c.confrelid = 'auth.users'::regclass
        and c.conrelid = format('%I.%I', spec.schema_name, spec.table_name)::regclass
        and array_length(c.conkey, 1) = 1
        and a.attname = spec.column_name
    loop
      execute format('alter table %I.%I drop constraint %I',
        spec.schema_name, spec.table_name, con.conname);
    end loop;
    if spec.on_delete <> 'keep' then
      execute format(
        'alter table %I.%I add constraint %I foreign key (%I) references auth.users(id) on delete %s',
        spec.schema_name, spec.table_name,
        left(spec.table_name || '_' || spec.column_name || '_auth_fkey', 63),
        spec.column_name, spec.on_delete);
    end if;
  end loop;
end $$;
