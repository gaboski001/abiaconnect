import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

// The editor library fails while starting, as it has on slow phones.
let failures = 0
vi.mock('@tiptap/react', async (orig) => {
  const real = await orig<typeof import('@tiptap/react')>()
  return {
    ...real,
    useEditor: (...args: Parameters<typeof real.useEditor>) => {
      if (failures > 0) {
        failures--
        throw new Error("Cannot read properties of null (reading 'spec')")
      }
      return real.useEditor(...args)
    },
  }
})

import { ThreadEditor } from '@/components/thread/ThreadEditor'

describe('story editor safety net', () => {
  it('starts the editor again by itself instead of crashing the page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    failures = 1
    render(<ThreadEditor value="<p>My story so far</p>" onChange={() => {}} />)
    expect(await screen.findByRole('toolbar', { name: 'Formatting' })).toBeInTheDocument()
    expect(screen.getByText('My story so far')).toBeInTheDocument()
  })

  it('offers Try again if it keeps failing, and the text is kept', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    failures = 99
    render(<ThreadEditor value="<p>Keep me</p>" onChange={() => {}} />)
    expect(await screen.findByText(/didn’t load properly. Your text is safe/)).toBeInTheDocument()
    failures = 0
    screen.getByRole('button', { name: 'Try again' }).click()
    expect(await screen.findByText('Keep me')).toBeInTheDocument()
  })
})
