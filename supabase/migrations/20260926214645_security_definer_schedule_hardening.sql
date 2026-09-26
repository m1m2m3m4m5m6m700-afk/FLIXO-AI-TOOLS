-- Restrict the SECURITY DEFINER schedule-claim RPC to trusted server execution.
-- The scheduler mutates lease state and must not be exposed through the Data API.
revoke execute on function public.flixo_claim_due_agent_schedules(integer, timestamptz) from public;
revoke execute on function public.flixo_claim_due_agent_schedules(integer, timestamptz) from anon, authenticated;
grant execute on function public.flixo_claim_due_agent_schedules(integer, timestamptz) to service_role;
