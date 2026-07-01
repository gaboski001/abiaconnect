import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const categoriesFixture = [
  { id: 'gen-id', name: 'General Discussion', slug: 'general-discussion', description: null, icon: '💬', color: null, thread_count: 0, is_popular: false, is_active: true, display_order: 1 },
  { id: 'rel-id', name: 'Relationship', slug: 'relationship', description: null, icon: '💚', color: null, thread_count: 0, is_popular: true, is_active: true, display_order: 2 },
  { id: 'biz-id', name: 'Business & Commerce', slug: 'business-commerce', description: null, icon: '💼', color: null, thread_count: 0, is_popular: false, is_active: true, display_order: 3 },
]

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: categoriesFixture, error: null }),
        }),
      }),
    }),
  },
}))

import { CategoryList } from './CategoryList'

function renderList() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <CategoryList />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CategoryList', () => {
  it('renders Relationship immediately after General Discussion and links to /relationship', async () => {
    renderList()

    await waitFor(() => {
      expect(screen.getByText('General Discussion')).toBeInTheDocument()
      expect(screen.getByText('Relationship')).toBeInTheDocument()
    })

    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    const generalIdx = headings.indexOf('General Discussion')
    const relIdx = headings.indexOf('Relationship')
    expect(generalIdx).toBeGreaterThanOrEqual(0)
    expect(relIdx).toBe(generalIdx + 1)

    const relCard = screen.getByText('Relationship').closest('a')
    expect(relCard).not.toBeNull()
    expect(relCard).toHaveAttribute('href', '/relationship')

    const generalCard = screen.getByText('General Discussion').closest('a')
    expect(generalCard).toHaveAttribute('href', '/category/gen-id')
  })
})
