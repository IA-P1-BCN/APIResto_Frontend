import { describe, expect, it, vi } from 'vitest'

describe('modo demo elegido en el navegador', () => {
  it('activa el modo simulado aunque el despliegue use la API', async () => {
    localStorage.setItem('restoapi.demo', '1')
    vi.resetModules()
    const { USE_MOCK } = await import('../config')
    expect(USE_MOCK).toBe(true)
  })
})
