// Rules for what a signed-in member may push to another member's phone.
// Pure TypeScript (no Deno APIs) so it is unit tested in src/test.
//
// Members never choose the wording of a push sent to someone else. The only
// member-to-member push is the "incoming call" alert, and the server writes
// its text itself after checking that the call is real (see send-push).
// Admins (test tool) and self-tests may send their own text, within limits.

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CALL_ID_RE = /^[A-Za-z0-9-]{8,64}$/

export type CallType = 'voice' | 'video'
export type PushContent = { title: string; message: string; data: Record<string, string> }

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))

/**
 * Reads the call details from a push request. Accepts the current app's shape
 * ({ data: { type: 'call', callId, callType } }) and a top-level form.
 */
export function parseCallRequest(body: unknown): { callId: string; callType: CallType } | null {
  const b = (body ?? {}) as Record<string, unknown>
  const data = (b.data ?? {}) as Record<string, unknown>
  const type = str(b.type || data.type)
  if (type !== 'call') return null
  const callId = str(b.callId || data.callId)
  const callType = str(b.callType || data.callType)
  if (!CALL_ID_RE.test(callId)) return null
  if (callType !== 'voice' && callType !== 'video') return null
  return { callId, callType }
}

/** The incoming-call alert, worded by the server. */
export function buildCallPush(opts: {
  callerId: string
  callerName: string | null | undefined
  callId: string
  callType: CallType
  conversationId: string | null
}): PushContent {
  const name = (opts.callerName ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 60) || 'Someone'
  const video = opts.callType === 'video'
  const data: Record<string, string> = {
    type: 'call',
    callType: opts.callType,
    callId: opts.callId,
    callerId: opts.callerId,
    callerName: name,
    url: opts.conversationId ? `/messages/${opts.conversationId}` : '/messages',
  }
  if (opts.conversationId) data.conversationId = opts.conversationId
  return {
    title: video ? 'Incoming video call' : 'Incoming call',
    message: `${name} is ${video ? 'video ' : ''}calling you on AbiaConnect`,
    data,
  }
}

/** Free-text push (admins, self-tests, trusted server code): length-limited, in-app links only. */
export function sanitizeFreePush(body: unknown): PushContent | null {
  const b = (body ?? {}) as Record<string, unknown>
  const title = str(b.title).trim().slice(0, 100)
  const message = str(b.message).trim().slice(0, 500)
  if (!title || !message) return null
  const data: Record<string, string> = {}
  const raw = (b.data ?? {}) as Record<string, unknown>
  let n = 0
  for (const [k, v] of Object.entries(raw)) {
    if (n >= 12) break
    if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(k) || k === 'title' || k === 'message') continue
    const value = str(v).slice(0, 300)
    // Links in a push must stay inside the app.
    if (k === 'url' && !/^\/(?!\/)/.test(value)) continue
    data[k] = value
    n++
  }
  return { title, message, data }
}
