import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { mockServer } from '../api/mock/server'
import { toISODate } from '../utils/format'
import { answerConfirm } from './confirmDialog'
import { renderApp } from './renderApp'

vi.mock('../config', () => ({ USE_MOCK: true, API_URL: 'http://api.test' }))

const TOKEN = { admin: 'mock-token-1', waiter: 'mock-token-2', customer: 'mock-token-4' }
const tomorrow = () => toISODate(new Date(Date.now() + 24 * 60 * 60 * 1000))

function loginAs(role: keyof typeof TOKEN) {
  localStorage.setItem('restoapi.token', TOKEN[role])
}

describe('Carta', () => {
  it('muestra toda la carta separada por categorías, en orden', async () => {
    loginAs('customer')
    renderApp('/carta')
    expect(await screen.findByText('16 platos')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Entrantes (5)',
      'Principales (5)',
      'Postres (3)',
      'Bebidas (3)',
    ])
    const postres = screen.getByRole('region', { name: 'Postres (3)' })
    expect(within(postres).getByText('Tarta de queso')).toBeInTheDocument()
    expect(within(postres).queryByText('Croquetas de jamón')).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Bebidas (3)' })).getByText('Café')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument()
  })

  it('cada sección se puede plegar y desplegar', async () => {
    loginAs('customer')
    const { user } = renderApp('/carta')
    const entrantes = await screen.findByRole('button', { name: 'Entrantes (5)' })
    expect(entrantes).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Croquetas de jamón')).toBeInTheDocument()

    await user.click(entrantes)
    expect(entrantes).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Croquetas de jamón')).not.toBeInTheDocument()
    expect(screen.getByText('Tarta de queso')).toBeInTheDocument()

    entrantes.focus()
    await user.keyboard('{Enter}')
    expect(entrantes).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Croquetas de jamón')).toBeInTheDocument()
  })

  it('filtra por categoría y solo muestra esa sección', async () => {
    loginAs('waiter')
    const { user } = renderApp('/carta')
    await screen.findByRole('option', { name: 'Postres' })
    await user.selectOptions(screen.getByLabelText('Categoría'), 'Postres')
    expect(await screen.findByText('3 platos')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Postres (3)'])
    expect(screen.getByText('Tarta de queso')).toBeInTheDocument()
    expect(screen.queryByText('Croquetas de jamón')).not.toBeInTheDocument()
  })

  it('filtra solo los disponibles y por precio máximo', async () => {
    loginAs('waiter')
    const { user } = renderApp('/carta')
    expect(await screen.findByText('Gazpacho')).toBeInTheDocument()
    expect(screen.getAllByText('No disponible')).toHaveLength(2)

    await user.click(screen.getByLabelText('Solo disponibles'))
    expect(await screen.findByText('14 platos')).toBeInTheDocument()
    expect(screen.queryByText('Gazpacho')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Precio máximo (€)'), '6')
    expect(await screen.findByText('6 platos')).toBeInTheDocument()
  })

  it('muestra los alérgenos de cada plato', async () => {
    loginAs('customer')
    renderApp('/carta')
    const croquetas = (await screen.findByText('Croquetas de jamón')).closest('li')!
    expect(within(croquetas).getByText('gluten')).toBeInTheDocument()
    expect(within(croquetas).getByText('lácteos')).toBeInTheDocument()
  })
})

describe('Mesas', () => {
  it('muestra la sala por zonas con el resumen de estados', async () => {
    loginAs('waiter')
    renderApp('/mesas')
    expect(await screen.findByRole('heading', { name: 'Terraza' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Interior' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Barra' })).toBeInTheDocument()
    expect(screen.getByText('Libre: 5')).toBeInTheDocument()
    expect(screen.getByText('Ocupada: 3')).toBeInTheDocument()
  })

  it('el camarero cambia el estado de una mesa', async () => {
    loginAs('waiter')
    const { user } = renderApp('/mesas')
    const select = await screen.findByLabelText('Estado de la mesa 1')
    await user.selectOptions(select, 'occupied')

    expect(await screen.findByText('Ocupada: 4')).toBeInTheDocument()
    expect(screen.getByText('Libre: 4')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Estado de la mesa 1')).toHaveValue('occupied'))
  })

  it('el cliente no puede ver las mesas', async () => {
    loginAs('customer')
    renderApp('/mesas')
    expect(await screen.findByRole('heading', { name: '403 · Sin acceso' })).toBeInTheDocument()
  })
})

describe('Reservas', () => {
  it('el personal ve las reservas del día', async () => {
    loginAs('waiter')
    renderApp('/reservas')
    expect(await screen.findByText('Cumpleaños, traen tarta')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(5)
    expect(screen.queryByText('Mesa tranquila si es posible')).not.toBeInTheDocument()
  })

  it('crea una reserva eligiendo entre las mesas disponibles', async () => {
    loginAs('waiter')
    const { user } = renderApp('/reservas')
    await screen.findByText('Cumpleaños, traen tarta')

    await user.click(screen.getByRole('button', { name: '+ Nueva reserva' }))
    const form = screen.getByRole('form', { name: 'Nueva reserva' })
    fireEvent.change(within(form).getByLabelText('Fecha'), { target: { value: tomorrow() } })
    fireEvent.change(within(form).getByLabelText('Hora'), { target: { value: '13:00' } })
    fireEvent.change(within(form).getByLabelText('Personas'), { target: { value: '4' } })
    await user.click(within(form).getByRole('button', { name: 'Ver mesas disponibles' }))

    const table = await within(form).findByLabelText('Mesa')
    const options = within(table).getAllByRole('option').map((o) => o.textContent)
    expect(options[0]).toBe('Mesa 3 · Interior · hasta 4 personas')
    expect(options.some((o) => o?.startsWith('Mesa 8'))).toBe(false)
    expect(options.some((o) => o?.startsWith('Mesa 1 '))).toBe(false)

    await user.type(within(form).getByLabelText('Notas (opcional)'), 'Comida de empresa')
    await user.click(within(form).getByRole('button', { name: 'Confirmar reserva' }))

    expect(await screen.findByRole('status')).toHaveTextContent('a las 13:00, mesa 3')
    expect(await screen.findByText('Comida de empresa')).toBeInTheDocument()
  })

  it('el número de personas se puede borrar y reescribir con el teclado', async () => {
    loginAs('waiter')
    const { user } = renderApp('/reservas')
    await user.click(await screen.findByRole('button', { name: '+ Nueva reserva' }))
    const form = screen.getByRole('form', { name: 'Nueva reserva' })
    fireEvent.change(within(form).getByLabelText('Fecha'), { target: { value: tomorrow() } })
    fireEvent.change(within(form).getByLabelText('Hora'), { target: { value: '13:00' } })

    const partySize = within(form).getByLabelText('Personas')
    await user.clear(partySize)
    await user.type(partySize, '4')
    expect(partySize).toHaveValue(4)

    await user.click(within(form).getByRole('button', { name: 'Ver mesas disponibles' }))
    const table = await within(form).findByLabelText('Mesa')
    expect(within(table).getAllByRole('option')[0]).toHaveTextContent('hasta 4 personas')
  })

  it('no deja reservar hoy a una hora que ya ha pasado', async () => {
    loginAs('waiter')
    const { user } = renderApp('/reservas')
    await user.click(await screen.findByRole('button', { name: '+ Nueva reserva' }))
    const form = screen.getByRole('form', { name: 'Nueva reserva' })
    expect(within(form).getByLabelText('Fecha')).toHaveAttribute('min', toISODate(new Date()))
    fireEvent.change(within(form).getByLabelText('Hora'), { target: { value: '00:00' } })
    await user.click(within(form).getByRole('button', { name: 'Ver mesas disponibles' }))
    expect(await within(form).findByRole('alert')).toHaveTextContent('No se puede reservar en una fecha u hora pasada')
  })

  it('cancela una reserva confirmada', async () => {
    loginAs('waiter')
    const { user } = renderApp('/reservas')
    await user.click(await screen.findByRole('button', { name: 'Cancelar reserva de las 13:30' }))
    await answerConfirm(user, 'Cancelar reserva')

    expect(await screen.findByRole('status')).toHaveTextContent('cancelada')
    await waitFor(() => expect(screen.getAllByText('Cancelada')).toHaveLength(2))
    expect(screen.queryByRole('button', { name: 'Cancelar reserva de las 13:30' })).not.toBeInTheDocument()
  })

  it('el cliente solo ve sus reservas y no puede buscar mesas', async () => {
    loginAs('customer')
    const { user } = renderApp('/reservas')
    expect(await screen.findByRole('heading', { name: 'Mis reservas' })).toBeInTheDocument()
    expect(await screen.findByText('Cumpleaños, traen tarta')).toBeInTheDocument()
    expect(screen.queryByText('Mesa tranquila si es posible')).not.toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(3)
    expect(screen.queryByLabelText('Fecha')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '+ Nueva reserva' }))
    expect(screen.queryByRole('button', { name: 'Ver mesas disponibles' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Mesa')).not.toBeInTheDocument()
  })
})

describe('reglas de reserva del servidor simulado (como la API, HU-10)', () => {
  it('rechaza una reserva que se solapa en la misma mesa', async () => {
    loginAs('waiter')
    await expect(
      mockServer.createReservation({ table_id: 7, reserved_at: `${tomorrow()}T20:00:00`, party_size: 2 }),
    ).rejects.toThrow('La mesa 7 ya tiene una reserva en ese horario')
  })

  it('rechaza más personas que la capacidad de la mesa', async () => {
    loginAs('waiter')
    await expect(
      mockServer.createReservation({ table_id: 1, reserved_at: `${tomorrow()}T21:00:00`, party_size: 4 }),
    ).rejects.toThrow('La mesa 1 es para 2 personas como máximo')
  })

  it('acepta una reserva justo cuando termina la anterior', async () => {
    loginAs('waiter')
    const reservation = await mockServer.createReservation({
      table_id: 7,
      reserved_at: `${tomorrow()}T22:00:00`,
      party_size: 2,
    })
    expect(reservation.status).toBe('confirmed')
    expect(reservation.ends_at).toBe(`${tomorrow()}T23:30:00`)
  })

  it('las mesas disponibles son solo para admin y waiter', async () => {
    loginAs('customer')
    await expect(mockServer.listAvailableTables(`${tomorrow()}T21:00:00`, 2)).rejects.toThrow('No tienes permiso')
  })
})
