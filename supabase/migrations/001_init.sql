-- Yaprak database. Run once in Supabase → SQL Editor → New query → paste → Run.

-- Profiles: language, weather city, pet-safe mode, reminders
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  lang        text check (lang in ('en', 'tr')),
  city        jsonb,                       -- { name, country, lat, lon }
  pet_safe    boolean not null default false,
  reminders   boolean not null default false,
  updated_at  timestamptz not null default now()
);

-- Rooms (Function 5)
create table if not exists public.rooms (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  placement   text not null default 'indoor' check (placement in ('indoor', 'balcony')),
  "window"    text not null default 'S' check ("window" in ('N', 'E', 'S', 'W', 'none')),
  light       text not null default 'medium' check (light in ('low', 'medium', 'bright')),
  humidity    text not null default 'normal' check (humidity in ('dry', 'normal', 'humid')),
  radiator    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Plants (My Garden)
create table if not exists public.plants (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  room_id         uuid references public.rooms (id) on delete set null,
  nickname        text not null default '',
  common_name     text not null,
  scientific_name text not null default '',
  family          text not null default '',
  confidence      int check (confidence between 0 and 100),
  description     text not null default '',
  care            jsonb not null default '{}'::jsonb,  -- { water, light, soil, temperature, humidity }
  needs           jsonb not null default '{}'::jsonb,  -- { light, minTemp, humidity, placement } used for room fit
  difficulty      text check (difficulty in ('easy', 'medium', 'hard')),
  watering_days   int not null default 7,
  toxicity        jsonb not null default '{}'::jsonb,  -- { pets, kids, note }
  photo           text,                                -- small JPEG thumbnail (data URL, ~40 KB)
  notes           text not null default '',
  last_watered    timestamptz,
  lang            text not null default 'en',
  created_at      timestamptz not null default now()
);
create index if not exists plants_user_idx on public.plants (user_id, created_at desc);

-- Health checks (disease scans attached to a plant)
create table if not exists public.health_checks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plant_id    uuid not null references public.plants (id) on delete cascade,
  photo       text,
  result      jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists health_plant_idx on public.health_checks (plant_id, created_at desc);

-- Plant-sitter links
create table if not exists public.sitter_links (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  token       text not null unique,
  note        text not null default '',
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

-- Daily AI limit (written only by the Edge Function)
create table if not exists public.ai_usage (
  user_id  uuid not null references auth.users (id) on delete cascade,
  day      date not null default current_date,
  count    int not null default 0,
  primary key (user_id, day)
);

-- Feedback
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid default auth.uid() references auth.users (id) on delete set null,
  message     text not null check (char_length(message) between 1 and 2000),
  created_at  timestamptz not null default now()
);

-- Row level security: everyone sees only their own rows
alter table public.profiles      enable row level security;
alter table public.rooms         enable row level security;
alter table public.plants        enable row level security;
alter table public.health_checks enable row level security;
alter table public.sitter_links  enable row level security;
alter table public.ai_usage      enable row level security;
alter table public.feedback      enable row level security;

create policy "own profile"        on public.profiles      for all using (auth.uid() = id)      with check (auth.uid() = id);
create policy "own rooms"          on public.rooms         for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own plants"         on public.plants        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own health checks"  on public.health_checks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own sitter links"   on public.sitter_links  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "read own ai usage"  on public.ai_usage      for select using (auth.uid() = user_id);
create policy "send feedback"      on public.feedback      for insert with check (auth.uid() = user_id);

-- Sitter page: read the schedule with a valid link, no sign-in
create or replace function public.get_sitter_view(p_token text)
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  l public.sitter_links;
begin
  select * into l from public.sitter_links where token = p_token and expires_at > now();
  if not found then
    return null;
  end if;
  return json_build_object(
    'note', l.note,
    'plants', coalesce((
      select json_agg(json_build_object(
        'id', p.id,
        'name', coalesce(nullif(p.nickname, ''), p.common_name),
        'scientific_name', p.scientific_name,
        'watering_days', p.watering_days,
        'last_watered', p.last_watered,
        'care_water', p.care ->> 'water',
        'photo', p.photo,
        'room_name', r.name,
        'room', case when r.id is null then null else json_build_object(
          'placement', r.placement, 'window', r."window", 'light', r.light, 'humidity', r.humidity, 'radiator', r.radiator) end
      ) order by p.created_at)
      from public.plants p
      left join public.rooms r on r.id = p.room_id
      where p.user_id = l.user_id
    ), '[]'::json)
  );
end;
$$;

-- Sitter page: tick "Watered"
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
  update public.plants set last_watered = now() where id = p_plant_id and user_id = l.user_id;
end;
$$;

grant execute on function public.get_sitter_view(text) to anon, authenticated;
grant execute on function public.sitter_mark_watered(text, uuid) to anon, authenticated;

-- Daily AI limit: count one scan, refuse when the limit is reached
create or replace function public.bump_ai_usage(p_user uuid, p_limit int)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  c int;
begin
  insert into public.ai_usage (user_id, day, count)
  values (p_user, current_date, 1)
  on conflict (user_id, day) do update
    set count = public.ai_usage.count + 1
    where public.ai_usage.count < p_limit
  returning count into c;

  if c is null then
    return json_build_object('allowed', false, 'count', p_limit);
  end if;
  return json_build_object('allowed', true, 'count', c);
end;
$$;

revoke execute on function public.bump_ai_usage(uuid, int) from public, anon, authenticated;
grant execute on function public.bump_ai_usage(uuid, int) to service_role;
