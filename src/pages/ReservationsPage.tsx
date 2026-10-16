import { useCallback, useState } from 'react'
import { getErrorMessage } from '../api/errors'
import { cancelReservation, deleteReservation, listReservations } from '../api/reservations'
import type { DiningTable, Reservation } from '../api/types'
import CustomerReservationForm from '../components/CustomerReservationForm'
import EditReservationForm from '../components/EditReservationForm'
import ErrorMessage from '../components/ErrorMessage'
import Modal from '../components/Modal'
import NewReservationForm from '../components/NewReservationForm'
import { useAuth } from '../context/useAuth'
import { useConfirm } from '../context/useConfirm'
import { tableLabel, useTableNumbers } from '../hooks/useLookups'
import { useQuery } from '../hooks/useQuery'
import { formatDate, formatTime, parseLocalTimestamp, todayISO } from '../utils/format'
import { RESERVATION_STATUS_LABEL } from '../utils/labels'

function when(reservation: Reservation): string {
  const date = parseLocalTimestamp(reservation.reserved_at)
  return `${formatDate(date)} a las ${formatTime(date)}`
}

function customerTable(reservation: Reservation): string {
  return reservation.table_number ? `Mesa ${reservation.table_number}` : 'Asignada por el restaurante'
}

export default function ReservationsPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const isCustomer = user?.role === 'customer'

  const [date, setDate] = useState(todayISO)
  const [formOpen, setFormOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<number | null>(null)
  const [editing, setEditing] = useState<Reservation | null>(null)

  const fetchReservations = useCallback(() => listReservations(isCustomer ? {} : { date }), [isCustomer, date])
  const reservations = useQuery(fetchReservations)
  const tableNumbers = useTableNumbers(!isCustomer)

  function handleCreated(reservation: Reservation, table: DiningTable) {
    setFormOpen(false)
    setActionError(null)
    setNotice(`Reserva confirmada: ${when(reservation)}, mesa ${table.number}.`)
    setDate(reservation.reserved_at.slice(0, 10))
    reservations.reload()
  }

  function handleCustomerCreated(reservation: Reservation) {
    setFormOpen(false)
    setActionError(null)
    const table = reservation.table_number ? `la mesa ${reservation.table_number}` : 'una mesa'
    setNotice(
      `Reserva confirmada: ${when(reservation)}, para ${reservation.party_size} personas. El restaurante te ha asignado ${table}.`,
    )
    reservations.reload()
  }

  function handleEdited(reservation: Reservation) {
    setEditing(null)
    setActionError(null)
    setNotice(`Reserva guardada: ${when(reservation)}.`)
    setDate(reservation.reserved_at.slice(0, 10))
    reservations.reload()
  }

  async function handleDelete(reservation: Reservation) {
    const confirmed = await confirm({
      title: `¿Borrar definitivamente la reserva del ${when(reservation)}?`,
      message: 'Si solo no vienen, mejor cancélala: así se conserva el historial.',
      confirmLabel: 'Borrar',
    })
    if (!confirmed) return
    setCancellingId(reservation.id)
    setActionError(null)
    setNotice(null)
    try {
      await deleteReservation(reservation.id)
      if (editing?.id === reservation.id) setEditing(null)
      setNotice(`Reserva del ${when(reservation)} borrada.`)
      reservations.reload()
    } catch (error) {
      setActionError(getErrorMessage(error))
    } finally {
      setCancellingId(null)
    }
  }

  async function handleCancel(reservation: Reservation) {
    const confirmed = await confirm({
      title: `¿Cancelar la reserva del ${when(reservation)}?`,
      confirmLabel: 'Cancelar reserva',
    })
    if (!confirmed) return
    setCancellingId(reservation.id)
    setActionError(null)
    setNotice(null)
    try {
      await cancelReservation(reservation.id)
      setNotice(`Reserva del ${when(reservation)} cancelada.`)
      reservations.reload()
    } catch (error) {
      setActionError(getErrorMessage(error))
    } finally {
      setCancellingId(null)
    }
  }

  const list = reservations.data ?? []

  return (
    <>
      <h1>{isCustomer ? 'Mis reservas' : 'Reservas'}</h1>
      <p className="muted">{isCustomer ? 'Tus reservas en el restaurante' : 'Reservas por fecha y hora'}</p>

      {!isCustomer && (
        <div className="toolbar">
          <label>
            Fecha
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          {!formOpen && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setFormOpen(true)
                setEditing(null)
                setNotice(null)
              }}
            >
              + Nueva reserva
            </button>
          )}
        </div>
      )}

      {isCustomer && !formOpen && (
        <div className="toolbar">
          <button
            type="button"
            className="btn"
            onClick={() => {
              setFormOpen(true)
              setNotice(null)
            }}
          >
            + Nueva reserva
          </button>
        </div>
      )}

      {formOpen && (
        <Modal label="Nueva reserva" onClose={() => setFormOpen(false)}>
          {isCustomer ? (
            <CustomerReservationForm onCreated={handleCustomerCreated} onCancel={() => setFormOpen(false)} />
          ) : (
            <NewReservationForm initialDate={date} onCreated={handleCreated} onCancel={() => setFormOpen(false)} />
          )}
        </Modal>
      )}

      {editing && (
        <Modal label="Editar reserva" onClose={() => setEditing(null)}>
          <EditReservationForm
            key={editing.id}
            reservation={editing}
            onSaved={handleEdited}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}

      {notice && (
        <div className="banner banner-success" role="status">
          {notice}
        </div>
      )}
      {actionError && <ErrorMessage message={actionError} />}
      {reservations.error && <ErrorMessage message={reservations.error} onRetry={reservations.reload} />}
      {reservations.loading && !reservations.data && <p className="page-message">Cargando reservas…</p>}

      {reservations.data &&
        (list.length === 0 ? (
          <div className="card">{isCustomer ? 'Todavía no tienes reservas.' : 'No hay reservas para este día.'}</div>
        ) : (
          <div className="table-wrap">
            <table aria-busy={reservations.loading}>
              <thead>
                <tr>
                  {isCustomer && <th>Fecha</th>}
                  <th>Hora</th>
                  <th>Mesa</th>
                  <th>Personas</th>
                  <th>Estado</th>
                  <th>Notas</th>
                  <th>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const start = parseLocalTimestamp(r.reserved_at)
                  return (
                    <tr key={r.id} className={r.status === 'cancelled' ? 'row-cancelled' : undefined}>
                      {isCustomer && <td>{formatDate(start)}</td>}
                      <td>{formatTime(start)}</td>
                      <td>{isCustomer ? customerTable(r) : tableLabel(r.table_id, tableNumbers)}</td>
                      <td>{r.party_size}</td>
                      <td>
                        <span className={`chip reservation-${r.status}`}>{RESERVATION_STATUS_LABEL[r.status]}</span>
                      </td>
                      <td>{r.notes ?? '—'}</td>
                      <td className="row-actions">
                        {!isCustomer && r.status !== 'cancelled' && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-small"
                            onClick={() => {
                              setEditing(r)
                              setFormOpen(false)
                              setNotice(null)
                            }}
                            aria-label={`Editar reserva de las ${formatTime(start)}`}
                          >
                            Editar
                          </button>
                        )}
                        {r.status === 'confirmed' && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-small"
                            disabled={cancellingId === r.id}
                            onClick={() => handleCancel(r)}
                            aria-label={`Cancelar reserva de las ${formatTime(start)}`}
                          >
                            Cancelar
                          </button>
                        )}
                        {!isCustomer && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-small"
                            disabled={cancellingId === r.id}
                            onClick={() => handleDelete(r)}
                            aria-label={`Borrar reserva de las ${formatTime(start)}`}
                          >
                            Borrar
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
    </>
  )
}
