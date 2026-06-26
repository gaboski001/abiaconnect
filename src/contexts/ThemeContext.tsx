import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark'
const KEY = 'abiaconnect-theme'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light'
    return (localStorage.getItem(KEY) as Theme) || 'light'
  })

  useEffect(() => {
    const root = document.documentElement
    const metaThemeColor = document.querySelector('meta[name="theme-color"]')

    if (theme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
      if (metaThemeColor) metaThemeColor.setAttribute('content', '#1B3D1B')
    } else {
      root.classList.add('light')
      root.classList.remove('dark')
      if (metaThemeColor) metaThemeColor.setAttribute('content', '#1B3D1B')
    }
    localStorage.setItem(KEY, theme)
  }, [theme])

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme: setThemeState,
        toggleTheme: () => setThemeState((t) => (t === 'light' ? 'dark' : 'light')),
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
