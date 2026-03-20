/*
 * SUPABASE SQL — run this in the Supabase SQL editor before deploying:
 *
 * create table public.rate_limits (
 *   id uuid primary key default gen_random_uuid(),
 *   identifier text not null,
 *   limit_type text not null,
 *   created_at timestamptz default now()
 * );
 *
 * create index rate_limits_lookup on public.rate_limits (identifier, limit_type, created_at);
 *
 * -- Auto-delete records older than 2 hours to keep table small
 * create or replace function delete_old_rate_limits() returns trigger as $$
 * begin
 *   delete from public.rate_limits where created_at < now() - interval '2 hours';
 *   return new;
 * end;
 * $$ language plpgsql;
 *
 * create trigger cleanup_rate_limits
 *   after insert on public.rate_limits
 *   execute procedure delete_old_rate_limits();
 */

import { createAdminClient } from '@/lib/supabase/admin'

export function getIpIdentifier(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'anonymous'
  )
}

export async function checkRateLimit(
  identifier: string,
  limitType: 'chat' | 'session_start' | 'pdf',
  maxRequests: number,
  windowMinutes: number
): Promise<boolean> {
  try {
    const adminClient = createAdminClient()
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()
    const { count } = await adminClient
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .eq('limit_type', limitType)
      .gte('created_at', windowStart)
    if ((count ?? 0) >= maxRequests) return false
    await adminClient
      .from('rate_limits')
      .insert({ identifier, limit_type: limitType })
    return true
  } catch {
    return true // fail open — never block on rate limit infra failure
  }
}
