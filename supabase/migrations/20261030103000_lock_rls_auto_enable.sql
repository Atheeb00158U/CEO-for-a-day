-- Supabase creates public.rls_auto_enable() with each new project (an event-trigger helper). It runs inside the
-- database on its own; nobody needs to call it over the API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
