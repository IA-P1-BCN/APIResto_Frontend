import { describe, expect, it, vi } from 'vitest'
import { DEMO_DB_KEY } from '../api/demo'

async function freshMock() {
  vi.resetModules()
  const { mockServer } = await import('../api/mock/server')
  const { db } = await import('../api/mock/db')
  return { mockServer, db }
}

describe('la demo guarda los datos en el navegador', () => {
  it('guarda después de cada cambio y los recupera al volver a entrar', async () => {
    localStorage.setItem('restoapi.demo', '1')
    localStorage.setItem('restoapi.token', 'mock-token-1')
    const first = await freshMock()

    await first.mockServer.createCategory({ name: 'Vermut', sort_order: 9, station: 'bar' })

    expect(localStorage.getItem(DEMO_DB_KEY)).toContain('Vermut')
    const second = await freshMock()
    expect(second.db.categories.map((c) => c.name)).toContain('Vermut')
  })

  it('en el modo simulado de desarrollo (sin elegir la demo) no guarda nada', async () => {
    localStorage.setItem('restoapi.token', 'mock-token-1')
    const { mockServer } = await freshMock()

    await mockServer.createCategory({ name: 'Vermut', sort_order: 9, station: 'bar' })

    expect(localStorage.getItem(DEMO_DB_KEY)).toBeNull()
  })

  it('ignora unos datos guardados con otra versión o rotos', async () => {
    localStorage.setItem('restoapi.demo', '1')
    localStorage.setItem(DEMO_DB_KEY, JSON.stringify({ version: 0, db: { categories: [] } }))
    expect((await freshMock()).db.categories.length).toBeGreaterThan(0)

    localStorage.setItem(DEMO_DB_KEY, '{roto')
    expect((await freshMock()).db.categories.length).toBeGreaterThan(0)
  })
})
