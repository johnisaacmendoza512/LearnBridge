-- Allow parents to delete a child even if the child has bookings/sessions.
-- Every column that references students(id) is changed to ON DELETE SET NULL:
-- the bookings, payments and session history are KEPT, they just no longer
-- point to the deleted child (the app shows "—" for the child's name).
--
-- Run once in Supabase → SQL Editor.

do $$
declare
  fk record;
begin
  for fk in
    select con.conname                      as constraint_name,
           rel.relname                      as table_name,
           att.attname                      as column_name
    from pg_constraint con
    join pg_class      rel on rel.oid = con.conrelid
    join pg_namespace  ns  on ns.oid  = rel.relnamespace
    join pg_attribute  att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
    where con.contype = 'f'
      and con.confrelid = 'public.students'::regclass
      and ns.nspname = 'public'
  loop
    -- SET NULL needs the column to accept NULL
    execute format('alter table public.%I alter column %I drop not null', fk.table_name, fk.column_name);
    execute format('alter table public.%I drop constraint %I', fk.table_name, fk.constraint_name);
    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references public.students(id) on delete set null',
      fk.table_name, fk.constraint_name, fk.column_name
    );
    raise notice 'Updated %.% → on delete set null', fk.table_name, fk.column_name;
  end loop;
end $$;

-- Parents may delete only their own children (skip if this policy already exists)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'students' and cmd = 'DELETE'
  ) then
    create policy "Parents can delete own children"
      on public.students for delete
      using (parent_id = auth.uid());
  end if;
end $$;
