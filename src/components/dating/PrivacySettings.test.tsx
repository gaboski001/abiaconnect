import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { messagingRuleText } from '@/lib/monetization/strings'

const api = vi.hoisted(() => ({
  getMyPrivacy: vi.fn(),
  setMyPrivacy: vi.fn(),
}))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' } }) }))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/monetization/api', () => ({ getMyPrivacy: api.getMyPrivacy, setMyPrivacy: api.setMyPrivacy }))

import { PrivacySettingsPanel } from './PrivacySettingsDialog'

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <PrivacySettingsPanel />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Privacy & messages', () => {
  beforeEach(() => {
    api.getMyPrivacy.mockResolvedValue({ message_privacy: 'everyone', incognito: false, has_connections_profile: true })
    api.setMyPrivacy.mockImplementation(async (p: { messagePrivacy?: string; incognito?: boolean }) => ({
      message_privacy: p.messagePrivacy ?? 'everyone',
      incognito: p.incognito ?? false,
      has_connections_profile: true,
    }))
  })

  it('lets members hide their profile (private mode)', async () => {
    renderPanel()
    const toggle = await screen.findByRole('switch', { name: /show my profile in discover and browse/i })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(toggle)
    await waitFor(() => expect(api.setMyPrivacy).toHaveBeenCalledWith({ incognito: true }, expect.anything()))
  })

  it('lets members choose who can message them', async () => {
    renderPanel()
    fireEvent.click(await screen.findByLabelText('No one'))
    await waitFor(() => expect(api.setMyPrivacy).toHaveBeenCalledWith({ messagePrivacy: 'nobody' }, expect.anything()))
    expect(await screen.findByLabelText('No one')).toBeChecked()
  })

  it('explains that private mode needs a Connect profile', async () => {
    api.getMyPrivacy.mockResolvedValue({ message_privacy: 'everyone', incognito: false, has_connections_profile: false })
    renderPanel()
    expect(await screen.findByText('Create your Connect profile to use private mode.')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /show my profile/i })).toBeDisabled()
  })
})

describe('messaging rule messages', () => {
  it('turns server rule errors into plain language', () => {
    expect(messagingRuleText('awaiting_reply: wait for a reply')).toMatch(/spam-free/)
    expect(messagingRuleText('messages_off: …')).toBe('This member is not accepting new messages.')
    expect(messagingRuleText('connections_only: …')).toMatch(/only accepts messages from their connections/)
    expect(messagingRuleText('match_required: …')).toMatch(/Connect with this member first/)
    expect(messagingRuleText('network error')).toBeNull()
  })
})
