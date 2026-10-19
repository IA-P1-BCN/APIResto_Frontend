import { useState } from 'react'
import { getErrorMessage } from '../api/errors'
import { deleteTable, listTables, updateTableStatus } from '../api/tables'
import type { DiningTable, TableStatus } from '../api/types'
import ErrorMessage from '../components/ErrorMessage'
import Modal from '../components/Modal'
import TableForm from '../components/TableForm'
import { useAuth } from '../context/useAuth'
import { useConfirm } from '../context/useConfirm'
import { useQuery } from '../hooks/useQuery'
import { TABLE_LOCATION_LABEL, TABLE_LOCATIONS, TABLE_STATUS_LABEL, TABLE_STATUSES } from '../utils/labels'

type TableFormState = { mode: 'new' } | { mode: 'edit'; table: DiningTable } | null

export default function TablesPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const isAdmin = user?.role === 'admin'
  const tables = useQuery(listTables)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [tableForm, setTableForm] = useState<TableFormState>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function handleSaved(table: DiningTable) {
    setNotice(tableForm?.mode === 'edit' ? `Mesa ${table.number} guardada.` : `Mesa ${table.number} creada.`)
    setSaveError(null)
    setTableForm(null)
    tables.reload()
  }

  async function handleDelete(table: DiningTable) {
    const confirmed = await confirm({
      title: `¿Borrar la mesa ${table.number}?`,
      message: 'Si tiene pedidos o reservas, márcala como fuera de servicio en lugar de borrarla.',
      confirmLabel: 'Borrar',
    })
    if (!confirmed) return
    setSavingId(table.id)
    setSaveError(null)
    setNotice(null)
    try {
      await deleteTable(table.id)
      setNotice(`Mesa ${table.number} borrada.`)
      if (tableForm?.mode === 'edit' && tableForm.table.id === table.id) setTableForm(null)
      tables.reload()
    } catch (error) {
      setSaveError(`No se pudo borrar la mesa ${table.number}: ${getErrorMessage(error)}`)
    } finally {
      setSavingId(null)
    }
  }

  async function changeStatus(table: DiningTable, status: TableStatus) {
    setSavingId(table.id)
    setSaveError(null)
    try {
      await updateTableStatus(table.id, status)
      tables.reload()
    } catch (error) {
      setSaveError(`No se pudo cambiar la mesa ${table.number}: ${getErrorMessage(error)}`)
    } finally {
      setSavingId(null)
    }
  }

  const list = [...(tables.data ?? [])].sort((a, b) => a.number - b.number)

  return (
    <>
      <h1>Mesas</h1>
      <p className="muted">Estado de la sala</p>

      {isAdmin && tableForm === null && tables.data && (
        <div className="toolbar">
          <button
            type="button"
            className="btn"
            onClick={() => {
              setTableForm({ mode: 'new' })
              setNotice(null)
            }}
          >
            + Nueva mesa
          </button>
        </div>
      )}

      {isAdmin && tableForm && (
        <Modal label={tableForm.mode === 'edit' ? 'Editar mesa' : 'Nueva mesa'} onClose={() => setTableForm(null)}>
          <TableForm
            key={tableForm.mode === 'edit' ? tableForm.table.id : 'new'}
            table={tableForm.mode === 'edit' ? tableForm.table : undefined}
            suggestedNumber={Math.max(0, ...list.map((t) => t.number)) + 1}
            onSaved={handleSaved}
            onCancel={() => setTableForm(null)}
          />
        </Modal>
      )}

      {notice && (
        <div className="banner banner-success" role="status">
          {notice}
        </div>
      )}
      {tables.error && <ErrorMessage message={tables.error} onRetry={tables.reload} />}
      {saveError && <ErrorMessage message={saveError} />}
      {tables.loading && !tables.data && <p className="page-message">Cargando mesas…</p>}

      {tables.data && (
        <>
          <ul className="summary" aria-label="Resumen de la sala">
            {TABLE_STATUSES.map((status) => (
              <li key={status} className={`chip table-${status}`}>
                {TABLE_STATUS_LABEL[status]}: {list.filter((t) => t.status === status).length}
              </li>
            ))}
          </ul>

          {TABLE_LOCATIONS.map((location) => {
            const inZone = list.filter((t) => t.location === location)
            if (inZone.length === 0) return null
            return (
              <section key={location} className="zone">
                <h2>{TABLE_LOCATION_LABEL[location]}</h2>
                <ul className="cards table-list">
                  {inZone.map((table) => (
                    <li key={table.id} className={`card table-card table-border-${table.status}`}>
                      <div className="card-header">
                        <strong>Mesa {table.number}</strong>
                        <span className="muted">👥 {table.capacity}</span>
                      </div>
                      <span className={`chip table-${table.status}`}>{TABLE_STATUS_LABEL[table.status]}</span>
                      <label className="small">
                        Cambiar estado
                        <select
                          aria-label={`Estado de la mesa ${table.number}`}
                          value={table.status}
                          disabled={savingId === table.id}
                          onChange={(e) => changeStatus(table, e.target.value as TableStatus)}
                        >
                          {TABLE_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {TABLE_STATUS_LABEL[status]}
                            </option>
                          ))}
                        </select>
                      </label>
                      {isAdmin && (
                        <div className="actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-small"
                            onClick={() => {
                              setTableForm({ mode: 'edit', table })
                              setNotice(null)
                            }}
                            aria-label={`Editar mesa ${table.number}`}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-small"
                            disabled={savingId === table.id}
                            onClick={() => handleDelete(table)}
                            aria-label={`Borrar mesa ${table.number}`}
                          >
                            Borrar
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </>
      )}
    </>
  )
}
