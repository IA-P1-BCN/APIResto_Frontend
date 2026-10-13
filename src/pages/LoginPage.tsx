import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { getErrorMessage, isUnauthorized } from '../api/errors'
import { MOCK_PASSWORD, MOCK_USERS } from '../api/mockAuth'
import { USE_MOCK } from '../config'
import { useAuth } from '../context/useAuth'
import { ROLE_LABEL } from '../routes/navigation'

export default function LoginPage() {
  const { login, status } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (status === 'authenticated') return <Navigate to="/" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(isUnauthorized(err) ? 'Email o contraseña incorrectos' : getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={handleSubmit}>
        <h1>🍽️ RestoAPI</h1>
        <p className="muted">Inicia sesión para continuar</p>

        <label>
          Email
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </label>
        <div className="field">
          <label htmlFor="login-password">Contraseña</label>
          <div className="password-field">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
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
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>

        {USE_MOCK && (
          <div className="mock-users">
            <p className="muted">
              Modo simulado · contraseña <code>{MOCK_PASSWORD}</code>
            </p>
            {MOCK_USERS.map((u) => (
              <button
                key={u.id}
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setEmail(u.email)
                  setPassword(MOCK_PASSWORD)
                }}
              >
                {ROLE_LABEL[u.role]}
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  )
}
