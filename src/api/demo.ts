import { tokenStorage } from './tokenStorage'

const KEY = 'restoapi.demo'
const LOGIN_PATH = '/login'

export const DEMO_DB_KEY = 'restoapi.demo.db'

export const demoNavigation = {
  restart(): void {
    window.location.assign(LOGIN_PATH)
  },
}

export function isDemoChosen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function startDemo(): void {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // Sin almacenamiento la demo no se puede recordar
  }
  tokenStorage.clear()
  demoNavigation.restart()
}

export function exitDemo(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nada que limpiar
  }
  tokenStorage.clear()
  demoNavigation.restart()
}

export function resetDemo(): void {
  try {
    localStorage.removeItem(DEMO_DB_KEY)
  } catch {
    // Nada que limpiar
  }
  tokenStorage.clear()
  demoNavigation.restart()
}
