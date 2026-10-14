import { useCallback, useState } from 'react'
import { getSales, getTopDishes } from '../api/stats'
import type { SalesDay } from '../api/types'
import DailySalesChart from '../components/DailySalesChart'
import ErrorMessage from '../components/ErrorMessage'
import { useQuery } from '../hooks/useQuery'
import { formatPrice, toISODate } from '../utils/format'

type Preset = 'today' | 'week' | 'month' | 'all' | 'custom'

const PRESETS: { id: Exclude<Preset, 'custom'>; label: string; days: number | null }[] = [
  { id: 'today', label: 'Hoy', days: 1 },
  { id: 'week', label: 'Últimos 7 días', days: 7 },
  { id: 'month', label: 'Últimos 30 días', days: 30 },
  { id: 'all', label: 'Todo', days: null },
]

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_FILLED_DAYS = 92
const TOP_LIMITS = [5, 10]
const BAR_MAX_WIDTH = 70

const dayLabel = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })

function presetRange(days: number | null): { from: string; to: string } {
  if (days === null) return { from: '', to: '' }
  const today = new Date()
  return { from: toISODate(new Date(today.getTime() - (days - 1) * DAY_MS)), to: toISODate(today) }
}

function everyDay(daily: SalesDay[], from: string, to: string): SalesDay[] {
  const first = from || daily[0]?.day
  const last = to || daily[daily.length - 1]?.day
  if (!first || !last) return daily
  const byDay = new Map(daily.map((d) => [d.day, d]))
  const days: SalesDay[] = []
  for (let t = new Date(`${first}T12:00:00`).getTime(); toISODate(new Date(t)) <= last; t += DAY_MS) {
    const day = toISODate(new Date(t))
    days.push(byDay.get(day) ?? { day, orders_count: 0, total_sales: '0.00' })
    if (days.length > MAX_FILLED_DAYS) return daily
  }
  return days
}

export default function StatsPage() {
  const [preset, setPreset] = useState<Preset>('week')
  const [range, setRange] = useState(presetRange(7))
  const [limit, setLimit] = useState(TOP_LIMITS[0])

  const fetchSales = useCallback(() => getSales({ from: range.from || undefined, to: range.to || undefined }), [range])
  const fetchTop = useCallback(
    () => getTopDishes({ from: range.from || undefined, to: range.to || undefined, limit }),
    [range, limit],
  )
  const sales = useQuery(fetchSales)
  const top = useQuery(fetchTop)

  function choosePreset(id: Exclude<Preset, 'custom'>, days: number | null) {
    setPreset(id)
    setRange(presetRange(days))
  }

  function changeDate(field: 'from' | 'to', value: string) {
    setPreset('custom')
    setRange((r) => ({ ...r, [field]: value }))
  }

  const summary = sales.data
  const days = summary ? everyDay(summary.daily, range.from, range.to) : []
  const maxQuantity = Math.max(...(top.data ?? []).map((d) => d.quantity), 1)

  return (
    <div className="stats">
      <h1>Estadísticas</h1>
      <p className="muted">Pedidos servidos y pagados. Los datos pueden tardar hasta un minuto en actualizarse.</p>

      <div className="toolbar stats-filters" role="group" aria-label="Periodo">
        <div className="segmented">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="btn btn-secondary"
              aria-pressed={preset === p.id}
              onClick={() => choosePreset(p.id, p.days)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label>
          Desde
          <input type="date" value={range.from} onChange={(e) => changeDate('from', e.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={range.to} onChange={(e) => changeDate('to', e.target.value)} />
        </label>
      </div>

      {sales.error && <ErrorMessage message={sales.error} onRetry={sales.reload} />}
      {sales.loading && !summary && <p className="page-message">Cargando estadísticas…</p>}

      {summary && (
        <div className={sales.loading ? 'is-refreshing' : undefined} aria-busy={sales.loading}>
          <section className="stat-tiles" aria-label="Resumen">
            <div className="card stat-tile stat-tile-hero">
              <span className="stat-label">Total vendido</span>
              <strong className="stat-value">{formatPrice(summary.total_sales)}</strong>
            </div>
            <div className="card stat-tile">
              <span className="stat-label">Pedidos</span>
              <strong className="stat-value">{summary.orders_count}</strong>
            </div>
            <div className="card stat-tile">
              <span className="stat-label">Ticket medio</span>
              <strong className="stat-value">{formatPrice(summary.average_ticket)}</strong>
            </div>
          </section>

          <section className="card chart-card" aria-label="Ventas por día">
            <h2>Ventas por día</h2>
            {summary.orders_count === 0 ? (
              <p className="muted">No hay ventas en estas fechas.</p>
            ) : (
              <>
                <DailySalesChart days={days} />
                <details className="chart-table">
                  <summary>Ver los datos en una tabla</summary>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Día</th>
                          <th>Pedidos</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.daily.map((d) => (
                          <tr key={d.day}>
                            <td>{dayLabel.format(new Date(`${d.day}T00:00:00`))}</td>
                            <td className="numeric">{d.orders_count}</td>
                            <td className="numeric">{formatPrice(d.total_sales)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            )}
          </section>
        </div>
      )}

      <section className="card chart-card" aria-label="Platos más vendidos" aria-busy={top.loading}>
        <div className="chart-card-header">
          <h2>Platos más vendidos</h2>
          <label className="inline-field">
            Mostrar
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              {TOP_LIMITS.map((n) => (
                <option key={n} value={n}>
                  {n} platos
                </option>
              ))}
            </select>
          </label>
        </div>
        {top.error && <ErrorMessage message={top.error} onRetry={top.reload} />}
        {top.loading && !top.data && <p className="muted">Cargando platos…</p>}
        {top.data &&
          (top.data.length === 0 ? (
            <p className="muted">No hay ventas en estas fechas.</p>
          ) : (
            <ol className={`bar-list${top.loading ? ' is-refreshing' : ''}`}>
              {top.data.map((d) => (
                <li key={d.dish_id}>
                  <span className="bar-list-name">{d.name}</span>
                  <span className="bar-list-track">
                    <span className="bar-list-bar" style={{ width: `${(d.quantity / maxQuantity) * BAR_MAX_WIDTH}%` }} />
                    <span className="bar-list-value">
                      <strong>{d.quantity} uds.</strong> <span className="muted">· {formatPrice(d.revenue)}</span>
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          ))}
      </section>
    </div>
  )
}
