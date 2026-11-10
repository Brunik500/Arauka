-- ARAUKA v0.5. Ejecutar UNA VEZ después del esquema v0.4 ya instalado.
-- No se borran trabajos, cuentas ni postulaciones.
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  kind text not null check (kind in ('interest','selected','contact_ready')),
  event_key text not null unique,
  title text not null,
  body text not null,
  read_at timestamptz,
  email_status text not null default 'pending' check (email_status in ('pending','sending','sent','error','disabled')),
  email_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_owner_idx on public.notifications(recipient_id,created_at desc);
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
grant usage on schema public to authenticated;
grant select on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;
grant select,insert on public.notification_preferences to authenticated;
grant update(email_enabled,updated_at) on public.notification_preferences to authenticated;
drop policy if exists "notification owner read" on public.notifications;
create policy "notification owner read" on public.notifications for select to authenticated using(recipient_id=auth.uid());
drop policy if exists "notification owner mark read" on public.notifications;
create policy "notification owner mark read" on public.notifications for update to authenticated using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());
drop policy if exists "preference owner read" on public.notification_preferences;
create policy "preference owner read" on public.notification_preferences for select to authenticated using(user_id=auth.uid());
drop policy if exists "preference owner insert" on public.notification_preferences;
create policy "preference owner insert" on public.notification_preferences for insert to authenticated with check(user_id=auth.uid());
drop policy if exists "preference owner update" on public.notification_preferences;
create policy "preference owner update" on public.notification_preferences for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

-- Se ejecutan bajo los permisos del creador (SQL editor / postgres), no del navegador.
create or replace function public.arauka_alert_on_interest() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_job public.jobs%rowtype;
begin
  select * into v_job from public.jobs where id=new.job_id;
  if v_job.id is not null and v_job.client_id<>new.pro_id then
    insert into public.notifications(recipient_id,job_id,kind,event_key,title,body)
    values(v_job.client_id,v_job.id,'interest','interest:'||new.id::text,
      'Un profesional está interesado', 'Recibiste una respuesta para «'||left(v_job.title,120)||'». Revisa el perfil en ARAUKA.')
    on conflict(event_key) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists arauka_interest_alert on public.interests;
create trigger arauka_interest_alert after insert on public.interests
for each row execute function public.arauka_alert_on_interest();

create or replace function public.arauka_alert_on_job() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_agreed boolean;
begin
  if new.selected_pro_id is not null and old.selected_pro_id is distinct from new.selected_pro_id then
    insert into public.notifications(recipient_id,job_id,kind,event_key,title,body)
    values(new.selected_pro_id,new.id,'selected','selected:'||new.id::text,
      'Un cliente te seleccionó','Te seleccionaron para «'||left(new.title,120)||'». Entra a ARAUKA para continuar.')
    on conflict(event_key) do nothing;
  end if;
  if new.selected_pro_id is not null and not old.client_contact_consent and new.client_contact_consent then
    select i.pro_contact_consent into v_agreed from public.interests i
    where i.job_id=new.id and i.pro_id=new.selected_pro_id;
    if coalesce(v_agreed,false) then
      insert into public.notifications(recipient_id,job_id,kind,event_key,title,body)
      values(new.client_id,new.id,'contact_ready','contact:client:'||new.id::text,'Contacto habilitado','Ambas partes autorizaron el contacto. Abre el trabajo en ARAUKA.'),
            (new.selected_pro_id,new.id,'contact_ready','contact:pro:'||new.id::text,'Contacto habilitado','Ambas partes autorizaron el contacto. Abre el trabajo en ARAUKA.')
      on conflict(event_key) do nothing;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists arauka_job_alert on public.jobs;
create trigger arauka_job_alert after update on public.jobs
for each row execute function public.arauka_alert_on_job();

create or replace function public.arauka_alert_on_interest_consent() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_job public.jobs%rowtype;
begin
  if not old.pro_contact_consent and new.pro_contact_consent then
    select * into v_job from public.jobs where id=new.job_id;
    if v_job.selected_pro_id=new.pro_id and v_job.client_contact_consent then
      insert into public.notifications(recipient_id,job_id,kind,event_key,title,body)
      values(v_job.client_id,v_job.id,'contact_ready','contact:client:'||v_job.id::text,'Contacto habilitado','Ambas partes autorizaron el contacto. Abre el trabajo en ARAUKA.'),
            (new.pro_id,v_job.id,'contact_ready','contact:pro:'||v_job.id::text,'Contacto habilitado','Ambas partes autorizaron el contacto. Abre el trabajo en ARAUKA.')
      on conflict(event_key) do nothing;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists arauka_consent_alert on public.interests;
create trigger arauka_consent_alert after update of pro_contact_consent on public.interests
for each row execute function public.arauka_alert_on_interest_consent();

-- Los mails se envían mediante Edge Function + servicio externo y un webhook
-- configurados SEPARADAMENTE. Hasta hacerlo, la bandeja interna funciona igual.
