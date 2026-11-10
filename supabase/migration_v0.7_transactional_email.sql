-- ARAUKA v0.7 · Ejecutar manualmente después de migration_v0.5_notifications.sql.
-- No elimina ni modifica notificaciones, preferencias, usuarios o trabajos existentes.

create extension if not exists pgcrypto;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

alter table public.notifications
  add column if not exists email_attempts integer not null default 0,
  add column if not exists email_attempt_token uuid,
  add column if not exists email_first_attempt_at timestamptz,
  add column if not exists email_last_attempt_at timestamptz,
  add column if not exists email_provider_requested_at timestamptz,
  add column if not exists email_payload_hash text,
  add column if not exists email_error text,
  add column if not exists email_provider_id text,
  add column if not exists email_updated_at timestamptz not null default now();

-- v0.5 ya admite disabled. Se conservan sus cinco estados y se agregan dos estados
-- terminales para errores permanentes y entregas cuyo resultado no puede conocerse.
alter table public.notifications
  drop constraint if exists notifications_email_status_check;
alter table public.notifications
  add constraint notifications_email_status_check check (
    email_status in ('pending','sending','sent','error','disabled','failed','delivery_unknown')
  );

alter table public.notifications
  drop constraint if exists notifications_email_attempts_check;
alter table public.notifications
  add constraint notifications_email_attempts_check check (email_attempts >= 0);

create index if not exists notifications_email_retry_idx
  on public.notifications(email_status,email_last_attempt_at,created_at)
  where email_status in ('pending','error','sending');

-- Solo service_role puede reclamar entregas. No acepta correo, asunto ni contenido.
create or replace function public.claim_notification_email(p_notification_id uuid)
returns table (
  id uuid,
  recipient_id uuid,
  job_id uuid,
  kind text,
  event_key text,
  title text,
  body text,
  email_attempts integer,
  attempt_token uuid,
  provider_requested_at timestamptz,
  payload_hash text
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_notice public.notifications%rowtype;
  v_email_enabled boolean := false;
  v_attempt_token uuid;
begin
  select * into v_notice
  from public.notifications n
  where n.id = p_notification_id
  for update;

  if not found then return; end if;

  select np.email_enabled into v_email_enabled
  from public.notification_preferences np
  where np.user_id = v_notice.recipient_id;

  if coalesce(v_email_enabled, false) is not true then
    if v_notice.email_status in ('pending','error','sending') then
      update public.notifications n
      set email_status = 'disabled', email_attempt_token = null,
          email_error = null, email_updated_at = now()
      where n.id = p_notification_id;
    end if;
    return;
  end if;

  if v_notice.email_provider_requested_at is not null
     and v_notice.email_provider_requested_at < now() - interval '23 hours'
     and v_notice.email_status in ('error','sending') then
    update public.notifications n
    set email_status = 'delivery_unknown', email_attempt_token = null,
        email_error = 'Ventana segura de idempotencia de Resend vencida',
        email_updated_at = now()
    where n.id = p_notification_id;
    return;
  end if;

  if v_notice.email_attempts >= 5
     or not (
       v_notice.email_status in ('pending','error')
       or (v_notice.email_status = 'sending'
           and v_notice.email_last_attempt_at < now() - interval '10 minutes')
     ) then
    return;
  end if;

  v_attempt_token := gen_random_uuid();
  return query
  update public.notifications n
  set email_status = 'sending',
      email_attempts = n.email_attempts + 1,
      email_attempt_token = v_attempt_token,
      email_first_attempt_at = coalesce(n.email_first_attempt_at, now()),
      email_last_attempt_at = now(),
      email_error = null,
      email_updated_at = now()
  where n.id = p_notification_id
  returning n.id, n.recipient_id, n.job_id, n.kind, n.event_key,
            n.title, n.body, n.email_attempts, n.email_attempt_token,
            n.email_provider_requested_at, n.email_payload_hash;
end;
$$;

revoke all on function public.claim_notification_email(uuid) from public, anon, authenticated;
grant execute on function public.claim_notification_email(uuid) to service_role;

-- Cron llama esta función; URL y secreto se leen desde Supabase Vault.
-- Los secretos requeridos se crean manualmente antes de programar el job.
create or replace function public.dispatch_notification_email_batch(p_limit integer default 25)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, net, vault, pg_temp
as $$
declare
  v_url text;
  v_secret text;
  v_notice record;
  v_dispatched integer := 0;
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'p_limit debe estar entre 1 y 100';
  end if;

  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'arauka_edge_function_url'
  order by created_at desc limit 1;
  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'arauka_webhook_secret'
  order by created_at desc limit 1;
  if nullif(v_url,'') is null or nullif(v_secret,'') is null then
    raise exception 'Faltan secretos de Vault para el despachador ARAUKA';
  end if;

  update public.notifications n
  set email_status = 'failed', email_attempt_token = null,
      email_error = 'Máximo de intentos de correo alcanzado',
      email_updated_at = now()
  where n.email_attempts >= 5
    and (
      n.email_status in ('pending','error')
      or (n.email_status = 'sending'
          and n.email_last_attempt_at < now() - interval '10 minutes')
    );

  for v_notice in
    select n.id
    from public.notifications n
    where n.email_attempts < 5
      and (
        n.email_status in ('pending','error')
        or (n.email_status = 'sending'
            and n.email_last_attempt_at < now() - interval '10 minutes')
      )
    order by n.created_at
    limit p_limit
  loop
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'content-type','application/json',
        'x-arauka-webhook-secret',v_secret
      ),
      body := jsonb_build_object(
        'type','RETRY', 'schema','public', 'table','notifications',
        'record',jsonb_build_object('id',v_notice.id)
      ),
      timeout_milliseconds := 10000
    );
    v_dispatched := v_dispatched + 1;
  end loop;
  return v_dispatched;
end;
$$;

revoke all on function public.dispatch_notification_email_batch(integer) from public, anon, authenticated;
grant execute on function public.dispatch_notification_email_batch(integer) to service_role;

comment on function public.claim_notification_email(uuid) is
  'Reclama atómicamente una notificación y emite un token único por intento.';
comment on function public.dispatch_notification_email_batch(integer) is
  'Despacha mediante pg_net notificaciones pendientes, fallidas o estancadas para su procesamiento seguro.';
