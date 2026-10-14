import { useMemo, useState, type FormEvent } from 'react'
import { getErrorMessage } from '../api/errors'
import { listAllDishes, listCategories } from '../api/menu'
import { createOrder } from '../api/orders'
import { listTables } from '../api/tables'
import type { Dish, Order } from '../api/types'
import { useConfirm } from '../context/useConfirm'
import { useQuery } from '../hooks/useQuery'
import { formatPrice } from '../utils/format'
import { TABLE_LOCATION_LABEL } from '../utils/labels'

interface Line {
  dish: Dish
  quantity: number
  notes: string
}

const fetchAvailableDishes = () => listAllDishes({ is_available: true })

interface Props {
  onCreated: (order: Order) => void
  onCancel: () => void
}

export default function NewOrderForm({ onCreated, onCancel }: Props) {
  const tables = useQuery(listTables)
  const categories = useQuery(listCategories)
  const dishes = useQuery(fetchAvailableDishes)
  const confirm = useConfirm()

  const [tableId, setTableId] = useState<number | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const usableTables = (tables.data ?? [])
    .filter((t) => t.status !== 'out_of_service')
    .sort((a, b) => a.number - b.number)
  const byCategory = useMemo(
    () =>
      (categories.data ?? [])
        .map((category) => ({ category, dishes: (dishes.data ?? []).filter((d) => d.category_id === category.id) }))
        .filter((group) => group.dishes.length > 0),
    [categories.data, dishes.data],
  )
  const total = lines.reduce((t, l) => t + l.quantity * Number(l.dish.price), 0)

  async function add(dish: Dish) {
    const existing = lines.find((l) => l.dish.id === dish.id)
    if (existing) {
      const confirmed = await confirm({
        title: `${dish.name} ya está en la comanda`,
        message: `Lleva ${existing.quantity}. ¿Quieres añadir otro?`,
        confirmLabel: 'Añadir otro',
        cancelLabel: 'No añadir',
      })
      if (!confirmed) return
    }
    setLines((ls) => {
      const existing = ls.find((l) => l.dish.id === dish.id)
      if (existing) return ls.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l))
      return [...ls, { dish, quantity: 1, notes: '' }]
    })
  }

  function changeQuantity(dishId: number, delta: number) {
    setLines((ls) =>
      ls.map((l) => (l.dish.id === dishId ? { ...l, quantity: l.quantity + delta } : l)).filter((l) => l.quantity > 0),
    )
  }

  function changeNotes(dishId: number, notes: string) {
    setLines((ls) => ls.map((l) => (l.dish.id === dishId ? { ...l, notes } : l)))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (tableId === null || lines.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const order = await createOrder({
        table_id: tableId,
        items: lines.map((l) => ({ dish_id: l.dish.id, quantity: l.quantity, notes: l.notes.trim() || undefined })),
      })
      onCreated(order)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const loadError = tables.error ?? categories.error ?? dishes.error

  return (
    <form className="card order-form" onSubmit={handleSubmit} aria-label="Nuevo pedido">
      <h2>Nuevo pedido</h2>

      {loadError && <p className="form-error">{loadError}</p>}
      {dishes.loading && !dishes.data && <p className="muted">Cargando carta…</p>}

      <label>
        Mesa
        <select
          value={tableId ?? ''}
          onChange={(e) => setTableId(e.target.value === '' ? null : Number(e.target.value))}
          required
        >
          <option value="">Elige una mesa</option>
          {usableTables.map((t) => (
            <option key={t.id} value={t.id}>
              Mesa {t.number} · {TABLE_LOCATION_LABEL[t.location]}
            </option>
          ))}
        </select>
      </label>

      <div className="order-grid">
        <section aria-label="Carta">
          {byCategory.map(({ category, dishes: list }) => (
            <div key={category.id} className="menu-group">
              <h3>{category.name}</h3>
              <ul className="quick-menu">
                {list.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-dish"
                      onClick={() => void add(d)}
                      aria-label={`Añadir ${d.name}`}
                    >
                      <span>{d.name}</span>
                      <span className="price">{formatPrice(d.price)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="ticket-draft" aria-label="Comanda">
          <h3>Comanda</h3>
          {lines.length === 0 ? (
            <p className="muted">Añade platos desde la carta.</p>
          ) : (
            <ul className="draft-lines">
              {lines.map((l) => (
                <li key={l.dish.id}>
                  <div className="draft-row">
                    <span>{l.dish.name}</span>
                    <span className="quantity">
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() => changeQuantity(l.dish.id, -1)}
                        aria-label={`Quitar uno de ${l.dish.name}`}
                      >
                        −
                      </button>
                      <output aria-label={`Cantidad de ${l.dish.name}`}>{l.quantity}</output>
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() => changeQuantity(l.dish.id, 1)}
                        aria-label={`Añadir otro de ${l.dish.name}`}
                      >
                        +
                      </button>
                    </span>
                    <span className="price">{formatPrice(l.quantity * Number(l.dish.price))}</span>
                  </div>
                  <input
                    type="text"
                    maxLength={255}
                    value={l.notes}
                    onChange={(e) => changeNotes(l.dish.id, e.target.value)}
                    placeholder="Notas: sin cebolla, al punto…"
                    aria-label={`Notas de ${l.dish.name}`}
                  />
                </li>
              ))}
            </ul>
          )}
          <p className="draft-total">
            Total <strong data-testid="order-total">{formatPrice(total)}</strong>
          </p>
        </section>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="actions">
        <button type="submit" className="btn" disabled={saving || tableId === null || lines.length === 0}>
          {saving ? 'Enviando…' : 'Enviar a cocina'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
