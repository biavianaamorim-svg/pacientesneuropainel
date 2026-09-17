-- Consolida categorias equivalentes de suspeita sem perder vínculos dos pacientes.
-- Executar após fazer backup do banco e revisar as linhas afetadas.

create temporary table _suspicion_category_merge on commit drop as
with normalizadas as (
  select
    id,
    nome,
    regexp_replace(lower(trim(public.unaccent(nome))), '\s+', ' ', 'g') as chave
  from public.suspicion_categories
), oficiais as (
  select distinct on (chave) chave, id as id_oficial
  from normalizadas
  order by chave, id
)
select n.id, o.id_oficial
from normalizadas n
join oficiais o using (chave)
where n.id <> o.id_oficial;

-- Garante o nome canônico da categoria solicitada.
update public.suspicion_categories sc
set nome = 'Anômalo/Congênito'
where sc.id = (
  select o.id_oficial
  from (
    select distinct on (regexp_replace(lower(trim(public.unaccent(nome))), '\s+', ' ', 'g')) id as id_oficial
    from public.suspicion_categories
    where regexp_replace(lower(trim(public.unaccent(nome))), '\s+', ' ', 'g')
      = regexp_replace(lower(trim(public.unaccent('Anômalo/Congênito'))), '\s+', ' ', 'g')
    order by regexp_replace(lower(trim(public.unaccent(nome))), '\s+', ' ', 'g'), id
  ) o
);

insert into public.patient_suspicions (patient_id, suspicion_id)
select ps.patient_id, m.id_oficial
from public.patient_suspicions ps
join _suspicion_category_merge m on m.id = ps.suspicion_id
on conflict (patient_id, suspicion_id) do nothing;

delete from public.patient_suspicions ps
using _suspicion_category_merge m
where ps.suspicion_id = m.id;

delete from public.suspicion_categories sc
using _suspicion_category_merge m
where sc.id = m.id;

-- Impede duplicidades futuras equivalentes a espaços/maiúsculas/acentos.
create unique index if not exists suspicion_categories_nome_normalizado_idx
on public.suspicion_categories (regexp_replace(lower(trim(public.unaccent(nome))), '\s+', ' ', 'g'));
