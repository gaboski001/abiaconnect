import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const options = { current: [] as Array<{ provider: string; display_name: string }> }
const invoke = vi.fn()
const toastError = vi.fn()

vi.mock('@/lib/monetization/api', () => ({ getPaymentOptions: async () => options.current }))
vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'ada@example.com' } }) }))
vi.mock('@/hooks/useProfile', () => ({ useProfile: () => ({ data: { display_name: 'Ada Obi' } }) }))
vi.mock('@/lib/toast', () => ({ toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() } }))

import { DonateOnlineCard } from './DonateOnlineCard'

const renderCard = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DonateOnlineCard />
    </QueryClientProvider>,
  )

describe('Donate online', () => {
  beforeEach(() => {
    invoke.mockReset()
    toastError.mockReset()
  })

  it('stays hidden when no payment method is switched on', async () => {
    options.current = []
    const { container } = renderCard()
    await new Promise((r) => setTimeout(r, 30))
    expect(container).toBeEmptyDOMElement()
  })

  it('offers each enabled payment method and starts checkout with the donor details', async () => {
    options.current = [
      { provider: 'paystack', display_name: 'Paystack' },
      { provider: 'squad', display_name: 'Squad' },
    ]
    invoke.mockResolvedValue({ data: { checkoutUrl: 'https://checkout.paystack.com/abc', reference: 'ABIAD123' }, error: null })
    const assign = vi.fn()
    Object.defineProperty(window, 'location', { value: { ...window.location, set href(v: string) { assign(v) } }, writable: true })
    renderCard()
    fireEvent.click(await screen.findByRole('button', { name: '₦10,000' }))
    expect(screen.getByLabelText('Your name')).toHaveValue('Ada Obi')
    expect(screen.getByLabelText('Email (for your receipt)')).toHaveValue('ada@example.com')
    fireEvent.click(screen.getByRole('button', { name: /with Squad/ }))
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('donations-checkout', {
        body: { amount: 10000, provider: 'squad', name: 'Ada Obi', email: 'ada@example.com', message: undefined, anonymous: false },
      }),
    )
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.paystack.com/abc'))
  })

  it('checks the amount before contacting the server', async () => {
    options.current = [{ provider: 'paystack', display_name: 'Paystack' }]
    renderCard()
    fireEvent.change(await screen.findByLabelText('Other amount in Naira'), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: /Donate/ }))
    expect(toastError).toHaveBeenCalledWith('Please enter at least ₦100.')
    expect(invoke).not.toHaveBeenCalled()
  })
})
