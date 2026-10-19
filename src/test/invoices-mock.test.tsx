import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { db } from '../api/mock/db'
import { mockServer } from '../api/mock/server'
import { updateOrderStatus } from '../api/orders'
import { answerConfirm } from './confirmDialog'
import { renderApp } from './renderApp'

vi.mock('../config', () => ({ USE_MOCK: true, API_URL: 'http://api.test' }))

const TOKEN = { admin: 'mock-token-1', waiter: 'mock-token-2', kitchen: 'mock-token-3' }

function loginAs(role: keyof typeof TOKEN) {
  localStorage.setItem('restoapi.token', TOKEN[role])
}

function nextInvoiceNumber() {
  const year = new Date().getUTCFullYear()
  const issued = db.invoices.filter((i) => i.number.startsWith(`F-${year}-`)).length
  return `F-${year}-${String(issued + 1).padStart(5, '0')}`
}

describe('Facturas (HU-14)', () => {
  it('la demo empieza con una factura por cada pedido pagado', () => {
    const paid = db.orders.filter((o) => o.status === 'paid').map((o) => o.id)
    expect(paid.length).toBeGreaterThan(0)
    expect(db.invoices.map((i) => i.order_id).sort()).toEqual(paid.sort())
    expect(new Set(db.invoices.map((i) => i.number)).size).toBe(db.invoices.length)
  })

  it('el camarero factura un pedido servido tras confirmarlo y la ve en la lista', async () => {
    loginAs('waiter')
    const number = nextInvoiceNumber()
    const { user } = renderApp('/facturas')
    const pending = await screen.findByRole('region', { name: 'Pedidos por facturar' })
    await user.click(await within(pending).findByRole('button', { name: 'Generar factura del pedido 3' }))
    await answerConfirm(user, 'Generar factura')

    expect(await screen.findByRole('status')).toHaveTextContent(`Factura ${number} generada para el pedido #3`)
    expect(await within(pending).findByText('No hay pedidos pendientes de facturar.')).toBeInTheDocument()
    const issued = screen.getByRole('region', { name: 'Facturas emitidas' })
    expect(await within(issued).findByText(number)).toBeInTheDocument()
    expect(within(issued).getAllByRole('row')[1]).toHaveTextContent(number)
    expect(db.invoices.find((i) => i.order_id === 3)).toMatchObject({
      number,
      total: '12.10',
      base_amount: '11.00',
      tax_amount: '1.10',
    })
  })

  it('si no se confirma, no se genera la factura', async () => {
    loginAs('waiter')
    const before = db.invoices.length
    const { user } = renderApp('/facturas')
    await user.click(await screen.findByRole('button', { name: 'Generar factura del pedido 3' }))
    await answerConfirm(user, 'Volver')
    expect(db.invoices).toHaveLength(before)
  })

  it('un pedido cobrado sin factura sale en "Pedidos por facturar" y se puede facturar', async () => {
    loginAs('waiter')
    db.orders.find((o) => o.id === 3)!.status = 'paid'
    const number = nextInvoiceNumber()
    const { user } = renderApp('/facturas')
    const pending = await screen.findByRole('region', { name: 'Pedidos por facturar' })
    expect(await within(pending).findByText('· ya cobrado')).toBeInTheDocument()
    await user.click(within(pending).getByRole('button', { name: 'Generar factura del pedido 3' }))
    await answerConfirm(user, 'Generar factura')

    expect(await screen.findByRole('status')).toHaveTextContent(`Factura ${number} generada para el pedido #3`)
    expect(db.orders.find((o) => o.id === 3)!.status).toBe('paid')
  })

  it('cobrar un pedido servido lo factura antes de marcarlo pagado', async () => {
    loginAs('waiter')
    const number = nextInvoiceNumber()
    expect(await updateOrderStatus(3, 'paid')).toMatchObject({ id: 3, status: 'paid' })
    expect(db.invoices.find((i) => i.order_id === 3)).toMatchObject({ number })
  })

  it('cobrar un pedido ya facturado no genera otra factura', async () => {
    loginAs('waiter')
    await mockServer.createInvoice(3)
    const before = db.invoices.length
    expect(await updateOrderStatus(3, 'paid')).toMatchObject({ status: 'paid' })
    expect(db.invoices).toHaveLength(before)
  })

  it('filtra las facturas por fecha', async () => {
    loginAs('waiter')
    const { number } = await mockServer.createInvoice(3)
    const { user } = renderApp('/facturas')
    const issued = await screen.findByRole('region', { name: 'Facturas emitidas' })
    expect(await within(issued).findByText(number)).toBeInTheDocument()

    await user.type(within(issued).getByLabelText('Desde'), '2000-01-01')
    await user.type(within(issued).getByLabelText('Hasta'), '2000-01-31')
    expect(await within(issued).findByText('No hay facturas en estas fechas.')).toBeInTheDocument()
  })

  it('solo el admin ve el botón de exportar y descarga el CSV', async () => {
    loginAs('admin')
    await mockServer.createInvoice(3)
    const createObjectURL = vi.fn(() => 'blob:facturas')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const { user } = renderApp('/facturas')
    await user.click(await screen.findByRole('button', { name: 'Exportar CSV' }))
    await waitFor(() => expect(click).toHaveBeenCalled())
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0]
    const csv = await blob.text()
    expect(csv).toMatch(/^Número;Fecha;Pedido;Mesa;Base;Tipo de IVA;IVA;Total\r\n/)
    expect(csv).toMatch(/^F-\d{4}-\d{5};\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2};3;10;11,00;0,10;1,10;12,10\r$/m)
    vi.unstubAllGlobals()
  })

  it('el camarero no ve el botón de exportar', async () => {
    loginAs('waiter')
    renderApp('/facturas')
    await screen.findByRole('region', { name: 'Facturas emitidas' })
    expect(screen.queryByRole('button', { name: 'Exportar CSV' })).not.toBeInTheDocument()
  })

  it('no factura pedidos que no están servidos ni dos veces el mismo', async () => {
    loginAs('waiter')
    await expect(mockServer.createInvoice(2)).rejects.toThrow('Solo se pueden facturar pedidos servidos')
    await mockServer.createInvoice(3)
    await expect(mockServer.createInvoice(3)).rejects.toThrow('ya tiene la factura')
  })

  it('cocina no puede entrar en facturas', async () => {
    loginAs('kitchen')
    renderApp('/facturas')
    expect(await screen.findByRole('heading', { name: '403 · Sin acceso' })).toBeInTheDocument()
  })
})
