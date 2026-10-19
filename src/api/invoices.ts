import { USE_MOCK } from '../config'
import { api } from './client'
import { mockServer, type InvoiceFilters } from './mock/server'
import { listOrders } from './orders'
import { toExcelCsv } from '../utils/excelCsv'
import type { Invoice, Order, Page } from './types'

export type { InvoiceFilters }

const EXCEL_HEADERS: Record<string, string> = {
  number: 'Número',
  issued_at: 'Fecha',
  order_id: 'Pedido',
  table_id: 'Mesa',
  base_amount: 'Base',
  tax_rate: 'Tipo de IVA',
  tax_amount: 'IVA',
  total: 'Total',
}

export const INVOICES_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

export interface CsvFile {
  content: Blob
  filename: string
}

export async function listInvoices(filters: InvoiceFilters = {}): Promise<Page<Invoice>> {
  const query = { page: 1, size: INVOICES_PAGE_SIZE, ...filters }
  if (USE_MOCK) return mockServer.listInvoices(query)
  const { data } = await api.get<Page<Invoice>>('/invoices', { params: query })
  return data
}

async function listAllInvoices(): Promise<Invoice[]> {
  const invoices: Invoice[] = []
  for (let page = 1; ; page++) {
    const result = await listInvoices({ page, size: MAX_PAGE_SIZE })
    invoices.push(...result.items)
    if (result.items.length === 0 || invoices.length >= result.total) return invoices
  }
}

export async function listOrdersToInvoice(): Promise<Order[]> {
  const [orders, invoices] = await Promise.all([listOrders({ statuses: ['served', 'paid'] }), listAllInvoices()])
  const invoiced = new Set(invoices.map((i) => i.order_id))
  return orders.filter((o) => !invoiced.has(o.id))
}

export async function createInvoice(orderId: number): Promise<Invoice> {
  if (USE_MOCK) return mockServer.createInvoice(orderId)
  const { data } = await api.post<Invoice>(`/orders/${orderId}/invoice`)
  return data
}

function filenameFrom(disposition: unknown, fallback: string): string {
  const match = typeof disposition === 'string' ? /filename="?([^";]+)"?/.exec(disposition) : null
  return match?.[1] ?? fallback
}

function excelFile(csv: string, filename: string): CsvFile {
  return { content: new Blob([toExcelCsv(csv, EXCEL_HEADERS)], { type: 'text/csv;charset=utf-8' }), filename }
}

export async function exportInvoicesCsv(filters: Pick<InvoiceFilters, 'date_from' | 'date_to'> = {}): Promise<CsvFile> {
  if (USE_MOCK) return excelFile(await mockServer.exportInvoicesCsv(filters), 'invoices.csv')
  const response = await api.get<string>('/exports/invoices', { params: filters, responseType: 'text' })
  return excelFile(response.data, filenameFrom(response.headers['content-disposition'], 'invoices.csv'))
}
