import { useState, type FormEvent } from 'react'
import { getErrorMessage } from '../api/errors'
import { CUSTOMER_PARTY_TOO_LARGE, MAX_CUSTOMER_PARTY_SIZE, RESERVATION_IN_PAST } from '../api/reservationRules'
import { createReservation } from '../api/reservations'
import type { Reservation } from '../api/types'
import { joinDateTime, todayISO } from '../utils/format'

interface Props {
  onCreated: (reservation: Reservation) => void
  onCancel: () => void
}

export default function CustomerReservationForm({ onCreated, onCancel }: Props) {
  const [date, setDate] = useState(todayISO)
  const [time, setTime] = useState('21:00')
  const [partySizeInput, setPartySizeInput] = useState('2')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reservedAt = joinDateTime(date, time)
  const partySize = Number(partySizeInput)
  const tooLarge = Number.isInteger(partySize) && partySize > MAX_CUSTOMER_PARTY_SIZE

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (tooLarge) return
    if (!Number.isInteger(partySize) || partySize < 1) {
      setError(`Indica entre 1 y ${MAX_CUSTOMER_PARTY_SIZE} personas`)
      return
    }
    if (new Date(reservedAt) < new Date()) {
      setError(RESERVATION_IN_PAST)
      return
    }
    setSaving(true)
    setError(null)
    try {
      onCreated(
        await createReservation({ reserved_at: reservedAt, party_size: partySize, notes: notes.trim() || undefined }),
      )
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card reservation-form" onSubmit={handleSubmit} aria-label="Nueva reserva" noValidate>
      <h2>Nueva reserva</h2>
      <p className="muted">Dinos cuándo venís y cuántos sois: el restaurante te asigna la mesa.</p>
      <div className="filters">
        <label>
          Fecha
          <input
            type="date"
            min={todayISO()}
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              setError(null)
            }}
            required
          />
        </label>
        <label>
          Hora
          <input
            type="time"
            step="900"
            value={time}
            onChange={(e) => {
              setTime(e.target.value)
              setError(null)
            }}
            required
          />
        </label>
        <label>
          Personas
          <input
            type="number"
            min="1"
            max={MAX_CUSTOMER_PARTY_SIZE}
            value={partySizeInput}
            onChange={(e) => {
              setPartySizeInput(e.target.value)
              setError(null)
            }}
            aria-describedby="party-size-hint"
            required
          />
        </label>
      </div>
      <p id="party-size-hint" className={tooLarge ? 'form-error' : 'muted small'} role={tooLarge ? 'alert' : undefined}>
        {tooLarge ? `${CUSTOMER_PARTY_TOO_LARGE}.` : `Hasta ${MAX_CUSTOMER_PARTY_SIZE} personas por reserva.`}
      </p>
      <label>
        Notas (opcional)
        <input
          type="text"
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Alergias, celebración, trona…"
        />
      </label>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="actions">
        <button type="submit" className="btn" disabled={saving || tooLarge}>
          {saving ? 'Reservando…' : 'Reservar'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
