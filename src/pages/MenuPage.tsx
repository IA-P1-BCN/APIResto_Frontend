import { useCallback, useMemo, useState } from 'react'
import { getErrorMessage } from '../api/errors'
import { deleteDish, listAllDishes, listCategories } from '../api/menu'
import type { Category, Dish } from '../api/types'
import CategoryManager from '../components/CategoryManager'
import DishForm from '../components/DishForm'
import ErrorMessage from '../components/ErrorMessage'
import Modal from '../components/Modal'
import { useAuth } from '../context/useAuth'
import { useConfirm } from '../context/useConfirm'
import { useQuery } from '../hooks/useQuery'
import { formatPrice, splitAllergens } from '../utils/format'

type DishFormState = { mode: 'new' } | { mode: 'edit'; dish: Dish } | null

export default function MenuPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const isAdmin = user?.role === 'admin'
  const [dishForm, setDishForm] = useState<DishFormState>(null)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [categoryId, setCategoryId] = useState<number | undefined>()
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const [maxPrice, setMaxPrice] = useState('')
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set())

  const categories = useQuery(listCategories)

  const maxPriceNumber = maxPrice.trim() === '' || !Number.isFinite(Number(maxPrice)) ? undefined : Number(maxPrice)
  const fetchDishes = useCallback(
    () =>
      listAllDishes({
        category_id: categoryId,
        is_available: onlyAvailable ? true : undefined,
        max_price: maxPriceNumber,
      }),
    [categoryId, onlyAvailable, maxPriceNumber],
  )
  const dishes = useQuery(fetchDishes)

  const sections = useMemo(() => {
    const list = dishes.data ?? []
    const known = new Set((categories.data ?? []).map((c) => c.id))
    const groups: { category: Category; dishes: Dish[] }[] = (categories.data ?? []).map((category) => ({
      category,
      dishes: list.filter((d) => d.category_id === category.id),
    }))
    const others = list.filter((d) => !known.has(d.category_id))
    if (others.length) groups.push({ category: { id: 0, name: 'Otros', sort_order: Infinity }, dishes: others })
    return groups.filter((g) => g.dishes.length > 0)
  }, [dishes.data, categories.data])

  function toggleSection(id: number) {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function showNotice(message: string) {
    setNotice(message)
    setActionError(null)
  }

  function handleDishSaved(dish: Dish) {
    showNotice(dishForm?.mode === 'edit' ? `Plato "${dish.name}" guardado.` : `Plato "${dish.name}" creado.`)
    setDishForm(null)
    dishes.reload()
  }

  async function handleDeleteDish(dish: Dish) {
    const confirmed = await confirm({
      title: `¿Borrar "${dish.name}" de la carta?`,
      message: 'Si el plato está en algún pedido, márcalo como no disponible en lugar de borrarlo.',
      confirmLabel: 'Borrar',
    })
    if (!confirmed) return
    setDeletingId(dish.id)
    setNotice(null)
    setActionError(null)
    try {
      await deleteDish(dish.id)
      showNotice(`Plato "${dish.name}" borrado.`)
      if (dishForm?.mode === 'edit' && dishForm.dish.id === dish.id) setDishForm(null)
      dishes.reload()
    } catch (error) {
      setActionError(`No se pudo borrar "${dish.name}": ${getErrorMessage(error)}`)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <h1>Carta</h1>
      <p className="muted">Categorías, platos, precios y alérgenos</p>

      <form className="filters" onSubmit={(e) => e.preventDefault()}>
        <label>
          Categoría
          <select
            value={categoryId ?? ''}
            onChange={(e) => setCategoryId(e.target.value === '' ? undefined : Number(e.target.value))}
          >
            <option value="">Todas</option>
            {(categories.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Precio máximo (€)
          <input
            type="number"
            min="0"
            step="0.5"
            inputMode="decimal"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Sin límite"
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={onlyAvailable}
            onChange={(e) => setOnlyAvailable(e.target.checked)}
          />
          Solo disponibles
        </label>
      </form>

      {isAdmin && (
        <div className="toolbar">
          {dishForm === null && (
            <button
              type="button"
              className="btn"
              disabled={!categories.data?.length}
              onClick={() => {
                setDishForm({ mode: 'new' })
                setNotice(null)
              }}
            >
              + Nuevo plato
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            aria-expanded={categoriesOpen}
            onClick={() => setCategoriesOpen((open) => !open)}
          >
            {categoriesOpen ? 'Ocultar categorías' : 'Gestionar categorías'}
          </button>
        </div>
      )}

      {isAdmin && categoriesOpen && categories.data && (
        <Modal label="Categorías" onClose={() => setCategoriesOpen(false)}>
          <CategoryManager
            categories={categories.data}
            onChanged={(message) => {
              showNotice(message)
              categories.reload()
              dishes.reload()
            }}
          />
        </Modal>
      )}

      {isAdmin && dishForm && categories.data && (
        <Modal label={dishForm.mode === 'edit' ? 'Editar plato' : 'Nuevo plato'} onClose={() => setDishForm(null)}>
          <DishForm
            key={dishForm.mode === 'edit' ? dishForm.dish.id : 'new'}
            categories={categories.data}
            dish={dishForm.mode === 'edit' ? dishForm.dish : undefined}
            onSaved={handleDishSaved}
            onCancel={() => setDishForm(null)}
          />
        </Modal>
      )}

      {notice && (
        <div className="banner banner-success" role="status">
          {notice}
        </div>
      )}
      {actionError && <ErrorMessage message={actionError} />}
      {dishes.error && <ErrorMessage message={dishes.error} onRetry={dishes.reload} />}
      {dishes.loading && !dishes.data && <p className="page-message">Cargando carta…</p>}

      {dishes.data &&
        (sections.length === 0 ? (
          <div className="card">No hay platos con estos filtros.</div>
        ) : (
          <>
            <p className="muted">{dishes.data.length} platos</p>
            {sections.map(({ category, dishes: items }) => {
              const open = !collapsed.has(category.id)
              return (
                <section key={category.id} className="menu-section" aria-labelledby={`categoria-${category.id}`}>
                  <h2 id={`categoria-${category.id}`}>
                    <button
                      type="button"
                      className="section-toggle"
                      aria-expanded={open}
                      aria-controls={open ? `platos-${category.id}` : undefined}
                      onClick={() => toggleSection(category.id)}
                    >
                      {category.name} <span className="muted small">({items.length})</span>
                    </button>
                  </h2>
                  {open && (
                    <ul id={`platos-${category.id}`} className="cards dish-list" aria-busy={dishes.loading}>
                      {items.map((dish) => (
                        <li key={dish.id} className={`card dish${dish.is_available ? '' : ' dish-unavailable'}`}>
                          <div className="card-header">
                            <strong>{dish.name}</strong>
                            <span className="price">{formatPrice(dish.price)}</span>
                          </div>
                          {dish.description && <p className="dish-description">{dish.description}</p>}
                          <div className="chips">
                            {!dish.is_available && <span className="chip chip-warning">No disponible</span>}
                            {splitAllergens(dish.allergens).map((a) => (
                              <span key={a} className="chip">
                                {a}
                              </span>
                            ))}
                          </div>
                          {isAdmin && (
                            <div className="actions">
                              <button
                                type="button"
                                className="btn btn-secondary btn-small"
                                onClick={() => {
                                  setDishForm({ mode: 'edit', dish })
                                  setNotice(null)
                                }}
                                aria-label={`Editar ${dish.name}`}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-small"
                                disabled={deletingId === dish.id}
                                onClick={() => handleDeleteDish(dish)}
                                aria-label={`Borrar ${dish.name}`}
                              >
                                Borrar
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )
            })}
          </>
        ))}
    </>
  )
}
