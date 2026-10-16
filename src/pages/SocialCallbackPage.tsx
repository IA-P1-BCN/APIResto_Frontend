import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { getErrorCode, getErrorMessage } from '../api/errors'
import { clearSocialState, readSocialState, SOCIAL_LABEL, socialLogin, type SocialProvider } from '../api/social'
import ThemeToggle from '../components/ThemeToggle'
import TwoFactorStep from '../components/TwoFactorStep'
import { useAuth } from '../context/useAuth'

type Check = { ok: true; provider: SocialProvider; code: string } | { ok: false; message: string }

const STATE_ERROR = 'No se ha podido comprobar el inicio de sesión. Vuelve a intentarlo desde la pantalla de login.'

function checkCallback(params: URLSearchParams): Check {
  const saved = readSocialState()
  if (!saved || params.get('state') !== saved.state) return { ok: false, message: STATE_ERROR }
  const label = SOCIAL_LABEL[saved.provider]
  const code = params.get('code')
  if (params.get('error') === 'access_denied') {
    return { ok: false, message: `Has cancelado el inicio de sesión con ${label}.` }
  }
  if (!code) return { ok: false, message: `${label} no ha completado el inicio de sesión. Vuelve a intentarlo.` }
  return { ok: true, provider: saved.provider, code }
}

function socialErrorMessage(error: unknown, provider: SocialProvider): string {
  const label = SOCIAL_LABEL[provider]
  switch (getErrorCode(error)) {
    case 'invalid_code':
      return `El inicio de sesión con ${label} ha caducado. Vuelve a intentarlo.`
    case 'email_not_verified':
      return `Tu cuenta de ${label} no tiene un email verificado. Verifícalo en ${label} o entra con tu email y contraseña.`
    case 'inactive_account':
      return 'Esta cuenta está desactivada. Habla con el restaurante.'
    case 'redirect_uri_not_allowed':
      return `Esta dirección de la app no está autorizada para entrar con ${label}.`
    case 'provider_unavailable':
      return `${label} no responde ahora mismo. Inténtalo en unos minutos.`
    case 'provider_not_configured':
      return `El inicio de sesión con ${label} todavía no está disponible.`
    default:
      return getErrorMessage(error)
  }
}

export default function SocialCallbackPage() {
  const [params] = useSearchParams()
  const { loginWithToken, status, user } = useAuth()
  const [check] = useState(() => checkCallback(params))
  const [error, setError] = useState<string | null>(null)
  const [mfaToken, setMfaToken] = useState<string | null>(null)
  const navigate = useNavigate()
  const started = useRef(false)

  useEffect(() => {
    if (!check.ok || started.current) return
    started.current = true
    clearSocialState()
    socialLogin(check.provider, check.code)
      .then((result) => ('mfaToken' in result ? setMfaToken(result.mfaToken) : loginWithToken(result.token)))
      .catch((err: unknown) => setError(socialErrorMessage(err, check.provider)))
  }, [check, loginWithToken])

  if (status === 'authenticated' && user) return <Navigate to="/" replace />

  if (mfaToken) {
    return (
      <div className="login-page">
        <ThemeToggle />
        <TwoFactorStep mfaToken={mfaToken} onCancel={() => navigate('/login')} />
      </div>
    )
  }

  const message = check.ok ? error : check.message

  return (
    <div className="login-page">
      <ThemeToggle />
      <div className="card login-card">
        <h1>🍽️ APIResto</h1>
        {message ? (
          <>
            <p className="form-error" role="alert">
              {message}
            </p>
            <Link className="btn" to="/login">
              Volver al inicio de sesión
            </Link>
          </>
        ) : (
          <p className="muted" role="status">
            Iniciando sesión con {check.ok ? SOCIAL_LABEL[check.provider] : ''}…
          </p>
        )}
      </div>
    </div>
  )
}
