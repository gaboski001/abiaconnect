import { describe, it, expect } from 'vitest'
import {
  buildRequest,
  DEFAULT_MODELS,
  alternativeGeminiModels,
  explainFailure,
  extractJson,
  geminiThinking,
  modelFor,
  readAnswer,
  readConfig,
  readGeminiModels,
  recommendGeminiModel,
} from '../../supabase/functions/_shared/ai-core'

const ask = { system: 'You moderate posts.', user: 'Check this post', temperature: 0 }

describe('AI switch settings', () => {
  it('falls back to Lovable AI and default models when nothing is saved', () => {
    const config = readConfig(null)
    expect(config.provider).toBe('lovable')
    expect(config.fallback).toBe(true)
    expect(modelFor(config, 'claude')).toBe(DEFAULT_MODELS.claude)
  })

  it('uses the saved provider and model, ignoring unknown providers', () => {
    expect(readConfig({ provider: 'claude', models: { claude: 'claude-sonnet-5-5' } }).provider).toBe('claude')
    expect(modelFor(readConfig({ models: { gemini: ' gemini-2.5-pro ' } }), 'gemini')).toBe('gemini-2.5-pro')
    expect(readConfig({ provider: 'someone-else' }).provider).toBe('lovable')
    expect(readConfig({ fallback: false }).fallback).toBe(false)
  })
})

describe('AI requests', () => {
  it('asks Gemini for JSON with the key in a header, never in the address', () => {
    const { url, init } = buildRequest('gemini', 'secret-key', 'gemini-2.5-flash', ask)
    expect(url).toContain('gemini-2.5-flash:generateContent')
    expect(url).not.toContain('secret-key')
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('secret-key')
    expect(JSON.parse(init.body as string).generationConfig.responseMimeType).toBe('application/json')
  })

  it('tells DeepSeek to answer in JSON, as its JSON mode requires', () => {
    const { url, init } = buildRequest('deepseek', 'k', 'deepseek-chat', ask)
    expect(url).toBe('https://api.deepseek.com/chat/completions')
    const body = JSON.parse(init.body as string)
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.messages[0].content).toMatch(/JSON/)
  })

  it('keeps using the Lovable gateway for Lovable AI', () => {
    const { url, init } = buildRequest('lovable', 'lov', 'google/gemini-3-flash-preview', ask)
    expect(url).toBe('https://ai.gateway.lovable.dev/v1/chat/completions')
    expect((init.headers as Record<string, string>)['Lovable-API-Key']).toBe('lov')
  })
})

describe('AI answers', () => {
  it('reads Gemini and chat-style answers', () => {
    expect(readAnswer('gemini', { candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }] })).toBe('{"a":1}')
    expect(readAnswer('deepseek', { choices: [{ message: { content: '{"b":2}' } }] })).toBe('{"b":2}')
    expect(readAnswer('lovable', { choices: [] })).toBeNull()
  })

  it('finds the JSON even with code fences or words around it', () => {
    expect(extractJson('```json\n{"verdict":"allow"}\n```')).toBe('{"verdict":"allow"}')
    expect(extractJson('Here you go: {"ok": true} Thanks')).toBe('{"ok": true}')
    expect(extractJson('no json here')).toBeNull()
    expect(extractJson(null)).toBeNull()
  })

  it('explains failures in plain words', () => {
    expect(explainFailure('claude', 401)).toMatch(/did not accept the API key/)
    expect(explainFailure('deepseek', 402)).toMatch(/no credit left/)
    expect(explainFailure('gemini', null)).toMatch(/could not be reached/)
  })
})

describe('Gemini model choice', () => {
  it('picks the newest stable Flash model the key can use', () => {
    expect(
      recommendGeminiModel([
        'gemini-2.0-flash',
        'gemini-3.0-flash',
        'gemini-3.5-flash-preview-09-2026',
        'gemini-3.0-pro',
        'gemini-3.0-flash-lite',
        'gemini-embedding-001',
        'gemini-3.0-flash-image',
      ]),
    ).toBe('gemini-3.0-flash')
    expect(recommendGeminiModel(['gemini-embedding-001'])).toBeNull()
  })

  it("reads only the models that can write text from Google's list", () => {
    const body = {
      models: [
        { name: 'models/gemini-3.0-flash', supportedGenerationMethods: ['generateContent', 'countTokens'] },
        { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
      ],
    }
    expect(readGeminiModels(body)).toEqual(['gemini-3.0-flash'])
  })
})

describe('Gemini speed', () => {
  it('keeps thinking low on newer Gemini models, and can leave it out', () => {
    expect(geminiThinking('gemini-3.8-flash')).toEqual({ thinkingLevel: 'low' })
    expect(geminiThinking('gemini-2.5-flash')).toEqual({ thinkingBudget: 0 })
    expect(geminiThinking('gemini-2.5-pro')).toBeNull()
    const withIt = JSON.parse(buildRequest('gemini', 'k', 'gemini-3.8-flash', ask).init.body as string)
    expect(withIt.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'low' })
    const without = JSON.parse(buildRequest('gemini', 'k', 'gemini-3.8-flash', ask, { thinking: false }).init.body as string)
    expect(without.generationConfig.thinkingConfig).toBeUndefined()
  })
})

describe('Gemini when Google is overloaded', () => {
  it('offers the next-best models after the one that failed', () => {
    const names = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.8-pro', 'gemini-embedding-001']
    expect(alternativeGeminiModels(names, 'gemini-3.8-flash')).toEqual(['gemini-3.5-flash', 'gemini-3.8-pro'])
  })

  it('explains a 503 as a passing problem at Google', () => {
    expect(explainFailure('gemini', 503)).toMatch(/overloaded/)
  })

  it("adds the provider's own message so the real cause shows", () => {
    const detail = JSON.stringify({ error: { code: 503, message: 'The model is overloaded.', status: 'UNAVAILABLE' } })
    expect(explainFailure('gemini', 503, detail)).toMatch(/Gemini says: "The model is overloaded\."/)
    expect(explainFailure('gemini', 500, 'not json')).not.toMatch(/says/)
  })
})
