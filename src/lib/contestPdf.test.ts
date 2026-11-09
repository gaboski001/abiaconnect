import { beforeEach, describe, expect, it, vi } from 'vitest'

let native = false
const upload = vi.fn(async () => ({ error: null }))
const remove = vi.fn(async () => ({ error: null }))
const list = vi.fn(async () => ({ data: [{ name: 'old.pdf' }], error: null }))
const createSignedUrl = vi.fn(async () => ({ data: { signedUrl: 'https://x.supabase.co/signed.pdf' }, error: null }))
const openExternal = vi.fn(async (_url: string) => {})

vi.mock('@/components/mobile/NativeAuthLayout', () => ({ isNativeApp: () => native }))
vi.mock('@/lib/openExternal', () => ({ openExternal: (u: string) => openExternal(u) }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'me' } } }) },
    storage: { from: () => ({ upload, remove, list, createSignedUrl }) },
  },
}))
vi.mock('jspdf', () => ({
  jsPDF: class {
    addPage() {}
    addImage() {}
    output() {
      return new Blob(['%PDF'], { type: 'application/pdf' })
    }
  },
}))

import { pdfName, savePdf } from './contestPdf'

const fakePage = { toDataURL: () => 'data:image/jpeg;base64,AA' } as unknown as HTMLCanvasElement

beforeEach(() => {
  vi.clearAllMocks()
})

describe('contest PDFs', () => {
  it('names files plainly', () => {
    expect(pdfName('Ọhafịa Union Election 2026!', 'results')).toBe('ohafia-union-election-2026-results.pdf')
  })

  it('downloads straight away on the website', async () => {
    native = false
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await savePdf([fakePage], 'r.pdf')
    expect(click).toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
  })

  it('in the app: clears old files, keeps the new one privately and opens it in the phone’s viewer', async () => {
    native = true
    await savePdf([fakePage], 'slips.pdf')
    expect(remove).toHaveBeenCalledWith(['me/old.pdf'])
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(/^me\/.+-slips\.pdf$/), expect.any(Blob), expect.objectContaining({ contentType: 'application/pdf' }))
    expect(createSignedUrl).toHaveBeenCalledWith(expect.stringMatching(/^me\//), 600)
    expect(openExternal).toHaveBeenCalledWith('https://x.supabase.co/signed.pdf')
  })
})
