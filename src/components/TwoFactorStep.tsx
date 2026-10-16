import { useState, type FormEvent } from 'react'
import { getErrorCode } from '../api/errors'
import { MOCK_TOTP_CODE } from '../api/mockAuth'
import { twoFactorErrorMessage, verifyTwoFactor } from '../api/twoFactor'
import { USE_MOCK } from '../config'
import { useAuth } from '../context/useAuth'

interface Props {
  mfaToken: string
  onCancel: () => void
}

export default function TwoFactorStep({ mfaToken, onCancel }: Props) {
  const { loginWithToken } = useAuth()
  const [recovery, setRecovery] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await loginWithToken(await verifyTwoFactor(mfaToken, code))
    } catch (err) {
      setExpired(getErrorCode(err) === 'invalid_mfa_token')
      setError(twoFactorErrorMessage(err))
      setCode('')
    } finally {
      setSubmitting(false)
    }
  }

  function toggleRecovery() {
    setRecovery((value) => !value)
    setCode('')
    setError(null)
  }

  return (
    <form className="card login-card" onSubmit={handleSubmit}>
      <h1>🍽️ APIResto</h1>
      <p className="muted">Verificación en dos pasos</p>
      <p className="small">
        {recovery
          ? 'Escribe uno de tus códigos de recuperación. Cada código solo sirve una vez.'
          : 'Escribe el código de 6 dígitos que muestra tu app de autenticación.'}
      </p>

      {recovery ? (
        <label>
          Código de recuperación
          <input
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            minLength={6}
            maxLength={32}
            required
            autoFocus
          />
        </label>
      ) : (
        <label>
          Código de verificación
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            title="6 dígitos"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            maxLength={6}
            required
            autoFocus
          />
        </label>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {!expired && (
        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? 'Comprobando…' : 'Verificar'}
        </button>
      )}
      {!expired && (
        <button type="button" className="btn btn-secondary" onClick={toggleRecovery}>
          {recovery ? 'Usar el código de la app' : 'Usar un código de recuperación'}
        </button>
      )}
      <button type="button" className="btn btn-secondary" onClick={onCancel}>
        Volver al inicio de sesión
      </button>

      {USE_MOCK && (
        <p className="muted small">
          Modo simulado · código <code>{MOCK_TOTP_CODE}</code>
        </p>
      )}
    </form>
  )
}
