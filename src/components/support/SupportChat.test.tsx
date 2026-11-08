import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

let native = false
vi.mock('@/components/mobile/NativeAuthLayout', () => ({ isNativeApp: () => native }))

import { SupportChat } from './SupportChat'

const renderAt = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <SupportChat />
    </MemoryRouter>,
  )

const ask = (q: string) => {
  fireEvent.change(screen.getByLabelText('Your question'), { target: { value: q } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
}

describe('SupportChat', () => {
  it('answers from the Help Centre with a button to the right page', () => {
    native = false
    renderAt()
    fireEvent.click(screen.getByRole('button', { name: 'Open the help chat' }))
    ask('how can I volunteer')
    expect(screen.getByText('How do I volunteer with AbiaConnect?')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Apply to volunteer/ })).toHaveAttribute('href', '/volunteer')
  })

  it('offers the team when it has no answer', () => {
    native = false
    renderAt()
    fireEvent.click(screen.getByRole('button', { name: 'Open the help chat' }))
    ask('what is the price of garri in Aba market')
    expect(screen.getByText(/could not find an answer/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tell our team' })).toHaveAttribute('href', '/report-issue')
  })

  it('answers the starter questions with one tap', () => {
    native = false
    renderAt()
    fireEvent.click(screen.getByRole('button', { name: 'Open the help chat' }))
    fireEvent.click(screen.getByRole('button', { name: 'How do I change my profile picture?' }))
    expect(screen.getAllByText('How do I change my profile picture?').length).toBeGreaterThan(1)
  })

  it('has no floating button in the app, and opens from the More menu link', () => {
    native = true
    renderAt('/help?ask=1')
    expect(screen.queryByRole('button', { name: 'Open the help chat' })).toBeNull()
    expect(screen.getByLabelText('Your question')).toBeInTheDocument()
  })

  it('keeps out of the way in chats', () => {
    native = false
    renderAt('/messages/abc')
    expect(screen.queryByRole('button', { name: 'Open the help chat' })).toBeNull()
  })
})
