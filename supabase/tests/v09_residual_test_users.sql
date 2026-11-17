-- SOLO LECTURA. Identifica exclusivamente cuentas ficticias del arnes v0.9.
-- Revisar id, correo, fecha y runId antes de eliminar una cuenta individual desde Auth > Users.
-- No convertir esta consulta en un DELETE masivo.

select id,email,created_at,last_sign_in_at,raw_user_meta_data->>'display_name' as display_name
from auth.users
where email like 'arauka-v09-%@example.invalid'
order by created_at desc;

-- Run que fallo al intentar crear el primer trabajo (revision dirigida).
select id,email,created_at,last_sign_in_at,raw_user_meta_data->>'display_name' as display_name
from auth.users
where email like 'arauka-v09-6a85d18f-fe15-41bb-845a-20b12a8af0cb-%@example.invalid'
order by created_at desc;

-- Cuentas ficticias del arnes empresarial v0.9.3. Revisar cada run antes de borrar.
select id,email,created_at,last_sign_in_at,raw_user_meta_data->>'display_name' as display_name
from auth.users
where email like 'arauka-v093-%@example.invalid'
order by created_at desc;

-- Grants administrativos ficticios v0.9.3. Debe devolver cero filas tras el arnes.
select a.user_id,u.email,a.granted_at,a.note
from public.administrative_reviewers a
left join auth.users u on u.id=a.user_id
where a.note like 'Revisor ficticio %'
   or u.email like 'arauka-v093-%@example.invalid'
order by a.granted_at desc;

-- Diagnostico dirigido del run cuyo revisor no pudo eliminarse por FK.
with run_users as (
  select id,email,created_at
  from auth.users
  where email like 'arauka-v093-65477c78-16a5-4a79-926f-f775705c36e8-%@example.invalid'
)
select r.id,r.email,r.created_at,
       count(c.user_id) as verification_references,
       a.note as administrative_grant
from run_users r
left join public.commercial_profiles c on c.verification_reviewed_by=r.id
left join public.administrative_reviewers a on a.user_id=r.id
group by r.id,r.email,r.created_at,a.note
order by r.created_at;
