-- ARAUKA v0.4 · Ejecutar en Supabase > SQL Editor
-- Proyecto nuevo: perfiles, solicitudes, postulaciones, consentimiento y evaluaciones.
-- Datos de ejemplo NO se insertan en la base de datos real.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Usuario ARAUKA' check (char_length(display_name) between 1 and 100),
  company_name text check (company_name is null or char_length(company_name)<=120),
  bio text not null default '' check (char_length(bio)<=1500),
  is_professional boolean not null default false,
  categories text[] not null default '{}',
  service_localities text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.private_contacts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text not null check (char_length(phone) between 8 and 22),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 6 and 140),
  description text not null check (char_length(btrim(description)) between 20 and 4000),
  category text not null check (char_length(category)<=70),
  locality text not null check (char_length(locality)<=70),
  status text not null default 'open' check (status in ('open','matched','completed','cancelled')),
  selected_pro_id uuid references public.profiles(id),
  client_contact_consent boolean not null default false,
  created_at timestamptz not null default now(),
  check (selected_pro_id is null or selected_pro_id <> client_id),
  check (status not in ('matched','completed') or selected_pro_id is not null),
  check (client_contact_consent = false or selected_pro_id is not null)
);
create index if not exists jobs_discovery_idx on public.jobs (status, locality, category, created_at desc);
create index if not exists jobs_client_idx on public.jobs (client_id, created_at desc);

create table if not exists public.interests (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  pro_id uuid not null references public.profiles(id) on delete cascade,
  note text not null check (char_length(btrim(note)) between 10 and 800),
  pro_contact_consent boolean not null default false,
  created_at timestamptz not null default now(),
  unique (job_id,pro_id)
);
create index if not exists interests_pro_idx on public.interests (pro_id,created_at desc);

create table if not exists public.portfolio (
  id uuid primary key default gen_random_uuid(),
  pro_id uuid not null references public.profiles(id) on delete cascade,
  image_path text not null,
  caption text not null default 'Trabajo realizado',
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  pro_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (char_length(btrim(comment)) between 10 and 1500),
  created_at timestamptz not null default now()
);

-- Solo desde panel administrativo/SQL del proyecto se podrán otorgar verificaciones.
create table if not exists public.verifications (
  pro_id uuid primary key references public.profiles(id) on delete cascade,
  identity_verified boolean not null default false,
  credentials_verified boolean not null default false
);

-- Crear perfil automático después de crear una cuenta.
create or replace function public.create_profile_for_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'),''),'Usuario ARAUKA'),100))
  on conflict(id) do nothing;
  return new;
end;
$$;
drop trigger if exists trigger_create_arauka_profile on auth.users;
create trigger trigger_create_arauka_profile after insert on auth.users
for each row execute function public.create_profile_for_user();

-- Impedir seleccionar a alguien que no manifestó interés, y evitar cambiar el ciclo arbitrariamente.
create or replace function public.validate_job_update()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.client_id <> old.client_id then
    raise exception 'No es posible cambiar el propietario del trabajo';
  end if;
  if new.selected_pro_id is distinct from old.selected_pro_id then
    if old.status <> 'open' or new.selected_pro_id is null then
      raise exception 'La selección solo se puede hacer una vez desde un trabajo abierto';
    end if;
    if not exists (select 1 from public.interests i where i.job_id = old.id and i.pro_id = new.selected_pro_id) then
      raise exception 'El profesional debe haber manifestado interés';
    end if;
    if new.status <> 'matched' then raise exception 'El trabajo debe quedar en estado matched'; end if;
    new.client_contact_consent := false;
  end if;
  if new.status is distinct from old.status then
    if not (
      (old.status = 'open' and new.status in ('matched','cancelled')) or
      (old.status = 'matched' and new.status in ('completed','cancelled'))
    ) then raise exception 'Transición de estado no permitida'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trigger_job_update on public.jobs;
create trigger trigger_job_update before update on public.jobs
for each row execute function public.validate_job_update();

create or replace function public.validate_interest_update()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.job_id <> old.job_id or new.pro_id <> old.pro_id then
    raise exception 'No se puede cambiar el trabajo o profesional de una respuesta';
  end if;
  return new;
end;
$$;
drop trigger if exists trigger_interest_update on public.interests;
create trigger trigger_interest_update before update on public.interests
for each row execute function public.validate_interest_update();

alter table public.profiles enable row level security;
alter table public.private_contacts enable row level security;
alter table public.jobs enable row level security;
alter table public.interests enable row level security;
alter table public.portfolio enable row level security;
alter table public.reviews enable row level security;
alter table public.verifications enable row level security;

-- Perfiles públicos, sin teléfonos ni direcciones exactas.
create policy "profiles public select" on public.profiles for select to anon,authenticated using (true);
create policy "profiles owner insert" on public.profiles for insert to authenticated with check (id=auth.uid());
create policy "profiles owner update" on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());

-- Cada persona ve su propio teléfono; el intercambio se hace exclusivamente mediante RPC autorizada.
create policy "contacts owner select" on public.private_contacts for select to authenticated using (user_id=auth.uid());
create policy "contacts owner insert" on public.private_contacts for insert to authenticated with check (user_id=auth.uid());
create policy "contacts owner update" on public.private_contacts for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

create policy "jobs public select" on public.jobs for select to anon,authenticated using (true);
create policy "jobs client insert" on public.jobs for insert to authenticated
  with check (client_id=auth.uid() and status='open' and selected_pro_id is null and client_contact_consent=false);
create policy "jobs client update" on public.jobs for update to authenticated
  using (client_id=auth.uid()) with check (client_id=auth.uid());

-- Solo el maestro autor y el cliente del trabajo pueden leer la postulación.
create policy "interests participant select" on public.interests for select to authenticated
  using (pro_id=auth.uid() or exists(select 1 from public.jobs j where j.id=job_id and j.client_id=auth.uid()));
create policy "interests professional insert" on public.interests for insert to authenticated
  with check (
    pro_id=auth.uid() and pro_contact_consent=false and
    exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_professional) and
    exists(select 1 from public.jobs j where j.id=job_id and j.status='open' and j.client_id<>auth.uid())
  );
create policy "interests professional update" on public.interests for update to authenticated
  using (pro_id=auth.uid()) with check (pro_id=auth.uid());

create policy "portfolio public select" on public.portfolio for select to anon,authenticated using (true);
create policy "portfolio professional insert" on public.portfolio for insert to authenticated
  with check (pro_id=auth.uid() and image_path like auth.uid()::text || '/%'
    and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_professional));
create policy "portfolio professional delete" on public.portfolio for delete to authenticated using (pro_id=auth.uid());

create policy "reviews public select" on public.reviews for select to anon,authenticated using (true);
create policy "reviews client after completed work" on public.reviews for insert to authenticated
  with check (client_id=auth.uid() and exists(
    select 1 from public.jobs j
    where j.id=job_id and j.client_id=auth.uid() and j.selected_pro_id=pro_id and j.status='completed'
  ));

create policy "verifications public select" on public.verifications for select to anon,authenticated using (true);
-- Sin políticas INSERT/UPDATE para anon/authenticated: no pueden autoverificarse.

-- RLS sobre archivos: fotos públicas por diseño; subir solo a carpeta propia.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('portfolio','portfolio',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
create policy "portfolio images public" on storage.objects for select to anon,authenticated using (bucket_id='portfolio');
create policy "portfolio images owner upload" on storage.objects for insert to authenticated
  with check(bucket_id='portfolio' and (storage.foldername(name))[1]=auth.uid()::text
    and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_professional));
create policy "portfolio images owner remove" on storage.objects for delete to authenticated
  using(bucket_id='portfolio' and (storage.foldername(name))[1]=auth.uid()::text);

-- Solo cliente seleccionado y maestro seleccionado pueden pedir el teléfono del otro,
-- y únicamente si ambos marcaron consentimiento para ese trabajo.
create or replace function public.get_shared_contact(p_job_id uuid)
returns table(display_name text, phone text)
language sql security definer set search_path = public, pg_temp
as $$
  select
    case when auth.uid()=j.client_id
      then coalesce(nullif(pp.company_name,''), pp.display_name)
      else cp.display_name end as display_name,
    case when auth.uid()=j.client_id then ppc.phone else cpc.phone end as phone
  from public.jobs j
  join public.interests i on i.job_id=j.id and i.pro_id=j.selected_pro_id
  join public.profiles pp on pp.id=j.selected_pro_id
  join public.profiles cp on cp.id=j.client_id
  left join public.private_contacts ppc on ppc.user_id=j.selected_pro_id
  left join public.private_contacts cpc on cpc.user_id=j.client_id
  where j.id=p_job_id
    and j.status in ('matched','completed')
    and j.client_contact_consent=true
    and i.pro_contact_consent=true
    and auth.uid() in (j.client_id,j.selected_pro_id)
    and auth.uid() is not null;
$$;
revoke all on function public.get_shared_contact(uuid) from public,anon;
grant execute on function public.get_shared_contact(uuid) to authenticated;
