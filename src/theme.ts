export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'restoapi.theme'

const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark'

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isTheme(value) ? value : null
  } catch {
    return null
  }
}

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function currentTheme(): Theme {
  const applied = document.documentElement.dataset.theme
  return isTheme(applied) ? applied : (storedTheme() ?? systemTheme())
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Sin almacenamiento: el tema dura hasta recargar
  }
}
