import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase', () => ({ supabase: { rpc, from: vi.fn(), functions: { invoke: vi.fn() } } }))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { LiveRoomsSection } from './LiveRoomsSection'

const OVERVIEW = {
  settings: { enabled: false, testers_only: true, max_rooms_at_once: 2, room_minutes: 60, max_listeners: 50, monthly_minutes: 4500 },
  minutes_this_month: 0,
  testers: [],
  stopped_hosts: [],
  rooms: [],
  reports: [],
}

function show(service: unknown) {
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'admin_live_overview') return { data: OVERVIEW, error: null }
    if (fn === 'admin_live_service_status') return { data: service, error: null }
    return { data: null, error: null }
  })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <LiveRoomsSection />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => rpc.mockReset())

describe('Live service keys', () => {
  it('lets an admin paste the URL, key and secret', async () => {
    show(null)
    fireEvent.change(await screen.findByPlaceholderText('abiaconnect-xxxx.livekit.cloud'), { target: { value: 'abiaconnect-ab12.livekit.cloud' } })
    fireEvent.change(screen.getByPlaceholderText('APIxxxxxxxx'), { target: { value: 'APIabc123' } })
    fireEvent.change(screen.getByPlaceholderText('Paste the secret'), { target: { value: 'a-long-secret-value-0123456789' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('admin_set_live_service', {
        _url: 'abiaconnect-ab12.livekit.cloud',
        _api_key: 'APIabc123',
        _secret: 'a-long-secret-value-0123456789',
      }),
    )
  })

  it('shows only a preview of a saved secret', async () => {
    show({ url: 'wss://a.livekit.cloud', api_key: 'APIabc123', secret_preview: 'a-lo…6789', updated_at: '2026-11-08T10:00:00Z' })
    expect(await screen.findByLabelText('API secret (hidden)')).toHaveTextContent('a-lo…6789')
    expect(screen.queryByPlaceholderText('Paste the secret')).toBeNull()
  })
})
