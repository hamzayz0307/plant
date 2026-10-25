-- Yaprak: sick-plant check as the main feature.
-- Run after 001_init.sql: Supabase → SQL Editor → new snippet → paste → Run.

-- Watering history and 7-day follow-up on each plant
alter table public.plants add column if not exists water_log jsonb not null default '[]'::jsonb;  -- last 12 watering times (ISO)
alter table public.plants add column if not exists recheck_at timestamptz;                         -- when to check health again

-- Plan: free (5 sick-plant checks a month) or plus (unlimited)
alter table public.profiles add column if not exists plan text not null default 'free' check (plan in ('free', 'plus'));

-- Users can't upgrade themselves: only the dashboard / service role can change plan
create or replace function public.keep_plan()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.plan := case when tg_op = 'UPDATE' then old.plan else 'free' end;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_keep_plan on public.profiles;
create trigger profiles_keep_plan before insert or update on public.profiles
  for each row execute function public.keep_plan();

-- Monthly sick-plant check counter (written only by the Edge Function)
create table if not exists public.health_usage (
  user_id  uuid not null references auth.users (id) on delete cascade,
  month    text not null,           -- 'YYYY-MM'
  count    int not null default 0,
  primary key (user_id, month)
);
alter table public.health_usage enable row level security;
drop policy if exists "read own health usage" on public.health_usage;
create policy "read own health usage" on public.health_usage for select using (auth.uid() = user_id);

create or replace function public.bump_health_usage(p_user uuid, p_limit int)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  m text := to_char(now(), 'YYYY-MM');
  c int;
begin
  insert into public.health_usage (user_id, month, count)
  values (p_user, m, 1)
  on conflict (user_id, month) do update
    set count = public.health_usage.count + 1
    where public.health_usage.count < p_limit
  returning count into c;

  if c is null then
    return json_build_object('allowed', false, 'count', p_limit);
  end if;
  return json_build_object('allowed', true, 'count', c);
end;
$$;

revoke execute on function public.bump_health_usage(uuid, int) from public, anon, authenticated;
grant execute on function public.bump_health_usage(uuid, int) to service_role;

-- Sitter "Watered" also goes into the watering history
create or replace function public.sitter_mark_watered(p_token text, p_plant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.sitter_links;
begin
  select * into l from public.sitter_links where token = p_token and expires_at > now();
  if not found then
    raise exception 'link_expired';
  end if;
  update public.plants
     set last_watered = now(),
         water_log = (
           select coalesce(jsonb_agg(x), '[]'::jsonb)
           from (
             select x from jsonb_array_elements(water_log || to_jsonb(now())) with ordinality as t(x, i)
             order by i desc limit 12
           ) s
         )
   where id = p_plant_id and user_id = l.user_id;
end;
$$;
