import { useCallback, useState } from 'react'
import { getErrorMessage } from '../api/errors'
import { createInvoice, exportInvoicesCsv, INVOICES_PAGE_SIZE, listInvoices, listOrdersToInvoice } from '../api/invoices'
import type { Order } from '../api/types'
import ErrorMessage from '../components/ErrorMessage'
import Pagination from '../components/Pagination'
import { useAuth } from '../context/useAuth'
import { useConfirm } from '../context/useConfirm'
import { tableLabel, useTableNumbers } from '../hooks/useLookups'
import { useQuery } from '../hooks/useQuery'
import { downloadFile } from '../utils/download'
import { formatDate, formatPrice, formatTime, parseServerTimestamp } from '../utils/format'

function issuedLabel(value: string): string {
  const date = parseServerTimestamp(value)
  return `${formatDate(date)} · ${formatTime(date)}`
}

export default function InvoicesPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [invoicingId, setInvoicingId] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)

  const filters = { date_from: dateFrom || undefined, date_to: dateTo || undefined }
  const fetchInvoices = useCallback(
    () => listInvoices({ date_from: dateFrom || undefined, date_to: dateTo || undefined, page, size: INVOICES_PAGE_SIZE }),
    [dateFrom, dateTo, page],
  )
  const invoices = useQuery(fetchInvoices)
  const toInvoice = useQuery(listOrdersToInvoice)
  const tableNumbers = useTableNumbers(true)

  async function handleCreate(order: Order) {
    const confirmed = await confirm({
      title: `¿Generar la factura del pedido #${order.id}?`,
      message: `${tableLabel(order.table_id, tableNumbers)} · ${formatPrice(order.total)} con IVA incluido. El número de factura no se puede cambiar.`,
      confirmLabel: 'Generar factura',
    })
    if (!confirmed) return
    setInvoicingId(order.id)
    setActionError(null)
    setNotice(null)
    try {
      const invoice = await createInvoice(order.id)
      setNotice(`Factura ${invoice.number} generada para el pedido #${order.id} (${formatPrice(invoice.total)}).`)
      toInvoice.reload()
      setPage(1)
      invoices.reload()
    } catch (error) {
      setActionError(getErrorMessage(error))
    } finally {
      setInvoicingId(null)
    }
  }

  async function handleExport() {
    setExporting(true)
    setActionError(null)
    try {
      downloadFile(await exportInvoicesCsv(filters))
    } catch (error) {
      setActionError(getErrorMessage(error))
    } finally {
      setExporting(false)
    }
  }

  const pending = toInvoice.data ?? []

  return (
    <>
      <h1>Facturas</h1>
      <p className="muted">Facturas de los pedidos servidos, con el 10 % de IVA incluido</p>

      {notice && (
        <div className="banner banner-success" role="status">
          {notice}
        </div>
      )}
      {actionError && <ErrorMessage message={actionError} />}

      <section aria-label="Pedidos por facturar">
        <h2>
          Pedidos por facturar {toInvoice.data && <span className="badge">{pending.length}</span>}
        </h2>
        {toInvoice.error && <ErrorMessage message={toInvoice.error} onRetry={toInvoice.reload} />}
        {toInvoice.loading && !toInvoice.data && <p className="page-message">Cargando pedidos…</p>}
        {toInvoice.data &&
          (pending.length === 0 ? (
            <div className="card">No hay pedidos pendientes de facturar.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Mesa</th>
                    <th>Hora</th>
                    <th>Total</th>
                    <th>
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((o) => (
                    <tr key={o.id}>
                      <td>
                        #{o.id}
                        {o.status === 'paid' && <span className="muted small"> · ya cobrado</span>}
                      </td>
                      <td>{tableLabel(o.table_id, tableNumbers)}</td>
                      <td>{formatTime(parseServerTimestamp(o.created_at))}</td>
                      <td>{formatPrice(o.total)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn"
                          disabled={invoicingId === o.id}
                          onClick={() => handleCreate(o)}
                          aria-label={`Generar factura del pedido ${o.id}`}
                        >
                          {invoicingId === o.id ? 'Generando…' : 'Generar factura'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </section>

      <section aria-label="Facturas emitidas">
        <h2>Facturas emitidas</h2>
        <div className="toolbar">
          <label>
            Desde
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setPage(1)
              }}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setPage(1)
              }}
            />
          </label>
          {user?.role === 'admin' && (
            <button type="button" className="btn btn-secondary" disabled={exporting} onClick={handleExport}>
              {exporting ? 'Exportando…' : 'Exportar CSV'}
            </button>
          )}
        </div>

        {invoices.error && <ErrorMessage message={invoices.error} onRetry={invoices.reload} />}
        {invoices.loading && !invoices.data && <p className="page-message">Cargando facturas…</p>}
        {invoices.data &&
          (invoices.data.items.length === 0 ? (
            <div className="card">No hay facturas en estas fechas.</div>
          ) : (
            <>
              <div className="table-wrap">
                <table aria-busy={invoices.loading}>
                  <thead>
                    <tr>
                      <th>Número</th>
                      <th>Pedido</th>
                      <th>Fecha</th>
                      <th>Base</th>
                      <th>IVA</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.data.items.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <strong>{i.number}</strong>
                        </td>
                        <td>#{i.order_id}</td>
                        <td>{issuedLabel(i.issued_at)}</td>
                        <td>{formatPrice(i.base_amount)}</td>
                        <td>
                          {formatPrice(i.tax_amount)}{' '}
                          <span className="muted small">({Math.round(Number(i.tax_rate) * 100)} %)</span>
                        </td>
                        <td>
                          <strong>{formatPrice(i.total)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={invoices.data.page}
                size={invoices.data.size}
                total={invoices.data.total}
                onChange={setPage}
                label="facturas"
              />
            </>
          ))}
      </section>
    </>
  )
}
