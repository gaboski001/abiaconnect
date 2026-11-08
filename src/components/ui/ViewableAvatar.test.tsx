import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

vi.mock('@/hooks/useSignedUrl', () => ({ useSignedUrl: (p: string | null) => (p ? `https://cdn.example.com/${p}` : null) }))

import { ViewableAvatar } from './ViewableAvatar'

describe('ViewableAvatar', () => {
  it('opens the profile picture full size when tapped', () => {
    render(<ViewableAvatar avatarUrl="ada.jpg" displayName="Ada Obi" size="xl" />)
    fireEvent.click(screen.getByRole('button', { name: "View Ada Obi's profile picture" }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: "Ada Obi's profile picture" })).toHaveAttribute('src', 'https://cdn.example.com/ada.jpg')
    fireEvent.click(screen.getByRole('button', { name: 'Close picture' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('has nothing to open when the member has no photo', () => {
    render(<ViewableAvatar avatarUrl={null} displayName="Ada Obi" />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
