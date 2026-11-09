import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

let native = false
vi.mock('@/components/mobile/NativeAuthLayout', () => ({ isNativeApp: () => native }))

import { SupportChatLauncher as SupportChat } from './SupportChatLauncher'

const renderAt = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <SupportChat />
    </MemoryRouter>,
  )

const ask = async (q: string) => {
  fireEvent.change(await screen.findByLabelText('Your question'), { target: { value: q } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
}

describe('SupportChat', () => {
  it('answers from the Help Centre with a button to the right page', async () => {
    native = false
    renderAt()
    fireEvent.click(screen.getByRole('button', { name: 'Open the help chat' }))
    await ask('how can I volunteer')
    expect(screen.getByText('How do I volunteer with AbiaConnect?')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Apply to volunteer/ })).toHaveAttribute('href', '/volunteer')
  })

  it('offers the team when it has no answer', async () => {
    native = false
    renderAt()
    fireEvent.click(screen.getByRole('button', { name: 'Open the help chat' }))
    await ask('what is the price of garri in Aba market')
    expect(screen.getByText(/could not find an answer/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tell our team' })).toHaveAttribute('href', '/report-issue')
  })

  it('answers the starter questions with one tap', async () => {
    native = false
    renderAt()
    fireEvent.click(screen.getByRole('button', { name: 'Open the help chat' }))
    fireEvent.click(await screen.findByRole('button', { name: 'How do I change my profile picture?' }))
    expect(screen.getAllByText('How do I change my profile picture?').length).toBeGreaterThan(1)
  })

  it('opens from the More menu link in the app', async () => {
    native = true
    renderAt('/help?ask=1')
    expect(await screen.findByLabelText('Your question')).toBeInTheDocument()
  })

  it('shows the movable button in the app too, starting above the bottom menu bar', () => {
    native = true
    localStorage.clear()
    renderAt('/')
    const button = screen.getByRole('button', { name: 'Open the help chat' })
    expect(button.style.bottom).toBe('92px')
  })

  it('keeps out of the way in app chats', () => {
    native = true
    renderAt('/messages/abc')
    expect(screen.queryByRole('button', { name: 'Open the help chat' })).toBeNull()
  })

  it('keeps out of the way in chats', async () => {
    native = false
    renderAt('/messages/abc')
    expect(screen.queryByRole('button', { name: 'Open the help chat' })).toBeNull()
  })

  it('shows on the welcome steps, where it can be dragged out of the way', () => {
    native = false
    renderAt('/welcome')
    expect(screen.getByRole('button', { name: 'Open the help chat' })).toBeInTheDocument()
  })

  it('moves when dragged, remembers the spot, and does not open the chat on that drag', () => {
    native = false
    localStorage.clear()
    renderAt('/')
    const button = screen.getByRole('button', { name: 'Open the help chat' })
    button.setPointerCapture = () => {}
    // The test browser's pointer events carry no position; give them a mouse event's.
    class TestPointerEvent extends MouseEvent {
      pointerId: number
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init)
        this.pointerId = init.pointerId ?? 1
      }
    }
    vi.stubGlobal('PointerEvent', TestPointerEvent)
    fireEvent.pointerDown(button, { button: 0, clientX: 500, clientY: 500, pointerId: 1 })
    fireEvent.pointerMove(button, { clientX: 400, clientY: 300, pointerId: 1 })
    fireEvent.pointerUp(button, { pointerId: 1 })
    fireEvent.click(button)
    expect(button.style.right).toBe('124px')
    expect(button.style.bottom).toBe('224px')
    expect(JSON.parse(localStorage.getItem('abia:help-button-spot') ?? '{}')).toEqual({ right: 124, bottom: 224 })
    expect(screen.queryByLabelText('Your question')).toBeNull()
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it.each(['/create-thread', '/contests/new', '/relationship/edit'])(
    'stays off step-by-step and form pages so it cannot cover Next or Post (%s)',
    (path) => {
      native = false
      renderAt(path)
      expect(screen.queryByRole('button', { name: 'Open the help chat' })).toBeNull()
    },
  )
})
