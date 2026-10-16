import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getErrorMessage } from '../api/errors'
import { MIN_PASSWORD_LENGTH, setPassword, setPasswordErrorCode } from '../api/password'
import ThemeToggle from '../components/ThemeToggle'

const LINK_ERRORS: Record<string, string> = {
  invalid_token: 'Este enlace no es válido. Pide uno nuevo al restaurante.',
  token_used: 'Este enlace ya se ha usado. Si ya creaste tu contraseña, inicia sesión.',
  token_expired: 'Este enlace ha caducado. Pide uno nuevo al restaurante.',
}

function formError(password: string, repeat: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
  }
  if (password !== repeat) return 'Las dos contraseñas no coinciden.'
  return null
}

export default function SetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const [password, setPasswordValue] = useState('')
  const [repeat, setRepeat] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(token ? null : LINK_ERRORS.invalid_token)
  const [linkBroken, setLinkBroken] = useState(!token)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const invalid = formError(password, repeat)
    if (invalid) {
      setError(invalid)
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await setPassword(token, password)
      setDone(true)
    } catch (err) {
      const message = LINK_ERRORS[setPasswordErrorCode(err) ?? '']
      setLinkBroken(Boolean(message))
      setError(message ?? getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (done || linkBroken) {
    return (
      <div className="login-page">
        <ThemeToggle />
        <div className="card login-card">
          <h1>🍽️ APIResto</h1>
          {done ? (
            <p className="banner banner-success" role="status">
              Contraseña creada. Ya puedes iniciar sesión.
            </p>
          ) : (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Link className="btn" to="/login">
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <ThemeToggle />
      <form className="card login-card" onSubmit={handleSubmit} noValidate>
        <h1>🍽️ APIResto</h1>
        <p className="muted">Crea tu contraseña para entrar en la app</p>

        <div className="field">
          <label htmlFor="new-password">Contraseña nueva</label>
          <div className="password-field">
            <input
              id="new-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPasswordValue(e.target.value)}
              aria-describedby="new-password-hint"
              required
              autoFocus
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          <span id="new-password-hint" className="muted small">
            Mínimo {MIN_PASSWORD_LENGTH} caracteres.
          </span>
        </div>
        <label>
          Repite la contraseña
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            required
          />
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? 'Guardando…' : 'Crear contraseña'}
        </button>
      </form>
    </div>
  )
}
