import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SlideCard } from './SlideCard'

const banner = {
  id: 'b1',
  title: 'Abians, your digital home is open. Happy Birthday, Okechukwu Gabriel E.',
  image_url: 'https://abiaconnect.com/banners/launch-birthday-2026-desktop.webp',
  mobile_image_url: 'https://abiaconnect.com/banners/launch-birthday-2026-mobile.webp',
  full_image: true,
  cta_url: '/register',
}

describe('SlideCard full banner', () => {
  it('shows the designed image in full: wide on computers, portrait on phones, linking to sign-up', () => {
    const { container } = render(
      <MemoryRouter>
        <SlideCard slide={banner} />
      </MemoryRouter>,
    )
    const img = screen.getByRole('img', { name: banner.title })
    expect(img).toHaveAttribute('src', banner.image_url)
    expect(img.className).not.toMatch(/opacity-20/)
    const source = container.querySelector('source')
    expect(source).toHaveAttribute('media', '(max-width: 767px)')
    expect(source).toHaveAttribute('srcset', banner.mobile_image_url)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/register')
    expect(screen.queryByText('Advertisement')).not.toBeInTheDocument()
  })

  it('keeps ordinary text slides unchanged', () => {
    render(
      <MemoryRouter>
        <SlideCard slide={{ title: 'Community meetup', image_url: 'https://x.test/bg.jpg' }} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Community meetup')).toBeInTheDocument()
    expect(screen.getByText('Advertisement')).toBeInTheDocument()
  })
})
