import type { ReactNode } from 'react'
import type { OrderItem } from '../api/types'

export type MarkField = 'prepared' | 'served'

const WORDS: Record<MarkField, { one: string; many: string }> = {
  prepared: { one: 'preparada', many: 'preparadas' },
  served: { one: 'servida', many: 'servidas' },
}

interface Props {
  item: OrderItem
  field: MarkField
  name: string
  disabled: boolean
  onChange: (count: number) => void
  children?: ReactNode
}

export default function ItemMark({ item, field, name, disabled, onChange, children }: Props) {
  const done = item[`${field}_quantity`]
  const text = `${item.quantity}× ${name}`

  if (item.quantity === 1) {
    return (
      <label className="checkbox item-check">
        <input type="checkbox" checked={done === 1} disabled={disabled} onChange={() => onChange(done === 1 ? 0 : 1)} />
        <span className="item-name">{text}</span>
        {children}
      </label>
    )
  }

  const words = WORDS[field]
  return (
    <div className="item-check item-counter">
      <span className="item-name">{text}</span>
      {children}
      <span className="quantity">
        <button
          type="button"
          className="btn btn-secondary btn-small"
          disabled={disabled || done === 0}
          onClick={() => onChange(done - 1)}
          aria-label={`Una ${words.one} menos de ${name}`}
        >
          −
        </button>
        <span className="count" aria-hidden="true">
          {done}/{item.quantity}
        </span>
        <span className="sr-only">
          {done} de {item.quantity} {words.many}
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          disabled={disabled || done === item.quantity}
          onClick={() => onChange(done + 1)}
          aria-label={`Una ${words.one} más de ${name}`}
        >
          +
        </button>
      </span>
    </div>
  )
}
