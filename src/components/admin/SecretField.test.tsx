import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase', () => ({ supabase: { rpc, from: vi.fn(), functions: { invoke: vi.fn() } } }))
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { SecretField } from './DatingMonetizationSection'

const KEY = 'sk_test_4f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c'

function renderField(saved?: { name: string; preview: string; updated_at: string }) {
  const onChanged = vi.fn()
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <SecretField name="PAYSTACK_TEST_SECRET_KEY" saved={saved} onChanged={onChanged} />
    </QueryClientProvider>,
  )
  return { onChanged }
}

describe('SecretField (payment API key)', () => {
  beforeEach(() => rpc.mockReset())

  it('shows only the masked preview for a saved key, with Replace and Remove', () => {
    renderField({ name: 'PAYSTACK_TEST_SECRET_KEY', preview: 'sk_test_xxxxxxxxxx', updated_at: new Date().toISOString() })
    expect(screen.getByText('sk_test_xxxxxxxxxx')).toBeInTheDocument()
    expect(screen.queryByLabelText('Secret key')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
  })

  it('takes a new key in a password field, saves it, and never displays it', async () => {
    rpc.mockResolvedValue({ data: 'sk_test_xxxxxxxxxx', error: null })
    const { onChanged } = renderField()
    const input = screen.getByLabelText('Secret key') as HTMLInputElement
    expect(input.type).toBe('password')
    fireEvent.change(input, { target: { value: `  ${KEY}  ` } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('admin_set_payment_secret', { _name: 'PAYSTACK_TEST_SECRET_KEY', _value: KEY }),
    )
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(input.value).toBe('')
    expect(document.body.textContent).not.toContain(KEY)
  })

  it('warns when the key does not match the usual format', () => {
    renderField()
    fireEvent.change(screen.getByLabelText('Secret key'), { target: { value: 'pk_test_publicKeyNotSecret' } })
    expect(screen.getByText(/doesn't look like the usual format/)).toBeInTheDocument()
  })
})
