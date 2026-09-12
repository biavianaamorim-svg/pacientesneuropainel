-- ENUMS
create type public.app_role as enum ('admin','user');
create type public.status_diagnostico as enum ('aberto','fechado','sem_seguimento');
create type public.desfecho as enum ('melhora','obito','eutanasia','sem_seguimento','em_acompanhamento');
create type public.exame_tipo as enum ('RM','TC','Radiografia','LCR','Hemograma','Eletroneuromiografia','Outro');
create type public.exame_status as enum ('solicitado','realizado');

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by authenticated" on public.profiles for select to authenticated using (true);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);

-- ROLES
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "roles readable by authenticated" on public.user_roles for select to authenticated using (true);
create policy "admins manage roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- new user -> profile + role (first user becomes admin)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare has_admin boolean;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  select exists(select 1 from public.user_roles where role = 'admin') into has_admin;
  insert into public.user_roles (user_id, role)
  values (new.id, case when has_admin then 'user'::app_role else 'admin'::app_role end);
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- VOCABULARY TABLES
create table public.neuro_regions (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  created_at timestamptz not null default now()
);
create table public.suspicion_categories (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  created_at timestamptz not null default now()
);
create table public.diagnosis_categories (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  created_at timestamptz not null default now()
);
grant select on public.neuro_regions, public.suspicion_categories, public.diagnosis_categories to authenticated;
grant insert, update, delete on public.neuro_regions, public.suspicion_categories, public.diagnosis_categories to authenticated;
grant all on public.neuro_regions, public.suspicion_categories, public.diagnosis_categories to service_role;
alter table public.neuro_regions enable row level security;
alter table public.suspicion_categories enable row level security;
alter table public.diagnosis_categories enable row level security;

create policy "regions read" on public.neuro_regions for select to authenticated using (true);
create policy "regions admin write" on public.neuro_regions for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "susp read" on public.suspicion_categories for select to authenticated using (true);
create policy "susp admin write" on public.suspicion_categories for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "diag read" on public.diagnosis_categories for select to authenticated using (true);
create policy "diag admin write" on public.diagnosis_categories for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- PATIENTS
create sequence public.codigo_publicacao_seq;
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  codigo text,
  codigo_publicacao text not null unique default ('CASO-' || lpad(nextval('public.codigo_publicacao_seq')::text, 4, '0')),
  paciente text not null,
  tutor text,
  especie text,
  raca text,
  esterilizacao text,
  idade_texto text,
  idade_meses integer,
  sexo text,
  vivo_morto text,
  status_diagnostico status_diagnostico not null default 'aberto',
  diagnostico_texto_livre text,
  data_atendimento date,
  desfecho desfecho,
  data_desfecho date,
  neurolocalizacao_texto text,
  suspeitas_texto text,
  diagnostico_importado_texto text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.patients to authenticated;
grant all on public.patients to service_role;
grant usage, select on sequence public.codigo_publicacao_seq to authenticated, service_role;
alter table public.patients enable row level security;
create policy "patients read" on public.patients for select to authenticated using (true);
create policy "patients insert" on public.patients for insert to authenticated with check (true);
create policy "patients update" on public.patients for update to authenticated using (true) with check (true);
create policy "patients delete" on public.patients for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger patients_touch before update on public.patients
  for each row execute function public.touch_updated_at();

-- JOIN TABLES
create table public.patient_regions (
  patient_id uuid not null references public.patients(id) on delete cascade,
  region_id uuid not null references public.neuro_regions(id) on delete cascade,
  primary key (patient_id, region_id)
);
create table public.patient_suspicions (
  patient_id uuid not null references public.patients(id) on delete cascade,
  suspicion_id uuid not null references public.suspicion_categories(id) on delete cascade,
  primary key (patient_id, suspicion_id)
);
create table public.patient_diagnoses (
  patient_id uuid not null references public.patients(id) on delete cascade,
  diagnosis_id uuid not null references public.diagnosis_categories(id) on delete cascade,
  primary key (patient_id, diagnosis_id)
);
grant select, insert, update, delete on public.patient_regions, public.patient_suspicions, public.patient_diagnoses to authenticated;
grant all on public.patient_regions, public.patient_suspicions, public.patient_diagnoses to service_role;
alter table public.patient_regions enable row level security;
alter table public.patient_suspicions enable row level security;
alter table public.patient_diagnoses enable row level security;
create policy "pr all" on public.patient_regions for all to authenticated using (true) with check (true);
create policy "ps all" on public.patient_suspicions for all to authenticated using (true) with check (true);
create policy "pd all" on public.patient_diagnoses for all to authenticated using (true) with check (true);

-- EXAMS
create table public.exams (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  tipo exame_tipo not null,
  status exame_status not null default 'solicitado',
  data date,
  resultado text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.exams to authenticated;
grant all on public.exams to service_role;
alter table public.exams enable row level security;
create policy "exams all" on public.exams for all to authenticated using (true) with check (true);

create index on public.exams (patient_id);
create index on public.patients (status_diagnostico);
create index on public.patients (paciente);

-- SEEDS
insert into public.neuro_regions (nome) values
('Encéfalo - Prosencéfalo/córtex cerebral'),('Encéfalo - Núcleos da base'),('Encéfalo - Tronco encefálico'),
('Encéfalo - Cerebelo'),('Vestibular central'),('Vestibular periférico'),('Medula - C1-C5'),('Medula - C6-T2'),
('Medula - T3-L3'),('Medula - L4-S3'),('Cauda equina / Lombossacral'),('Nervo periférico'),
('Junção neuromuscular'),('Músculo'),('Multifocal / Difuso');

insert into public.suspicion_categories (nome) values
('Vascular'),('Inflamatório/Infeccioso'),('Traumático'),('Anômalo/Congênito'),('Metabólico'),
('Idiopático'),('Neoplásico'),('Nutricional'),('Degenerativo');

insert into public.diagnosis_categories (nome) values
('Doença do disco intervertebral (protrusão/extrusão)'),('Neoplasia do SNC'),
('Meningoencefalite/mielite (inflamatória/MUO)'),('Epilepsia idiopática'),('Malformação congênita'),
('Evento vascular (AVC)'),('Trauma'),('Mielopatia degenerativa'),('Doença metabólica/tóxica'),
('Doença infecciosa'),('Discoespondilite'),('Síndrome vestibular idiopática'),
('Sem diagnóstico definitivo'),('Outro');