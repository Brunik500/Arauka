-- SOLO LECTURA. Ejecutar antes de migration_v0.9.5_account_deletion_foundation.sql.
-- Un unico resultado exportable a CSV: topologia esperada, observada y resumen.
with expected(source_schema,source_table,source_column,target_schema,target_table,target_column,expected_on_delete,critical) as (
  values
    ('public','profiles','id','auth','users','id','CASCADE',true),
    ('public','jobs','client_id','public','profiles','id','CASCADE',true),
    ('public','jobs','selected_pro_id','public','profiles','id','NO ACTION',true),
    ('public','interests','job_id','public','jobs','id','CASCADE',true),
    ('public','interests','pro_id','public','profiles','id','CASCADE',true),
    ('public','portfolio','pro_id','public','profiles','id','CASCADE',true),
    ('public','reviews','job_id','public','jobs','id','CASCADE',true),
    ('public','reviews','client_id','public','profiles','id','CASCADE',true),
    ('public','reviews','pro_id','public','profiles','id','CASCADE',true),
    ('public','verifications','pro_id','public','profiles','id','CASCADE',true),
    ('public','commercial_profiles','verification_reviewed_by','auth','users','id','NO ACTION',true),
    ('public','administrative_reviewers','granted_by','auth','users','id','NO ACTION',true),
    ('public','private_contacts','user_id','auth','users','id','CASCADE',true),
    ('public','notification_preferences','user_id','auth','users','id','CASCADE',true),
    ('public','notifications','recipient_id','auth','users','id','CASCADE',true),
    ('public','notifications','job_id','public','jobs','id','SET NULL',true),
    ('public','account_identities','user_id','auth','users','id','CASCADE',true),
    ('public','account_experiences','user_id','auth','users','id','CASCADE',true),
    ('public','commercial_profiles','user_id','auth','users','id','CASCADE',true),
    ('public','company_documents','user_id','auth','users','id','CASCADE',true),
    ('public','administrative_reviewers','user_id','auth','users','id','CASCADE',true),
    ('public','account_registration_intents','user_id','auth','users','id','CASCADE',true)
), actual as (
  select sn.nspname source_schema,st.relname source_table,sa.attname source_column,
         tn.nspname target_schema,tt.relname target_table,ta.attname target_column,
         case c.confdeltype when 'a' then 'NO ACTION' when 'r' then 'RESTRICT'
           when 'c' then 'CASCADE' when 'n' then 'SET NULL' when 'd' then 'SET DEFAULT' end observed_on_delete,
         c.conname constraint_name
  from pg_constraint c
  join pg_class st on st.oid=c.conrelid join pg_namespace sn on sn.oid=st.relnamespace
  join pg_class tt on tt.oid=c.confrelid join pg_namespace tn on tn.oid=tt.relnamespace
  cross join lateral unnest(c.conkey) with ordinality sk(attnum,ord)
  join lateral unnest(c.confkey) with ordinality tk(attnum,ord) on tk.ord=sk.ord
  join pg_attribute sa on sa.attrelid=st.oid and sa.attnum=sk.attnum
  join pg_attribute ta on ta.attrelid=tt.oid and ta.attnum=tk.attnum
  where c.contype='f' and sn.nspname='public'
    and st.relname in ('profiles','jobs','interests','portfolio','reviews','verifications',
      'private_contacts','notification_preferences','notifications','account_identities',
      'account_experiences','commercial_profiles','company_documents','administrative_reviewers',
      'account_registration_intents')
    -- Se incluyen todas las FK de estas tablas para que una relacion nueva hacia
    -- cualquier destino aparezca como ADICIONAL y requiera revision humana.
), compared as (
  select coalesce(e.source_schema,a.source_schema) source_schema,
         coalesce(e.source_table,a.source_table) source_table,
         coalesce(e.source_column,a.source_column) source_column,
         coalesce(e.target_schema,a.target_schema) target_schema,
         coalesce(e.target_table,a.target_table) target_table,
         coalesce(e.target_column,a.target_column) target_column,
         e.expected_on_delete,a.observed_on_delete,a.constraint_name,
         coalesce(e.critical,false) critical,
         case when e.source_table is null then 'ADICIONAL' when a.source_table is null then 'FALTANTE'
              when e.expected_on_delete<>a.observed_on_delete then 'INCOMPATIBLE' else 'COINCIDE' end result,
         e.source_table is not null and a.source_table is not null
           and e.expected_on_delete=a.observed_on_delete matches
  from expected e full join actual a using
    (source_schema,source_table,source_column,target_schema,target_table,target_column)
), totals as (
  select count(*) total_checks,count(*) filter(where matches) matches,
         count(*) filter(where not matches) differences,
         count(*) filter(where critical and not matches) installation_blockers from compared
)
select c.source_schema,c.source_table,c.source_column,c.target_schema,c.target_table,c.target_column,
       c.expected_on_delete,c.observed_on_delete,c.constraint_name,c.critical,c.result,c.matches,
       t.total_checks,t.matches total_matches,t.differences,t.installation_blockers,
       t.installation_blockers=0 and t.differences=0 preflight_fk_ok
from compared c cross join totals t
order by not c.matches,c.source_schema,c.source_table,c.source_column,c.target_schema,c.target_table;
