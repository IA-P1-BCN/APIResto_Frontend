import { useState } from 'react'
import type { SalesDay } from '../api/types'
import { formatPrice } from '../utils/format'

const shortDay = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' })
const longDay = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
const axisEuros = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
  notation: 'compact',
})

const parseDay = (day: string) => new Date(`${day}T00:00:00`)

function niceStep(max: number, ticks: number): number {
  const raw = max / ticks
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= raw) ?? 10
  return step * magnitude
}

export default function DailySalesChart({ days }: { days: SalesDay[] }) {
  const [active, setActive] = useState<string | null>(null)
  const values = days.map((d) => Number(d.total_sales))
  const max = Math.max(...values, 0)
  const step = max > 0 ? niceStep(max, 4) : 1
  const top = Math.max(step, Math.ceil(max / step) * step)
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
  const peak = values.indexOf(max)
  const labelEvery = Math.ceil(days.length / 10)

  return (
    <div className="column-chart">
      <div className="column-chart-axis" aria-hidden="true">
        {ticks
          .slice()
          .reverse()
          .map((tick) => (
            <span key={tick}>{axisEuros.format(tick)}</span>
          ))}
      </div>
      <div className="column-chart-plot">
        {ticks.map((tick) => (
          <span key={tick} className="column-chart-grid" style={{ bottom: `${(tick / top) * 100}%` }} />
        ))}
        <div className="column-chart-columns">
          {days.map((d, index) => {
            const value = Number(d.total_sales)
            const date = parseDay(d.day)
            const label = `${longDay.format(date)}: ${formatPrice(value)}, ${d.orders_count} ${d.orders_count === 1 ? 'pedido' : 'pedidos'}`
            return (
              <button
                key={d.day}
                type="button"
                className={`column-chart-slot${active === d.day ? ' is-active' : ''}`}
                aria-label={label}
                onPointerEnter={() => setActive(d.day)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(d.day)}
                onBlur={() => setActive(null)}
              >
                <span className="column-chart-bar" style={{ height: `${(value / top) * 100}%` }}>
                  {index === peak && max > 0 && <span className="column-chart-peak">{formatPrice(value)}</span>}
                </span>
                {active === d.day && (
                  <span className="chart-tooltip" role="tooltip">
                    <strong>{formatPrice(value)}</strong>
                    <span>
                      {shortDay.format(date)} · {d.orders_count} {d.orders_count === 1 ? 'pedido' : 'pedidos'}
                    </span>
                  </span>
                )}
                <span className="column-chart-label" aria-hidden="true">
                  {index % labelEvery === 0 ? shortDay.format(date) : ''}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
