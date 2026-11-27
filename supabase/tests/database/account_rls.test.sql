begin;

create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data
)
values
  (
    '00000000-0000-0000-0000-000000000101',
    'authenticated',
    'authenticated',
    'member-a@example.test',
    '',
    pg_catalog.now(),
    '{"first_name":"Member","last_name":"A"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    'authenticated',
    'authenticated',
    'member-b@example.test',
    '',
    pg_catalog.now(),
    '{"first_name":"Member","last_name":"B"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000103',
    'authenticated',
    'authenticated',
    'admin@example.test',
    '',
    pg_catalog.now(),
    '{"first_name":"Test","last_name":"Admin"}'::jsonb
  );

insert into public.user_roles (user_id, role)
values
  ('00000000-0000-0000-0000-000000000102', 'contributor'),
  ('00000000-0000-0000-0000-000000000103', 'admin');

insert into public.saved_items (user_id, item_type, item_id)
values
  ('00000000-0000-0000-0000-000000000101', 'prompt', 'seo-audit-evidence'),
  ('00000000-0000-0000-0000-000000000102', 'prompt', 'seo-audit-evidence');

insert into public.projects (id, user_id, title)
values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 'Project A'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000102', 'Project B');

insert into public.project_items (project_id, user_id, item_type, item_id)
values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 'resource', 'seo-audit-agent'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000102', 'resource', 'seo-audit-agent');

insert into public.submissions (author_id, submission_type, title, license, security_notes)
values
  ('00000000-0000-0000-0000-000000000101', 'prompt', 'Submission A', 'CC-BY-4.0', 'No credentials or external actions.'),
  ('00000000-0000-0000-0000-000000000102', 'prompt', 'Submission B', 'CC-BY-4.0', 'No credentials or external actions.');

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*)::integer from public.saved_items), 1, 'members see only their own saved items');
select lives_ok(
  $$insert into public.saved_items (item_type, item_id) values ('article', 'technical-seo-audit-evidence')$$,
  'members can save a catalogue item without supplying an owner id'
);
select is((select count(*)::integer from public.saved_items), 2, 'new saved items are owned by the authenticated member');
select is((select count(*)::integer from public.profiles), 1, 'members see only their own profile');
select is((select count(*)::integer from public.projects), 1, 'members see only their own projects');
select is((select count(*)::integer from public.project_items), 1, 'members see only items in their own projects');
select is((select count(*)::integer from public.user_roles), 1, 'members see only their own role');
select throws_ok(
  $$insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-000000000101', 'admin')$$,
  '42501',
  null,
  'members cannot assign themselves roles'
);
select throws_ok(
  $$insert into public.saved_items (user_id, item_type, item_id) values ('00000000-0000-0000-0000-000000000102', 'article', 'forged-owner')$$,
  '42501',
  null,
  'members cannot supply another owner id'
);
select lives_ok(
  $$update public.profiles set first_name = 'Updated' where id = auth.uid()$$,
  'members can update their own profile'
);
select is((select first_name from public.profiles where id = auth.uid()), 'Updated', 'profile changes remain scoped to the current user');
select is((select count(*)::integer from public.submissions), 1, 'members see only their own submissions');
select throws_ok(
  $$insert into public.submissions (submission_type, title, license, security_notes) values ('prompt', 'Member submission', 'CC-BY-4.0', 'No credentials or external actions.')$$,
  '42501',
  null,
  'members without the contributor role cannot submit content'
);
select lives_ok(
  $$update public.submissions set status = 'approved' where author_id = auth.uid()$$,
  'non-admin status updates do not cause a database error'
);
select is(
  (select status::text from public.submissions where author_id = auth.uid()),
  'pending',
  'non-admin users cannot approve submissions'
);

reset role;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);

select ok(public.can_submit_content(), 'contributors are authorized to submit content');
select lives_ok(
  $$insert into public.submissions (submission_type, title, license, security_notes) values ('prompt', 'Contributor submission', 'CC-BY-4.0', 'No credentials or external actions.')$$,
  'contributors can create pending submissions'
);
select is((select count(*)::integer from public.submissions), 2, 'contributors can see their existing and new submissions');

reset role;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);

select ok(public.is_admin(), 'the database recognizes the preassigned administrator role');
select is((select count(*)::integer from public.submissions), 3, 'administrators can review all submissions');
select lives_ok(
  $$update public.submissions set status = 'approved', reviewer_id = auth.uid(), reviewed_at = pg_catalog.now() where title = 'Submission B'$$,
  'administrators can review submissions'
);
select is(
  (select status::text from public.submissions where title = 'Submission B'),
  'approved',
  'administrator review status is persisted'
);

select * from finish();
rollback;
