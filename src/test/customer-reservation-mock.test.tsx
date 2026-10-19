import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { db } from '../api/mock/db'
import { mockServer } from '../api/mock/server'
import { CUSTOMER_PARTY_TOO_LARGE, RESERVATION_IN_PAST } from '../api/reservationRules'
import { toISODate } from '../utils/format'
import { renderApp } from './renderApp'

vi.mock('../config', () => ({ USE_MOCK: true, API_URL: 'http://api.test', GOOGLE_CLIENT_ID: '', GITHUB_CLIENT_ID: '' }))

const CUSTOMER_TOKEN = 'mock-token-4'
const tomorrow = () => toISODate(new Date(Date.now() + 24 * 60 * 60 * 1000))

async function openForm(user: ReturnType<typeof renderApp>['user']) {
  await user.click(await screen.findByRole('button', { name: '+ Nueva reserva' }))
  return screen.getByRole('form', { name: 'Nueva reserva' })
}

function fill(form: HTMLElement, { date = tomorrow(), time = '20:00', people = '2' } = {}) {
  fireEvent.change(within(form).getByLabelText('Fecha'), { target: { value: date } })
  fireEvent.change(within(form).getByLabelText('Hora'), { target: { value: time } })
  fireEvent.change(within(form).getByLabelText('Personas'), { target: { value: people } })
}

describe('el cliente reserva sin elegir mesa (HU-51, modo simulado)', () => {
  it('crea la reserva, el restaurante asigna la mesa más ajustada y aparece en Mis reservas', async () => {
    localStorage.setItem('restoapi.token', CUSTOMER_TOKEN)
    const { user } = renderApp('/reservas')
    expect(await screen.findByText('Cumpleaños, traen tarta')).toBeInTheDocument()
    const form = await openForm(user)

    fill(form)
    await user.type(within(form).getByLabelText('Notas (opcional)'), 'Cerca de la ventana')
    await user.click(within(form).getByRole('button', { name: 'Reservar' }))

    expect(await screen.findByRole('status')).toHaveTextContent('El restaurante te ha asignado una mesa')
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(4))
    const created = db.reservations.at(-1)!
    expect(created).toMatchObject({ user_id: 4, party_size: 2, notes: 'Cerca de la ventana' })
    expect(db.tables.find((t) => t.id === created.table_id)!.capacity).toBe(2)
  })

  it('sin el número de mesa no enseña el id interno: dice que la asigna el restaurante', async () => {
    localStorage.setItem('restoapi.token', CUSTOMER_TOKEN)
    renderApp('/reservas')
    expect(await screen.findByText('Cumpleaños, traen tarta')).toBeInTheDocument()
    expect(screen.getAllByText('Asignada por el restaurante').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Mesa \(id/)).not.toBeInTheDocument()
  })

  it('con más de 8 personas avisa de que llame al restaurante y no deja reservar', async () => {
    localStorage.setItem('restoapi.token', CUSTOMER_TOKEN)
    const { user } = renderApp('/reservas')
    const form = await openForm(user)

    fill(form, { people: '9' })

    expect(within(form).getByRole('alert')).toHaveTextContent(CUSTOMER_PARTY_TOO_LARGE)
    expect(within(form).getByRole('button', { name: 'Reservar' })).toBeDisabled()
  })

  it('si no hay mesa libre para el grupo, lo dice', async () => {
    localStorage.setItem('restoapi.token', CUSTOMER_TOKEN)
    const { user } = renderApp('/reservas')
    const form = await openForm(user)

    fill(form, { people: '7' })
    await user.click(within(form).getByRole('button', { name: 'Reservar' }))

    expect(await within(form).findByRole('alert')).toHaveTextContent('No hay mesa libre para 7 personas')
  })

  it('no deja reservar en una hora que ya ha pasado', async () => {
    localStorage.setItem('restoapi.token', CUSTOMER_TOKEN)
    const { user } = renderApp('/reservas')
    const form = await openForm(user)

    fill(form, { date: toISODate(new Date()), time: '00:00' })
    await user.click(within(form).getByRole('button', { name: 'Reservar' }))

    expect(within(form).getByRole('alert')).toHaveTextContent(RESERVATION_IN_PAST)
  })
})

describe('reglas de la reserva del cliente en el servidor simulado (como la API, HU-51)', () => {
  it('sin mesa, asigna la libre más pequeña con sitio', async () => {
    localStorage.setItem('restoapi.token', CUSTOMER_TOKEN)
    const reservation = await mockServer.createReservation({ reserved_at: `${tomorrow()}T20:00:00`, party_size: 3 })
    expect(db.tables.find((t) => t.id === reservation.table_id)!.capacity).toBe(4)
  })

  it('un cliente no puede reservar para más de 8', async () => {
    localStorage.setItem('restoapi.token', CUSTOMER_TOKEN)
    await expect(mockServer.createReservation({ reserved_at: `${tomorrow()}T20:00:00`, party_size: 9 })).rejects.toThrow(
      CUSTOMER_PARTY_TOO_LARGE,
    )
  })

  it('al personal no se le aplica el límite de 8: solo la capacidad de la mesa', async () => {
    localStorage.setItem('restoapi.token', 'mock-token-2')
    await expect(
      mockServer.createReservation({ table_id: 5, reserved_at: `${tomorrow()}T20:00:00`, party_size: 9 }),
    ).rejects.toThrow('La mesa 5 es para 6 personas como máximo')
  })
})
