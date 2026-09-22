-- Security hardening for trigger-only SECURITY DEFINER functions and service-role-only control tables.
revoke execute on function public.enforce_council_dispatch_priority() from public, anon, authenticated;
grant execute on function public.enforce_council_dispatch_priority() to service_role;

revoke execute on function public.flixo_council_assistant_wake_notify() from public, anon, authenticated;
grant execute on function public.flixo_council_assistant_wake_notify() to service_role;

revoke all on table public.flixo_council_assistant_channel_tokens from anon, authenticated;
drop policy if exists flixo_council_assistant_channel_tokens_anon_deny on public.flixo_council_assistant_channel_tokens;
drop policy if exists flixo_council_assistant_channel_tokens_authenticated_deny on public.flixo_council_assistant_channel_tokens;
create policy flixo_council_assistant_channel_tokens_anon_deny
  on public.flixo_council_assistant_channel_tokens
  for all to anon
  using (false)
  with check (false);
create policy flixo_council_assistant_channel_tokens_authenticated_deny
  on public.flixo_council_assistant_channel_tokens
  for all to authenticated
  using (false)
  with check (false);

revoke all on table public.flix_controller_push_queue from anon, authenticated;
drop policy if exists flix_controller_push_queue_anon_deny on public.flix_controller_push_queue;
drop policy if exists flix_controller_push_queue_authenticated_deny on public.flix_controller_push_queue;
create policy flix_controller_push_queue_anon_deny
  on public.flix_controller_push_queue
  for all to anon
  using (false)
  with check (false);
create policy flix_controller_push_queue_authenticated_deny
  on public.flix_controller_push_queue
  for all to authenticated
  using (false)
  with check (false);
