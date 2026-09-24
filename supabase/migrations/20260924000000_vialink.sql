create extension if not exists pgcrypto;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  created_at timestamptz not null default now()
);
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  name text not null,
  role text not null check (role in ('Administrador','Gestor de Frota','Supervisor','Condutor')),
  driver_name text,
  created_at timestamptz not null default now()
);
create table public.fleet_states (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  version bigint not null default 0,
  data jsonb not null default '{"vehicles":[],"drivers":[],"projects":[],"custody":[],"transfers":[],"checklists":[],"fuel":[],"logs":[],"issues":[],"expenses":[],"maintenance":[]}'::jsonb,
  updated_at timestamptz not null default now()
);
create table public.fleet_audit (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id),
  actor_id uuid not null references auth.users(id),
  action text not null,
  version bigint not null,
  occurred_at timestamptz not null default now()
);
create index fleet_audit_org_at on public.fleet_audit (organization_id,occurred_at desc);
create index profiles_org on public.profiles(organization_id);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.fleet_states enable row level security;
alter table public.fleet_audit enable row level security;
revoke all on public.organizations,public.profiles,public.fleet_states,public.fleet_audit from anon,authenticated;

-- Called only by the Edge Function with a service-role key. Version compare and
-- audit entry are one transaction; the browser cannot invoke this function.
create or replace function public.commit_fleet_state(
  p_org uuid,p_expected bigint,p_data jsonb,p_actor uuid,p_action text
) returns bigint language plpgsql security definer set search_path = '' as $$
declare v_version bigint;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Invalid state'; end if;
  update public.fleet_states set data=p_data,version=version+1,updated_at=now()
  where organization_id=p_org and version=p_expected
  returning version into v_version;
  if v_version is null then raise exception 'CONFLICT: state changed'; end if;
  insert into public.fleet_audit(organization_id,actor_id,action,version)
  values (p_org,p_actor,left(p_action,80),v_version);
  return v_version;
end $$;
revoke all on function public.commit_fleet_state(uuid,bigint,jsonb,uuid,text) from public,anon,authenticated;
grant execute on function public.commit_fleet_state(uuid,bigint,jsonb,uuid,text) to service_role;

-- Execute once in SQL Editor after creating the first account in Supabase Auth.
create or replace function public.bootstrap_vialink(p_user uuid,p_organization text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  if not exists(select 1 from auth.users where id=p_user) then raise exception 'User not found'; end if;
  if exists(select 1 from public.profiles where user_id=p_user) then raise exception 'Already provisioned'; end if;
  insert into public.organizations(name) values (trim(p_organization)) returning id into v_org;
  insert into public.fleet_states(organization_id) values (v_org);
  insert into public.profiles(user_id,organization_id,name,role)
  select p_user,v_org,coalesce(nullif(raw_user_meta_data->>'name',''),email),'Administrador'
  from auth.users where id=p_user;
  return v_org;
end $$;
revoke all on function public.bootstrap_vialink(uuid,text) from public,anon,authenticated,service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('vialink-evidence','vialink-evidence',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=8388608,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

-- Paths: organization UUID / user UUID / random UUID.ext
create policy "evidence read within organization" on storage.objects for select to authenticated
using (bucket_id='vialink-evidence' and exists (
  select 1 from public.profiles p where p.user_id=auth.uid()
  and p.organization_id::text=(storage.foldername(name))[1]
));
create policy "evidence upload for self" on storage.objects for insert to authenticated
with check (bucket_id='vialink-evidence' and (storage.foldername(name))[2]=auth.uid()::text and exists (
  select 1 from public.profiles p where p.user_id=auth.uid()
  and p.organization_id::text=(storage.foldername(name))[1]
));

-- Policies above access profiles as caller: allow only the caller's own row.
grant select (user_id,organization_id,name,role,driver_name) on public.profiles to authenticated;
create policy "read own profile" on public.profiles for select to authenticated using(user_id=auth.uid());
