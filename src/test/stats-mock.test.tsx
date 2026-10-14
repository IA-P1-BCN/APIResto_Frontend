import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { db } from '../api/mock/db'
import { mockServer } from '../api/mock/server'
import { formatPrice } from '../utils/format'
import { renderApp } from './renderApp'

vi.mock('../config', () => ({ USE_MOCK: true, API_URL: 'http://api.test' }))

function loginAs(token: string) {
  localStorage.setItem('restoapi.token', token)
}

const sold = () => db.orders.filter((o) => o.status === 'served' || o.status === 'paid')
const price = (amount: number) => formatPrice(amount).replace(/\s/g, ' ')
const totalOf = (orders: { total: string }[]) => orders.reduce((sum, o) => sum + Number(o.total), 0)

describe('Estadísticas (HU-15)', () => {
  it('con "Todo" el resumen suma los pedidos servidos y pagados', async () => {
    loginAs('mock-token-1')
    const { user } = renderApp('/estadisticas')
    expect(await screen.findByRole('button', { name: 'Últimos 7 días' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Todo' }))
    const summary = await screen.findByRole('region', { name: 'Resumen' })
    const orders = sold()
    await waitFor(() => expect(summary).toHaveTextContent(`Pedidos${orders.length}`))
    expect(summary).toHaveTextContent(`Total vendido${price(totalOf(orders))}`)
    expect(summary).toHaveTextContent(`Ticket medio${price(totalOf(orders) / orders.length)}`)
  })

  it('cada día es una columna con su valor al pasar por encima o con el foco', async () => {
    loginAs('mock-token-1')
    const { user } = renderApp('/estadisticas')
    const chart = await screen.findByRole('region', { name: 'Ventas por día' })
    const columns = await within(chart).findAllByRole('button', { name: /pedidos?$/ })
    expect(columns).toHaveLength(7)

    await user.hover(columns[0])
    expect(within(chart).getByRole('tooltip')).toBeInTheDocument()
    await user.unhover(columns[0])
    expect(within(chart).queryByRole('tooltip')).not.toBeInTheDocument()

    columns[1].focus()
    await waitFor(() => expect(within(chart).getByRole('tooltip')).toBeInTheDocument())
  })

  it('los datos del gráfico también están en una tabla', async () => {
    loginAs('mock-token-1')
    const { user } = renderApp('/estadisticas')
    const chart = await screen.findByRole('region', { name: 'Ventas por día' })
    await user.click(within(chart).getByText('Ver los datos en una tabla'))
    expect(within(chart).getAllByRole('row').length).toBeGreaterThan(1)
  })

  it('muestra los platos más vendidos de mayor a menor y deja ver 10', async () => {
    loginAs('mock-token-1')
    const { user } = renderApp('/estadisticas')
    const ranking = await screen.findByRole('region', { name: 'Platos más vendidos' })
    const items = await within(ranking).findAllByRole('listitem')
    expect(items).toHaveLength(5)
    const units = items.map((li) => Number(/(\d+) uds\./.exec(li.textContent ?? '')![1]))
    expect(units).toEqual([...units].sort((a, b) => b - a))

    await user.selectOptions(within(ranking).getByLabelText('Mostrar'), '10 platos')
    await waitFor(() => expect(within(ranking).getAllByRole('listitem').length).toBeGreaterThan(5))
  })

  it('en unas fechas sin ventas lo dice en vez de mostrar gráficos vacíos', async () => {
    loginAs('mock-token-1')
    const { user } = renderApp('/estadisticas')
    await screen.findByRole('region', { name: 'Resumen' })
    await user.clear(screen.getByLabelText('Desde'))
    await user.type(screen.getByLabelText('Desde'), '2000-01-01')
    await user.clear(screen.getByLabelText('Hasta'))
    await user.type(screen.getByLabelText('Hasta'), '2000-01-31')

    expect(await screen.findAllByText('No hay ventas en estas fechas.')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Todo' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('el servidor simulado rechaza un rango al revés, como la API', async () => {
    loginAs('mock-token-1')
    await expect(mockServer.getSales({ from: '2026-10-10', to: '2026-10-01' })).rejects.toThrow('anterior')
  })

  it('solo el admin entra en estadísticas', async () => {
    loginAs('mock-token-2')
    renderApp('/estadisticas')
    expect(await screen.findByRole('heading', { name: '403 · Sin acceso' })).toBeInTheDocument()
  })
})
