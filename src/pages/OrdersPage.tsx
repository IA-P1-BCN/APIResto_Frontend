import { useCallback, useState } from 'react'
import { getErrorMessage } from '../api/errors'
import { ACTIVE_STATUSES, transitionsFor } from '../api/orderRules'
import { listOrders, updateOrderItem, updateOrderStatus } from '../api/orders'
import type { Order, OrderItem, OrderStatus } from '../api/types'
import ErrorMessage from '../components/ErrorMessage'
import ItemMark from '../components/ItemMark'
import Modal from '../components/Modal'
import NewOrderForm from '../components/NewOrderForm'
import { useAuth } from '../context/useAuth'
import { useConfirm } from '../context/useConfirm'
import { dishLabel, tableLabel, useDishNames, useTableNumbers } from '../hooks/useLookups'
import { useQuery } from '../hooks/useQuery'
import { formatPrice, formatTime, parseServerTimestamp } from '../utils/format'
import { ORDER_STATUS_LABEL, ORDER_STATUSES } from '../utils/labels'

type Filter = 'active' | 'all' | OrderStatus

export default function OrdersPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const [filter, setFilter] = useState<Filter>('active')
  const [formOpen, setFormOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [changingId, setChangingId] = useState<number | null>(null)
  const [savingItemId, setSavingItemId] = useState<number | null>(null)

  const fetchOrders = useCallback(() => {
    const statuses = filter === 'all' ? undefined : filter === 'active' ? ACTIVE_STATUSES : [filter]
    return listOrders({ statuses })
  }, [filter])
  const orders = useQuery(fetchOrders)
  const dishNames = useDishNames()
  const tableNumbers = useTableNumbers(true)

  function handleCreated(order: Order) {
    setFormOpen(false)
    setNotice(
      `Pedido #${order.id} enviado a cocina (${tableLabel(order.table_id, tableNumbers).toLowerCase()}, ${formatPrice(order.total)}).`,
    )
    orders.reload()
  }

  async function changeStatus(order: Order, status: OrderStatus) {
    if (status === 'cancelled') {
      const confirmed = await confirm({ title: `¿Cancelar el pedido #${order.id}?`, confirmLabel: 'Cancelar pedido' })
      if (!confirmed) return
    }
    setChangingId(order.id)
    setActionError(null)
    setNotice(null)
    try {
      await updateOrderStatus(order.id, status)
      setNotice(
        status === 'paid'
          ? `Pedido #${order.id}: facturado y pagado.`
          : `Pedido #${order.id}: ${ORDER_STATUS_LABEL[status].toLowerCase()}.`,
      )
      orders.reload()
    } catch (error) {
      setActionError(getErrorMessage(error))
    } finally {
      setChangingId(null)
    }
  }

  async function markServed(order: Order, item: OrderItem, count: number) {
    setSavingItemId(item.id)
    setActionError(null)
    try {
      await updateOrderItem(order.id, item.id, { served_quantity: count })
      orders.reload()
    } catch (error) {
      setActionError(getErrorMessage(error))
    } finally {
      setSavingItemId(null)
    }
  }

  if (!user) return null
  const list = orders.data ?? []

  return (
    <>
      <h1>Pedidos</h1>
      <p className="muted">Comandas por mesa</p>

      <div className="toolbar">
        <label>
          Mostrar
          <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="active">En curso</option>
            <option value="all">Todos</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        {!formOpen && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setFormOpen(true)
              setNotice(null)
            }}
          >
            + Nuevo pedido
          </button>
        )}
      </div>

      {formOpen && (
        <Modal label="Nuevo pedido" onClose={() => setFormOpen(false)}>
          <NewOrderForm onCreated={handleCreated} onCancel={() => setFormOpen(false)} />
        </Modal>
      )}

      {notice && (
        <div className="banner banner-success" role="status">
          {notice}
        </div>
      )}
      {actionError && <ErrorMessage message={actionError} />}
      {orders.error && <ErrorMessage message={orders.error} onRetry={orders.reload} />}
      {orders.loading && !orders.data && <p className="page-message">Cargando pedidos…</p>}

      {orders.data &&
        (list.length === 0 ? (
          <div className="card">No hay pedidos.</div>
        ) : (
          <div className="order-cards" aria-busy={orders.loading}>
            {list.map((o) => {
              const transitions = transitionsFor(user.role, o.status)
              const editable = o.status !== 'paid' && o.status !== 'cancelled'
              return (
                <article key={o.id} className="card order-card" aria-label={`Pedido ${o.id}`}>
                  <header className="order-card-header">
                    <div className="order-card-title">
                      <strong>{tableLabel(o.table_id, tableNumbers)}</strong>
                      <span className="muted small">
                        #{o.id} · {formatTime(parseServerTimestamp(o.created_at))}
                      </span>
                    </div>
                    <div className="order-card-status">
                      <span className={`chip order-${o.status}`}>{ORDER_STATUS_LABEL[o.status]}</span>
                      <strong>{formatPrice(o.total)}</strong>
                    </div>
                    {transitions.length > 0 && (
                      <div className="actions order-card-actions">
                        {transitions.map((t) => (
                          <button
                            key={t.to}
                            type="button"
                            className="btn btn-secondary btn-small"
                            disabled={changingId === o.id}
                            onClick={() => changeStatus(o, t.to)}
                            aria-label={`${t.action} pedido ${o.id}`}
                          >
                            {t.action}
                          </button>
                        ))}
                      </div>
                    )}
                  </header>
                  <ul className="order-items" aria-label={`Platos del pedido ${o.id}`}>
                    {o.items.map((i) => {
                      const name = dishLabel(i.dish_id, dishNames)
                      const ready = i.prepared_quantity - i.served_quantity
                      return (
                        <li key={i.id} className={i.served ? 'item-served' : undefined}>
                          {editable ? (
                            <ItemMark
                              item={i}
                              field="served"
                              name={name}
                              disabled={savingItemId === i.id}
                              onChange={(count) => markServed(o, i, count)}
                            >
                              {ready > 0 && (
                                <span className="chip chip-ready">
                                  {i.quantity === 1 ? 'Listo' : `${ready} ${ready === 1 ? 'lista' : 'listas'}`}
                                </span>
                              )}
                            </ItemMark>
                          ) : (
                            <span className="item-name">
                              {i.served && <span aria-label="servido">✓ </span>}
                              {i.quantity}× {name}
                              {!i.served &&
                                i.served_quantity > 0 &&
                                ` (${i.served_quantity} ${i.served_quantity === 1 ? 'servida' : 'servidas'})`}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                  <span className="muted small">
                    {o.items.reduce((total, i) => total + i.served_quantity, 0)} de{' '}
                    {o.items.reduce((total, i) => total + i.quantity, 0)} servidos
                  </span>
                </article>
              )
            })}
          </div>
        ))}
    </>
  )
}
