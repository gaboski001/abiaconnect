// The AI switch, pure parts: which providers exist, their default models, how
// to build a request for each, and how to read its answer. No network or Deno
// APIs here, so it can be tested directly.

export type AiProvider = 'lovable' | 'claude' | 'gemini' | 'deepseek'
export type KeyedProvider = Exclude<AiProvider, 'lovable'>

/** What the AI is used for, so the admin can see usage per feature. */
export type AiFeature = 'newsdesk' | 'moderation' | 'test'

export const PROVIDERS: AiProvider[] = ['lovable', 'claude', 'gemini', 'deepseek']

/** Fast, inexpensive models that do the Newsdesk and moderation well. */
export const DEFAULT_MODELS: Record<AiProvider, string> = {
  lovable: 'google/gemini-3-flash-preview',
  claude: 'claude-haiku-5-5',
  gemini: 'gemini-2.5-flash',
  deepseek: 'deepseek-chat',
}

export interface AiConfig {
  provider: AiProvider
  models: Partial<Record<AiProvider, string>>
  fallback: boolean
  keys: Partial<Record<KeyedProvider, string>>
}

export function readConfig(raw: unknown): AiConfig {
  const value = (raw ?? {}) as Partial<AiConfig>
  const provider = PROVIDERS.includes(value.provider as AiProvider) ? (value.provider as AiProvider) : 'lovable'
  return {
    provider,
    models: value.models && typeof value.models === 'object' ? value.models : {},
    fallback: value.fallback !== false,
    keys: value.keys && typeof value.keys === 'object' ? value.keys : {},
  }
}

export function modelFor(config: AiConfig, provider: AiProvider) {
  const chosen = config.models[provider]
  return typeof chosen === 'string' && chosen.trim() ? chosen.trim() : DEFAULT_MODELS[provider]
}

export interface AiAsk {
  system: string
  user: string
  temperature: number
}

/** Every answer must be one JSON object; providers without a JSON switch are told so. */
export const JSON_ONLY = '\n\nReply with one valid JSON object only, with no other text and no code fences.'

/** The HTTP request for the providers called without an SDK. */
export function buildRequest(
  provider: Exclude<AiProvider, 'claude'>,
  key: string,
  model: string,
  ask: AiAsk,
): { url: string; init: RequestInit } {
  if (provider === 'gemini') {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: ask.system }] },
          contents: [{ role: 'user', parts: [{ text: ask.user }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: ask.temperature },
        }),
      },
    }
  }
  const url =
    provider === 'deepseek'
      ? 'https://api.deepseek.com/chat/completions'
      : 'https://ai.gateway.lovable.dev/v1/chat/completions'
  const auth: Record<string, string> =
    provider === 'deepseek' ? { Authorization: `Bearer ${key}` } : { 'Lovable-API-Key': key }
  return {
    url,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({
        model,
        temperature: ask.temperature,
        messages: [
          // DeepSeek's JSON mode needs the word "json" in the prompt.
          { role: 'system', content: provider === 'deepseek' ? ask.system + JSON_ONLY : ask.system },
          { role: 'user', content: ask.user },
        ],
        response_format: { type: 'json_object' },
      }),
    },
  }
}

/** The answer text from a provider's response body, or null if there isn't one. */
export function readAnswer(provider: Exclude<AiProvider, 'claude'>, body: unknown): string | null {
  // deno-lint-ignore no-explicit-any
  const data = body as any
  if (provider === 'gemini') {
    const parts = data?.candidates?.[0]?.content?.parts
    if (!Array.isArray(parts)) return null
    const text = parts.map((part: { text?: string }) => part?.text ?? '').join('').trim()
    return text || null
  }
  const content = data?.choices?.[0]?.message?.content
  return typeof content === 'string' && content.trim() ? content : null
}

/** The JSON object inside an answer, as text (some models add words or code fences around it). */
export function extractJson(text: string | null): string | null {
  if (!text) return null
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  try {
    JSON.parse(trimmed)
    return trimmed
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start === -1 || end <= start) return null
    const inner = trimmed.slice(start, end + 1)
    try {
      JSON.parse(inner)
      return inner
    } catch {
      return null
    }
  }
}

/** A provider's error, in words the site owner understands. */
export function explainFailure(provider: AiProvider, status: number | null, detail = ''): string {
  const name = { lovable: 'Lovable AI', claude: 'Claude', gemini: 'Gemini', deepseek: 'DeepSeek' }[provider]
  if (status === null) return `${name} could not be reached (no answer in time).`
  if (status === 401 || status === 403 || (status === 400 && /api key/i.test(detail))) {
    return `${name} did not accept the API key. Check it on the AI provider page.`
  }
  if (status === 402) return `Your ${name} account has no credit left.`
  if (status === 404) return `${name} does not recognise the model name. Pick another model on the AI provider page.`
  if (status === 429) return `${name} is busy or your account's limit was reached.`
  return `${name} answered with an error (${status}).`
}
