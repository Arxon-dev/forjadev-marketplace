-- Fase 3: Trigger para crear perfil automático
-- Se ejecuta cuando se crea un nuevo usuario en auth.users

-- Crear función que genera el perfil
create or replace function public.handle_new_user()
returns trigger as $$
begin
  -- Inserta un nuevo perfil con los datos del usuario autenticado
  insert into public.profiles (
    id,
    email,
    username,
    display_name,
    role,
    created_at,
    updated_at
  ) values (
    new.id,
    new.email,
    -- Extrae username del raw_user_meta_data, con fallback al email sin dominio
    coalesce(
      new.raw_user_meta_data ->> 'username',
      split_part(new.email, '@', 1)
    ),
    -- Extrae display_name del raw_user_meta_data, con fallback al username
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      coalesce(
        new.raw_user_meta_data ->> 'username',
        split_part(new.email, '@', 1)
      )
    ),
    'buyer', -- Role por defecto
    now(),
    now()
  );
  
  return new;
exception when others then
  -- Log del error pero no rompe la creación del usuario
  raise warning 'Error creando perfil para usuario %: %', new.id, sqlerrm;
  return new;
end;
$$ language plpgsql security definer;

-- Crear trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
