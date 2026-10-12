import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThreadEditor } from '@/components/thread/ThreadEditor'

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

// jsdom has no layout, which the editor asks for when it moves the cursor.
const rect = { x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, toJSON: () => ({}) }
Range.prototype.getBoundingClientRect = () => rect as DOMRect
Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} }) as unknown as DOMRectList
Element.prototype.scrollIntoView = () => {}
document.elementFromPoint = () => null

describe('ThreadEditor', () => {
  it('offers layouts while the story is empty and fills in the chosen one', async () => {
    const onChange = vi.fn()
    const { container } = render(<ThreadEditor value="" onChange={onChange} placeholder="Start here" />)
    await screen.findByRole('toolbar', { name: 'Formatting' })

    expect(container.querySelector('p.is-empty')?.getAttribute('data-placeholder')).toBe('Start here')
    fireEvent.click(screen.getByRole('button', { name: 'Question' }))

    await waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(onChange.mock.lastCall?.[0]).toBe(
      '<p></p><h3>Background</h3><p></p><h3>What I have tried</h3><p></p><h3>What I need</h3><p></p>',
    )
    // Each empty line says what to write there; the layout chips are gone.
    const hints = Array.from(container.querySelectorAll('p.is-empty')).map((p) => p.getAttribute('data-placeholder'))
    expect(hints).toEqual([
      'Start with your main point in one or two sentences.',
      'Explain the situation so people understand what you are asking.',
      'Say what you have already done or found out, if anything.',
      'Say the kind of answer that would help: a contact, a price, steps to follow.',
    ])
    expect(screen.queryByText('Not sure how to begin? Pick a layout:')).toBeNull()
  })
})
