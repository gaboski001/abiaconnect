// Per-caller rate limiting for edge functions, backed by the service-role-only
// consume_rate_limit() database function.

// deno-lint-ignore no-explicit-any
type Db = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: any; error: any }> }

/**
 * Counts one request for `key` in `scope`. Returns true while the caller is
 * within `max` requests per `windowSeconds`. When the limiter itself is
 * unavailable, `failClosed` decides: refuse (sensitive endpoints) or allow.
 */
export async function withinRateLimit(
  db: Db,
  key: string,
  scope: string,
  max: number,
  windowSeconds: number,
  failClosed = false,
): Promise<boolean> {
  const { data, error } = await db.rpc('consume_rate_limit', {
    _key: key,
    _scope: scope,
    _max: max,
    _window_seconds: windowSeconds,
  })
  if (error) {
    console.error('rate limiter unavailable', scope, error.message)
    return !failClosed
  }
  return data === true
}

/** Best-effort client IP from the edge proxy headers. */
export function clientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
    'unknown'
  ).slice(0, 64)
}
