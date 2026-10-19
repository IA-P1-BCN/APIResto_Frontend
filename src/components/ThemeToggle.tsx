import { useState } from 'react'
import { currentTheme, setTheme } from '../theme'

export default function ThemeToggle() {
  const [theme, setThemeState] = useState(currentTheme)
  const next = theme === 'dark' ? 'light' : 'dark'
  const label = next === 'dark' ? 'Activar modo oscuro' : 'Activar modo claro'

  function toggle() {
    setTheme(next)
    setThemeState(next)
  }

  return (
    <button type="button" className="btn btn-secondary theme-toggle" onClick={toggle} aria-label={label} title={label}>
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
