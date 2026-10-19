import { useState } from 'react'
import { getErrorMessage } from '../api/errors'
import { mockServer } from '../api/mock/server'
import { transitionsFor } from '../api/orderRules'
import { updateOrderItem, updateOrderStatus } from '../api/orders'
import { coversWholeOrder, stationOf } from '../api/stations'
import type { Order, OrderItem, OrderStatus, Station } from '../api/types'
import { USE_MOCK } from '../config'
import { useAuth } from '../context/useAuth'
import { POLL_MS, useKitchenFeed } from '../hooks/useKitchenFeed'
import { dishLabel, tableLabel, useDishNames, useDishStations, useTableNumbers } from '../hooks/useLookups'
import { useNow } from '../hooks/useNow'
import { formatElapsed, formatTime, parseServerTimestamp } from '../utils/format'
import ErrorMessage from './ErrorMessage'
import ItemMark from './ItemMark'

const COLUMNS: { status: OrderStatus; title: string }[] = [
  { status: 'pending', title: 'Pendientes' },
  { status: 'in_kitchen', title: 'En preparación' },
]

const units = (items: OrderItem[], field: 'quantity' | 'prepared_quantity') =>
  items.reduce((total, i) => total + i[field], 0)

interface Props {
  station: Station
  title: string
}

export default function StationBoard({ station, title: pageTitle }: Props) {
  const { user } = useAuth()
  const { orders, status, error, newIds, refresh, applyLocal } = useKitchenFeed()
  const dishNames = useDishNames()
  const stations = useDishStations()
  const tableNumbers = useTableNumbers(user?.role === 'admin')
  const now = useNow()
  const [changingId, setChangingId] = useState<number | null>(null)
  const [savingItemId, setSavingItemId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function changeStatus(order: Order, next: OrderStatus) {
    setChangingId(order.id)
    setActionError(null)
    try {
      applyLocal(await updateOrderStatus(order.id, next))
    } catch (err) {
      setActionError(getErrorMessage(err))
    } finally {
      setChangingId(null)
    }
  }

  async function markPrepared(order: Order, item: OrderItem, count: number) {
    setSavingItemId(item.id)
    setActionError(null)
    try {
      applyLocal(await updateOrderItem(order.id, item.id, { prepared_quantity: count }))
    } catch (err) {
      setActionError(getErrorMessage(err))
    } finally {
      setSavingItemId(null)
    }
  }

  if (!user) return null

  return (
    <>
      <div className="kitchen-header">
        <div>
          <h1>{pageTitle}</h1>
          <p className="muted">Pedidos en tiempo real</p>
        </div>
        <span className={`connection connection-${status}`} role="status">
          {status === 'open'
            ? '🟢 En directo'
            : status === 'connecting'
              ? '🟡 Conectando…'
              : `🔴 Sin conexión · actualizando cada ${POLL_MS / 1000} s`}
        </span>
      </div>

      {USE_MOCK && (
        <div className="toolbar">
          <button type="button" className="btn btn-secondary" onClick={() => void mockServer.simulateWaiterOrder(station)}>
            Simular pedido de sala
          </button>
        </div>
      )}

      {error && <ErrorMessage message={error} onRetry={refresh} />}
      {actionError && <ErrorMessage message={actionError} />}
      {(orders === null || stations === null) && !error && <p className="page-message">Cargando pedidos…</p>}

      {orders && stations && (
        <div className="kanban">
          {COLUMNS.map(({ status: columnStatus, title }) => {
            const column = orders
              .filter((o) => o.status === columnStatus)
              .map((o) => ({ o, items: o.items.filter((i) => stationOf(i, stations) === station) }))
              .filter(({ items }) => items.length > 0)
              .sort(({ o: a }, { o: b }) => a.created_at.localeCompare(b.created_at) || a.id - b.id)
            return (
              <section key={columnStatus} className="kanban-col" aria-label={title}>
                <h2>
                  {title} <span className="badge">{column.length}</span>
                </h2>
                {column.length === 0 && <p className="muted">Nada por aquí.</p>}
                {column.map(({ o, items }) => {
                  const createdAt = parseServerTimestamp(o.created_at)
                  const leadsOrder = station === 'kitchen' || coversWholeOrder(o, items)
                  return (
                    <article
                      key={o.id}
                      className={`card ticket${newIds.has(o.id) ? ' ticket-new' : ''}`}
                      aria-label={`Pedido ${o.id}`}
                    >
                      <header className="ticket-header">
                        <strong>{tableLabel(o.table_id, tableNumbers)}</strong>
                        <span className="muted small">
                          #{o.id} · {formatTime(createdAt)} · {formatElapsed(createdAt, now)}
                        </span>
                      </header>
                      {newIds.has(o.id) && <span className="chip chip-warning">Nuevo</span>}
                      <ul className="ticket-lines" aria-label={`Platos del pedido ${o.id}`}>
                        {items.map((i) => (
                          <li key={i.id} className={i.prepared ? 'item-prepared' : undefined}>
                            <ItemMark
                              item={i}
                              field="prepared"
                              name={dishLabel(i.dish_id, dishNames)}
                              disabled={savingItemId === i.id}
                              onChange={(count) => markPrepared(o, i, count)}
                            />
                            {i.notes && <span className="ticket-note">⚠ {i.notes}</span>}
                          </li>
                        ))}
                      </ul>
                      <span className="muted small">
                        {units(items, 'prepared_quantity')} de {units(items, 'quantity')} preparados
                      </span>
                      {leadsOrder ? (
                        <div className="actions">
                          {transitionsFor(user.role, o.status)
                            .filter((t) => t.to !== 'cancelled')
                            .map((t) => (
                              <button
                                key={t.to}
                                type="button"
                                className="btn"
                                disabled={changingId === o.id}
                                onClick={() => changeStatus(o, t.to)}
                                aria-label={`${t.action} pedido ${o.id}`}
                              >
                                {t.action}
                              </button>
                            ))}
                        </div>
                      ) : (
                        <span className="muted small">Cocina lleva el estado del pedido</span>
                      )}
                    </article>
                  )
                })}
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}
