import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { CollapsibleCard } from './CollapsibleCard'

const card = (version: string) => (
  <CollapsibleCard name="poll" version={version} title="Have your say" action={<a href="/polls">All polls</a>}>
    <p>Which market first?</p>
  </CollapsibleCard>
)

describe('CollapsibleCard', () => {
  beforeEach(() => localStorage.clear())

  it('starts open and folds down to its title and link', () => {
    render(card('p1'))
    expect(screen.getByText('Which market first?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Have your say/ }))
    expect(screen.queryByText('Which market first?')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Have your say/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('link', { name: 'All polls' })).toBeInTheDocument()
  })

  it('stays folded on the next visit', () => {
    const first = render(card('p1'))
    fireEvent.click(screen.getByRole('button', { name: /Have your say/ }))
    first.unmount()
    render(card('p1'))
    expect(screen.queryByText('Which market first?')).not.toBeInTheDocument()
  })

  it('opens by itself for something new, such as a new poll', () => {
    const { rerender } = render(card('p1'))
    fireEvent.click(screen.getByRole('button', { name: /Have your say/ }))
    rerender(card('p2'))
    expect(screen.getByText('Which market first?')).toBeInTheDocument()
  })
})
