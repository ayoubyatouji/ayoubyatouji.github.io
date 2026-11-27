begin;

create type public.app_role as enum ('member', 'contributor', 'admin');
create type public.saved_item_type as enum (
  'article',
  'resource',
  'ai_tool',
  'marketing_tool',
  'prompt',
  'workflow',
  'script',
  'skill',
  'template',
  'learning_path'
);
create type public.project_status as enum ('draft', 'active', 'paused', 'completed', 'archived');
create type public.submission_type as enum ('agent', 'skill', 'workflow', 'prompt', 'script', 'article', 'tool', 'template');
create type public.submission_status as enum ('pending', 'in_review', 'approved', 'rejected');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text check (first_name is null or char_length(first_name) <= 80),
  last_name text check (last_name is null or char_length(last_name) <= 80),
  avatar_path text check (avatar_path is null or avatar_path like id::text || '/%'),
  preferred_locale text not null default 'fr' check (preferred_locale in ('fr', 'en', 'ar')),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (user_id, role)
);

create table public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_type public.saved_item_type not null,
  item_id text not null check (item_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'),
  created_at timestamptz not null default pg_catalog.now(),
  unique (user_id, item_type, item_id)
);

create index saved_items_user_created_idx
  on public.saved_items (user_id, created_at desc);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 5000),
  status public.project_status not null default 'draft',
  locale text not null default 'fr' check (locale in ('fr', 'en', 'ar')),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (id, user_id)
);

create index projects_user_updated_idx
  on public.projects (user_id, updated_at desc);

create table public.project_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_type public.saved_item_type not null,
  item_id text not null check (item_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'),
  position smallint not null default 0 check (position between 0 and 999),
  created_at timestamptz not null default pg_catalog.now(),
  foreign key (project_id, user_id)
    references public.projects(id, user_id)
    on delete cascade,
  unique (project_id, item_type, item_id)
);

create index project_items_project_position_idx
  on public.project_items (project_id, position);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  submission_type public.submission_type not null,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 262144),
  license text not null check (char_length(btrim(license)) between 1 and 120),
  attribution text not null default '' check (char_length(attribution) <= 2000),
  compatibility text not null default '' check (char_length(compatibility) <= 2000),
  security_notes text not null check (char_length(btrim(security_notes)) between 1 and 5000),
  status public.submission_status not null default 'pending',
  reviewer_id uuid references auth.users(id) on delete set null,
  review_notes text check (review_notes is null or char_length(review_notes) <= 5000),
  submitted_at timestamptz not null default pg_catalog.now(),
  reviewed_at timestamptz
);

create index submissions_author_submitted_idx
  on public.submissions (author_id, submitted_at desc);
create index submissions_status_submitted_idx
  on public.submissions (status, submitted_at desc);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'admin'::public.app_role
  );
$$;

create or replace function public.can_submit_content()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role in ('contributor'::public.app_role, 'admin'::public.app_role)
  );
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    nullif(pg_catalog.left(pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'first_name', '')), 80), ''),
    nullif(pg_catalog.left(pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'last_name', '')), 80), '')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'member'::public.app_role)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.can_submit_content() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_submit_content() to authenticated;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.saved_items enable row level security;
alter table public.projects enable row level security;
alter table public.project_items enable row level security;
alter table public.submissions enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (first_name, last_name, avatar_path, preferred_locale)
  on public.profiles to authenticated;

revoke all on public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;

revoke all on public.saved_items from anon, authenticated;
grant select, delete on public.saved_items to authenticated;
grant insert (item_type, item_id) on public.saved_items to authenticated;

revoke all on public.projects from anon, authenticated;
grant select, delete on public.projects to authenticated;
grant insert (title, description, status, locale) on public.projects to authenticated;
grant update (title, description, status, locale) on public.projects to authenticated;

revoke all on public.project_items from anon, authenticated;
grant select, delete on public.project_items to authenticated;
grant insert (project_id, item_type, item_id, position) on public.project_items to authenticated;

revoke all on public.submissions from anon, authenticated;
grant select on public.submissions to authenticated;
grant insert (
  submission_type,
  title,
  metadata,
  license,
  attribution,
  compatibility,
  security_notes
) on public.submissions to authenticated;
grant update (status, reviewer_id, review_notes, reviewed_at)
  on public.submissions to authenticated;

create policy profiles_select_own
  on public.profiles for select to authenticated
  using (id = auth.uid());
create policy profiles_update_own
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy user_roles_select_own_or_admin
  on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy saved_items_select_own
  on public.saved_items for select to authenticated
  using (user_id = auth.uid());
create policy saved_items_insert_own
  on public.saved_items for insert to authenticated
  with check (user_id = auth.uid());
create policy saved_items_delete_own
  on public.saved_items for delete to authenticated
  using (user_id = auth.uid());

create policy projects_select_own
  on public.projects for select to authenticated
  using (user_id = auth.uid());
create policy projects_insert_own
  on public.projects for insert to authenticated
  with check (user_id = auth.uid());
create policy projects_update_own
  on public.projects for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy projects_delete_own
  on public.projects for delete to authenticated
  using (user_id = auth.uid());

create policy project_items_select_own
  on public.project_items for select to authenticated
  using (user_id = auth.uid());
create policy project_items_insert_own
  on public.project_items for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.projects
      where id = project_id
        and user_id = auth.uid()
    )
  );
create policy project_items_delete_own
  on public.project_items for delete to authenticated
  using (user_id = auth.uid());

create policy submissions_select_own_or_admin
  on public.submissions for select to authenticated
  using (author_id = auth.uid() or public.is_admin());
create policy submissions_insert_own
  on public.submissions for insert to authenticated
  with check (author_id = auth.uid() and status = 'pending' and public.can_submit_content());
create policy submissions_update_admin
  on public.submissions for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

commit;
