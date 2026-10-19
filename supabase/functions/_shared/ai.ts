// The AI switch: asks whichever AI the site owner chose in the Admin portal
// (Claude, Gemini or DeepSeek on their own account, or Lovable AI), with Lovable
// AI as an optional backup. Used by the Newsdesk and Ugo moderation.
import Anthropic from 'npm:@anthropic-ai/sdk@0.133.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  buildRequest,
  explainFailure,
  extractJson,
  JSON_ONLY,
  modelFor,
  readAnswer,
  readConfig,
  readGeminiModels,
  recommendGeminiModel,
  type AiAsk,
  type AiConfig,
  type AiFeature,
  type AiProvider,
} from './ai-core.ts'

export * from './ai-core.ts'

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const service = SUPABASE_URL && SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY) : null

// The choice is read at most once a minute per running function.
let cached: { at: number; config: AiConfig } | null = null

export async function loadAiConfig(force = false): Promise<AiConfig> {
  if (!force && cached && Date.now() - cached.at < 60_000) return cached.config
  let config = readConfig(null)
  if (service) {
    const { data, error } = await service.rpc('get_ai_config')
    if (error) console.error('could not load the AI settings', error.message)
    else config = readConfig(data)
  }
  cached = { at: Date.now(), config }
  return config
}

/** Whether any AI can answer at all (the chosen one with its key, or Lovable AI). */
export async function aiAvailable() {
  const config = await loadAiConfig()
  if (config.provider === 'lovable') return !!LOVABLE_API_KEY
  return !!config.keys[config.provider] || (config.fallback && !!LOVABLE_API_KEY)
}

export interface AiAnswer {
  /** The JSON object as text, or null when no AI could answer. */
  json: string | null
  provider: AiProvider
  fellBack: boolean
  /** Why the chosen AI failed, in plain words, when it did. */
  problem: string | null
}

/** The Gemini models a key can use to write text. */
export async function listGeminiModels(key: string): Promise<string[]> {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
    headers: { 'x-goog-api-key': key },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    console.error('gemini model list error', res.status, (await res.text().catch(() => '')).slice(0, 200))
    return []
  }
  return readGeminiModels(await res.json())
}

/**
 * When Google no longer offers the saved Gemini model, pick the best one this
 * key can use and remember it, so it keeps working without anyone noticing.
 */
async function replaceGeminiModel(config: AiConfig, key: string, failed: string): Promise<string | null> {
  const replacement = recommendGeminiModel(await listGeminiModels(key))
  if (!replacement || replacement === failed) return null
  console.error(`gemini model "${failed}" is not available; using "${replacement}" instead`)
  config.models = { ...config.models, gemini: replacement }
  if (service) {
    const { data } = await service.from('ai_provider_settings').select('models').eq('id', true).maybeSingle()
    const models = { ...((data?.models as Record<string, string> | null) ?? {}), gemini: replacement }
    const { error } = await service.from('ai_provider_settings').update({ models, updated_at: new Date().toISOString() }).eq('id', true)
    if (error) console.error('could not save the new Gemini model', error.message)
  }
  return replacement
}

async function callOnce(
  provider: AiProvider,
  config: AiConfig,
  ask: AiAsk,
  timeoutMs: number,
  retried = false,
  thinking = true,
): Promise<{ text: string | null; problem: string | null }> {
  const model = modelFor(config, provider)
  if (provider === 'claude') {
    const key = config.keys.claude
    if (!key) return { text: null, problem: 'No Claude API key is saved.' }
    try {
      const client = new Anthropic({ apiKey: key, maxRetries: 1, timeout: timeoutMs })
      const response = await client.messages.create({
        model,
        max_tokens: 8000,
        system: ask.system + JSON_ONLY,
        messages: [{ role: 'user', content: ask.user }],
      })
      if (response.stop_reason === 'refusal') return { text: null, problem: 'Claude declined to answer this one.' }
      const text = response.content.map((block) => (block.type === 'text' ? block.text : '')).join('')
      return { text, problem: null }
    } catch (error) {
      const status = error instanceof Anthropic.APIError ? (error.status ?? null) : null
      const detail = error instanceof Error ? error.message : String(error)
      console.error('claude error', status, detail.slice(0, 300))
      return { text: null, problem: explainFailure('claude', status, detail) }
    }
  }

  const key = provider === 'lovable' ? LOVABLE_API_KEY : config.keys[provider]
  if (!key) return { text: null, problem: provider === 'lovable' ? 'Lovable AI is not set up.' : `No ${provider} API key is saved.` }
  const { url, init } = buildRequest(provider, key, model, ask, { thinking })
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error(`${provider} error`, res.status, detail.slice(0, 300))
      // Google retires model versions: switch to one this key can use, once.
      if (provider === 'gemini' && res.status === 404 && !retried && (await replaceGeminiModel(config, key, model))) {
        return callOnce(provider, config, ask, timeoutMs, true, thinking)
      }
      // A model that doesn't take the thinking setting: ask again without it.
      if (provider === 'gemini' && res.status === 400 && thinking && /thinking/i.test(detail)) {
        return callOnce(provider, config, ask, timeoutMs, retried, false)
      }
      return { text: null, problem: explainFailure(provider, res.status, detail) }
    }
    return { text: readAnswer(provider, await res.json()), problem: null }
  } catch (error) {
    console.error(`${provider} unreachable`, error instanceof Error ? error.message : String(error))
    return { text: null, problem: explainFailure(provider, null) }
  }
}

function logUse(feature: AiFeature, provider: AiProvider, ok: boolean, fellBack: boolean) {
  if (!service) return
  // Counting must never slow down or break the answer.
  service.from('ai_usage_log').insert({ feature, provider, ok, fell_back: fellBack }).then(
    ({ error }) => error && console.error('could not count AI use', error.message),
  )
}

/**
 * Asks the chosen AI one question and returns its JSON answer as text. If it
 * fails and the backup is on, Lovable AI answers instead.
 */
export async function askAiJson(
  feature: AiFeature,
  ask: AiAsk,
  options: { timeoutMs?: number; noFallback?: boolean; provider?: AiProvider } = {},
): Promise<AiAnswer> {
  const config = await loadAiConfig()
  const chosen = options.provider ?? config.provider
  const timeoutMs = options.timeoutMs ?? 45_000

  const first = await callOnce(chosen, config, ask, timeoutMs)
  const json = extractJson(first.text)
  if (json) {
    logUse(feature, chosen, true, false)
    return { json, provider: chosen, fellBack: false, problem: null }
  }
  const problem = first.problem ?? 'The answer was not valid JSON.'
  logUse(feature, chosen, false, false)

  if (chosen !== 'lovable' && config.fallback && !options.noFallback && LOVABLE_API_KEY) {
    const backup = await callOnce('lovable', config, ask, timeoutMs)
    const backupJson = extractJson(backup.text)
    logUse(feature, 'lovable', !!backupJson, true)
    if (backupJson) return { json: backupJson, provider: 'lovable', fellBack: true, problem }
  }
  return { json: null, provider: chosen, fellBack: false, problem }
}
