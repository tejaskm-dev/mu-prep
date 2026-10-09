-- =============================================================================
-- µPrep — Important topics
-- Curated, per-module exam topics for a subject: a priority, short notes, the
-- university questions they map to, and the notes (with a page) that cover them.
-- =============================================================================

create type public.topic_priority as enum ('critical', 'high', 'medium');

create table public.important_topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  module smallint not null check (module between 1 and 12),
  title text not null check (char_length(title) between 1 and 200),
  -- Short revision notes. Lines starting with "- " are bullets; ==text== highlights, **text** bolds.
  notes text check (char_length(notes) <= 8000),
  priority public.topic_priority not null default 'high',
  -- [{ "text": "Explain ==BFS== with an example", "marks": 7, "years": ["Dec 2023", "May 2022"] }, ...]
  questions jsonb not null default '[]'::jsonb check (jsonb_typeof(questions) = 'array'),
  sort_order int not null default 0,
  is_published boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index important_topics_subject_idx on public.important_topics (subject_id, module, sort_order);

create trigger important_topics_set_updated_at
  before update on public.important_topics
  for each row execute function public.tg_set_updated_at();

-- Notes / papers that cover a topic, optionally at a specific page.
create table public.important_topic_resources (
  topic_id uuid not null references public.important_topics (id) on delete cascade,
  resource_id uuid not null references public.resources (id) on delete cascade,
  page int check (page between 1 and 20000),
  sort_order int not null default 0,
  primary key (topic_id, resource_id)
);

create index important_topic_resources_resource_idx on public.important_topic_resources (resource_id);

-- Per-subject totals for the topics portal (callers' RLS applies).
create view public.topic_stats
with (security_invoker = true)
as
select
  t.subject_id,
  count(*)::int as topic_count,
  (count(*) filter (where t.priority = 'critical'))::int as critical_count,
  count(distinct t.module)::int as module_count,
  coalesce(sum(jsonb_array_length(t.questions)), 0)::int as question_count,
  max(t.updated_at) as updated_at
from public.important_topics t
where t.is_published
group by t.subject_id;

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------

alter table public.important_topics enable row level security;
alter table public.important_topic_resources enable row level security;

create policy "public reads published topics" on public.important_topics
  for select using (
    (is_published and exists (select 1 from public.subjects s where s.id = subject_id and s.is_active))
    or (select public.is_admin())
  );
create policy "admins insert topics" on public.important_topics
  for insert to authenticated with check ((select public.is_admin()));
create policy "admins update topics" on public.important_topics
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins delete topics" on public.important_topics
  for delete to authenticated using ((select public.is_admin()));

-- Links are visible whenever their topic is (the topics policy applies inside the subquery).
create policy "public reads topic links" on public.important_topic_resources
  for select using (exists (select 1 from public.important_topics t where t.id = topic_id));
create policy "admins insert topic links" on public.important_topic_resources
  for insert to authenticated with check ((select public.is_admin()));
create policy "admins update topic links" on public.important_topic_resources
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins delete topic links" on public.important_topic_resources
  for delete to authenticated using ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------

grant select on public.important_topics, public.important_topic_resources, public.topic_stats to anon, authenticated;
grant insert, update, delete on public.important_topics, public.important_topic_resources to authenticated;
grant all on public.important_topics, public.important_topic_resources to service_role;
