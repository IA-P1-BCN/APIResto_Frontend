import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { exitDemo, isDemoChosen, resetDemo, startDemo } from '../api/demo'
import { getErrorMessage, isUnauthorized, tooManyAttemptsMessage } from '../api/errors'
import { MOCK_PASSWORD, MOCK_USERS } from '../api/mockAuth'
import { availableProviders, SOCIAL_LABEL, socialLoginUrl, type SocialProvider } from '../api/social'
import SimulatedProviderDialog from '../components/SimulatedProviderDialog'
import ThemeToggle from '../components/ThemeToggle'
import TwoFactorStep from '../components/TwoFactorStep'
import { USE_MOCK } from '../config'
import { useAuth } from '../context/useAuth'
import { HOME_PATH, ROLE_LABEL } from '../routes/navigation'

export default function LoginPage() {
  const { login, status, user } = useAuth()
  const navigate = useNavigate()
  const providers = availableProviders()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [simulated, setSimulated] = useState<SocialProvider | null>(null)
  const [mfaToken, setMfaToken] = useState<string | null>(null)

  if (status === 'authenticated' && user) return <Navigate to={HOME_PATH} replace />

  if (mfaToken) {
    return (
      <div className="login-page">
        <ThemeToggle />
        <TwoFactorStep
          mfaToken={mfaToken}
          onCancel={() => {
            setMfaToken(null)
            setPassword('')
          }}
        />
      </div>
    )
  }

  function startSocialLogin(provider: SocialProvider) {
    if (USE_MOCK) setSimulated(provider)
    else window.location.assign(socialLoginUrl(provider))
  }

  function finishSimulated(provider: SocialProvider, authorized: boolean) {
    const url = new URL(socialLoginUrl(provider), window.location.origin)
    if (!authorized) {
      url.searchParams.delete('code')
      url.searchParams.set('error', 'access_denied')
    }
    navigate(`${url.pathname}${url.search}`)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      setMfaToken(await login(email, password))
    } catch (err) {
      setError(
        tooManyAttemptsMessage(err) ?? (isUnauthorized(err) ? 'Email o contraseña incorrectos' : getErrorMessage(err)),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <ThemeToggle />
      <form className="card login-card" onSubmit={handleSubmit}>
        <h1>🍽️ APIResto</h1>
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

        {providers.length > 0 && (
          <div className="social-login">
            <p className="social-divider">
              <span>o</span>
            </p>
            {providers.map((p) => (
              <button key={p} type="button" className="btn btn-secondary" onClick={() => startSocialLogin(p)}>
                Continuar con {SOCIAL_LABEL[p]}
              </button>
            ))}
          </div>
        )}

        {!USE_MOCK && (
          <div className="demo-entry">
            <button type="button" className="btn btn-secondary" onClick={startDemo}>
              Probar la demo
            </button>
            <p className="muted small">Sin cuenta: datos de prueba solo en tu navegador.</p>
          </div>
        )}

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
            {isDemoChosen() && (
              <>
                <p className="muted small">Tus cambios en la demo se guardan en este navegador.</p>
                <button type="button" className="btn btn-secondary" onClick={resetDemo}>
                  Empezar de cero
                </button>
                <button type="button" className="btn btn-secondary" onClick={exitDemo}>
                  Salir de la demo
                </button>
              </>
            )}
          </div>
        )}
      </form>

      {simulated && (
        <SimulatedProviderDialog
          provider={simulated}
          onAuthorize={() => finishSimulated(simulated, true)}
          onCancel={() => finishSimulated(simulated, false)}
          onClose={() => setSimulated(null)}
        />
      )}
    </div>
  )
}
