import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Reservation, User } from '../api/types'
import { toISODate } from '../utils/format'
import { mockApi } from './fakeApi'
import { renderApp } from './renderApp'

vi.mock('../config', () => ({ USE_MOCK: false, API_URL: 'http://api.test', GOOGLE_CLIENT_ID: '', GITHUB_CLIENT_ID: '' }))

const CUSTOMER: User = { id: 4, name: 'Cliente Real', email: 'cliente@restoapi.dev', role: 'customer', is_active: true }
const tomorrow = toISODate(new Date(Date.now() + 24 * 60 * 60 * 1000))

const created: Reservation = {
  id: 9,
  user_id: 4,
  table_id: 3,
  reserved_at: `${tomorrow}T20:30:00`,
  duration_min: 90,
  ends_at: `${tomorrow}T22:00:00`,
  party_size: 4,
  status: 'confirmed',
  notes: null,
  created_at: `${tomorrow}T09:00:00`,
}

function api(onCreate: () => { status: number; data?: unknown }) {
  return mockApi((config) => {
    if (config.url === '/auth/me') return { status: 200, data: CUSTOMER }
    if (config.url === '/reservations' && config.method === 'post') return onCreate()
    if (config.url === '/reservations') return { status: 200, data: { items: [], total: 0, page: 1, size: 100 } }
    return { status: 200, data: [] }
  })
}

async function book(user: ReturnType<typeof renderApp>['user']) {
  await user.click(await screen.findByRole('button', { name: '+ Nueva reserva' }))
  const form = screen.getByRole('form', { name: 'Nueva reserva' })
  fireEvent.change(within(form).getByLabelText('Fecha'), { target: { value: tomorrow } })
  fireEvent.change(within(form).getByLabelText('Hora'), { target: { value: '20:30' } })
  fireEvent.change(within(form).getByLabelText('Personas'), { target: { value: '4' } })
  await user.click(within(form).getByRole('button', { name: 'Reservar' }))
  return form
}

describe('reserva del cliente contra la API (HU-51)', () => {
  it('envía día, hora local sin zona y personas, sin table_id', async () => {
    localStorage.setItem('restoapi.token', 'jwt-cliente')
    const requests = api(() => ({ status: 201, data: created }))
    const { user } = renderApp('/reservas')

    await book(user)

    expect(await screen.findByRole('status')).toHaveTextContent('para 4 personas')
    const post = requests.find((r) => r.url === '/reservations' && r.method === 'post')!
    expect(JSON.parse(String(post.data))).toEqual({ reserved_at: `${tomorrow}T20:30:00`, party_size: 4 })
  })

  it('si la API envía el número de mesa, lo enseña en la confirmación y en la lista', async () => {
    localStorage.setItem('restoapi.token', 'jwt-cliente')
    const withNumber = { ...created, table_id: 12, table_number: 3 }
    mockApi((config) => {
      if (config.url === '/auth/me') return { status: 200, data: CUSTOMER }
      if (config.url === '/reservations' && config.method === 'post') return { status: 201, data: withNumber }
      if (config.url === '/reservations') return { status: 200, data: { items: [withNumber], total: 1, page: 1, size: 100 } }
      return { status: 200, data: [] }
    })
    const { user } = renderApp('/reservas')

    expect(await screen.findByRole('cell', { name: 'Mesa 3' })).toBeInTheDocument()
    await book(user)
    expect(await screen.findByRole('status')).toHaveTextContent('El restaurante te ha asignado la mesa 3.')
  })

  it('muestra el mensaje del backend si no hay mesa libre (409)', async () => {
    localStorage.setItem('restoapi.token', 'jwt-cliente')
    const detail = `No hay mesa libre para 4 personas el ${tomorrow.split('-').reverse().join('/')} a las 20:30`
    api(() => ({ status: 409, data: { detail, code: 'no_table_available' } }))
    const { user } = renderApp('/reservas')

    const form = await book(user)

    expect(await within(form).findByRole('alert')).toHaveTextContent(detail)
  })
})
