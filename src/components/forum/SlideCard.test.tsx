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
  it('shows the wide designed image in full on every screen, in a short strip on phones, linking to sign-up', () => {
    const { container } = render(
      <MemoryRouter>
        <SlideCard slide={banner} />
      </MemoryRouter>,
    )
    const img = screen.getByRole('img', { name: banner.title })
    expect(img).toHaveAttribute('src', banner.image_url)
    expect(img.className).not.toMatch(/opacity-20/)
    expect(container.querySelector('source')).toBeNull()
    expect(img.parentElement?.className).toMatch(/max-sm:h-\[172px\]/)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/register')
    expect(screen.queryByText('Advertisement')).not.toBeInTheDocument()
  })

  it('keeps ordinary text slides as live text, with their picture clearly visible behind it', () => {
    const { container } = render(
      <MemoryRouter>
        <SlideCard slide={{ title: 'Community meetup', image_url: 'https://x.test/bg.jpg' }} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Community meetup')).toBeInTheDocument()
    expect(screen.getByText('Advertisement')).toBeInTheDocument()
    const img = container.querySelector('img')!
    expect(img).toHaveAttribute('src', 'https://x.test/bg.jpg')
    expect(img).toHaveAttribute('alt', '') // decoration: screen readers read the words, not the picture
    expect(img.className).toMatch(/opacity-80/)
  })

  it('shows a slide without a picture on its plain colours', () => {
    const { container } = render(
      <MemoryRouter>
        <SlideCard slide={{ title: 'No picture' }} />
      </MemoryRouter>,
    )
    expect(container.querySelector('img')).toBeNull()
  })
})
