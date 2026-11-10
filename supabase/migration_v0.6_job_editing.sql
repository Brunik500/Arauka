-- ARAUKA v0.6 · Ejecutar manualmente después del esquema v0.4.
-- Protege la edición de solicitudes sin borrar ni modificar datos existentes.

create or replace function public.validate_job_update()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.client_id <> old.client_id then
    raise exception 'No es posible cambiar el propietario del trabajo';
  end if;

  if new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.category is distinct from old.category
     or new.locality is distinct from old.locality then
    if old.status <> 'open'
       or old.selected_pro_id is not null
       or new.status <> 'open'
       or new.selected_pro_id is not null then
      raise exception 'Solo se puede editar una solicitud abierta y sin profesional seleccionado';
    end if;
  end if;

  if new.selected_pro_id is distinct from old.selected_pro_id then
    if old.status <> 'open' or new.selected_pro_id is null then
      raise exception 'La selección solo se puede hacer una vez desde un trabajo abierto';
    end if;
    if not exists (
      select 1 from public.interests i
      where i.job_id = old.id and i.pro_id = new.selected_pro_id
    ) then
      raise exception 'El profesional debe haber manifestado interés';
    end if;
    if new.status <> 'matched' then
      raise exception 'El trabajo debe quedar en estado matched';
    end if;
    new.client_contact_consent := false;
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'open' and new.status in ('matched','cancelled')) or
      (old.status = 'matched' and new.status in ('completed','cancelled'))
    ) then
      raise exception 'Transición de estado no permitida';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_job_update on public.jobs;
create trigger trigger_job_update before update on public.jobs
for each row execute function public.validate_job_update();
