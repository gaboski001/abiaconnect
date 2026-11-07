import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppErrorBoundary, isOutdatedPageError } from './AppErrorBoundary'

function Broken(): never {
  throw new Error('page failed')
}

describe('AppErrorBoundary', () => {
  it('shows a way back instead of an empty screen', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <AppErrorBoundary>
        <Broken />
      </AppErrorBoundary>,
    )
    expect(screen.getByRole('button', { name: 'Back to home' })).toBeTruthy()
    quiet.mockRestore()
  })

  it('recognises a page file removed by a site update', () => {
    expect(isOutdatedPageError(new TypeError('Failed to fetch dynamically imported module: /assets/x.js'))).toBe(true)
    expect(isOutdatedPageError(new Error('page failed'))).toBe(false)
  })
})
