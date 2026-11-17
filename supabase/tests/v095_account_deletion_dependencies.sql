-- SOLO LECTURA. Inventario detallado complementario.
-- Ejecutar primero v095_fk_topology_audit.sql y v095_structural_preflight.sql.
-- Este archivo conserva el detalle bruto para investigar cualquier diferencia.
select (select count(*) from public.profiles) profiles,
       (select count(*) from public.jobs) jobs,
       (select count(*) from public.interests) interests,
       (select count(*) from public.reviews) reviews,
       (select count(*) from public.portfolio) portfolio,
       (select count(*) from public.verifications) verifications,
       (select count(*) from public.commercial_profiles) commercial_profiles,
       (select count(*) from public.company_documents) company_documents,
       (select count(*) from public.notifications) notifications;

select count(*) profiles_without_auth_user
from public.profiles p left join auth.users u on u.id=p.id where u.id is null;

select tc.table_schema,tc.table_name,kcu.column_name,ccu.table_schema foreign_schema,
       ccu.table_name foreign_table,ccu.column_name foreign_column,rc.delete_rule
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu on kcu.constraint_name=tc.constraint_name and kcu.constraint_schema=tc.constraint_schema
join information_schema.referential_constraints rc on rc.constraint_name=tc.constraint_name and rc.constraint_schema=tc.constraint_schema
join information_schema.constraint_column_usage ccu on ccu.constraint_name=rc.unique_constraint_name and ccu.constraint_schema=rc.unique_constraint_schema
where tc.constraint_type='FOREIGN KEY'
  and ((ccu.table_schema='auth' and ccu.table_name='users') or (ccu.table_schema='public' and ccu.table_name in ('profiles','jobs')))
order by foreign_schema,foreign_table,tc.table_schema,tc.table_name;

select id,name,public,file_size_limit,allowed_mime_types from storage.buckets
where id in ('portfolio','company-documents') order by id;

select bucket_id,count(*) object_count from storage.objects
where bucket_id in ('portfolio','company-documents') group by bucket_id order by bucket_id;

select count(*) jobs_with_selected_professional from public.jobs where selected_pro_id is not null;
select count(*) reviews_shared_between_accounts from public.reviews where client_id<>pro_id;
select count(*) reviewed_companies_with_reviewer_reference from public.commercial_profiles where verification_reviewed_by is not null;
select count(*) reviewer_grants_with_grantor_reference from public.administrative_reviewers where granted_by is not null;
