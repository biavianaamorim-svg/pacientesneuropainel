create or replace function public.search_patients(
  termo text default '',
  limite integer default 50,
  deslocamento integer default 0
)
returns table (
  id uuid,
  codigo_publicacao text,
  paciente text,
  tutor text,
  especie text,
  idade_meses integer,
  status_diagnostico public.status_diagnostico,
  data_atendimento date,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with filtrados as (
    select p.*
    from public.patients p
    where termo is null
      or btrim(termo) = ''
      or public.unaccent(coalesce(p.paciente, '')) ilike '%' || public.unaccent(termo) || '%'
      or public.unaccent(coalesce(p.tutor, '')) ilike '%' || public.unaccent(termo) || '%'
      or public.unaccent(coalesce(p.codigo_publicacao, '')) ilike '%' || public.unaccent(termo) || '%'
  )
  select f.id,
         f.codigo_publicacao,
         f.paciente,
         f.tutor,
         f.especie,
         f.idade_meses,
         f.status_diagnostico,
         f.data_atendimento,
         count(*) over () as total_count
  from filtrados f
  order by f.codigo_publicacao, f.id
  limit limite offset deslocamento;
$$;

revoke execute on function public.search_patients(text, integer, integer) from public, anon;
grant execute on function public.search_patients(text, integer, integer) to authenticated;
