import { useState, type FormEvent } from 'react'
import { MOCK_TOTP_CODE } from '../api/mockAuth'
import {
  disableTwoFactor,
  enableTwoFactor,
  getTwoFactorStatus,
  setupTwoFactor,
  svgDataUrl,
  twoFactorErrorMessage,
} from '../api/twoFactor'
import type { TwoFactorSetup } from '../api/types'
import ErrorMessage from '../components/ErrorMessage'
import { USE_MOCK } from '../config'
import { useQuery } from '../hooks/useQuery'

function CodeInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      {label}
      <input autoComplete="one-time-code" value={value} onChange={(e) => onChange(e.target.value)} maxLength={32} required />
    </label>
  )
}

export default function SecurityPage() {
  const { data: status, error: loadError, loading, reload } = useQuery(getTwoFactorStatus)
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  async function run(action: () => Promise<void>) {
    setError(null)
    setBusy(true)
    try {
      await action()
    } catch (err) {
      setError(twoFactorErrorMessage(err))
    } finally {
      setCode('')
      setBusy(false)
    }
  }

  function startSetup() {
    void run(async () => setSetup(await setupTwoFactor()))
  }

  function handleEnable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(async () => {
      setRecoveryCodes(await enableTwoFactor(code))
      setSetup(null)
    })
  }

  function handleDisable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(async () => {
      await disableTwoFactor(code)
      reload()
    })
  }

  function cancelSetup() {
    setSetup(null)
    setCode('')
    setError(null)
  }

  function finishCodes() {
    setRecoveryCodes(null)
    setCopied(false)
    reload()
  }

  async function copyCodes(codes: string[]) {
    try {
      await navigator.clipboard.writeText(codes.join('\n'))
      setCopied(true)
    } catch {
      setError('No se han podido copiar. Apúntalos a mano.')
    }
  }

  const formError = error && (
    <p className="form-error" role="alert">
      {error}
    </p>
  )

  function content() {
    if (recoveryCodes) {
      return (
        <section className="card two-factor">
          <h2>Guarda tus códigos de recuperación</h2>
          <p className="banner banner-success" role="status">
            Verificación en dos pasos activada.
          </p>
          <p>
            Si pierdes el móvil, entra con uno de estos códigos. Cada uno sirve una sola vez y no se volverán a
            mostrar: guárdalos en un lugar seguro.
          </p>
          <ul className="recovery-codes" aria-label="Códigos de recuperación">
            {recoveryCodes.map((c) => (
              <li key={c}>
                <code>{c}</code>
              </li>
            ))}
          </ul>
          {formError}
          <div className="actions">
            <button type="button" className="btn btn-secondary" onClick={() => void copyCodes(recoveryCodes)}>
              {copied ? 'Copiados' : 'Copiar'}
            </button>
            <button type="button" className="btn" onClick={finishCodes}>
              Ya los he guardado
            </button>
          </div>
        </section>
      )
    }

    if (setup) {
      return (
        <form className="card two-factor" onSubmit={handleEnable}>
          <h2>Activar la verificación en dos pasos</h2>
          <ol>
            <li>Abre una app de autenticación (Google Authenticator, Microsoft Authenticator, Authy…).</li>
            <li>Escanea este código QR:</li>
          </ol>
          <img className="two-factor-qr" src={svgDataUrl(setup.qr_svg)} alt="Código QR para la app de autenticación" />
          <p className="small">
            ¿No puedes escanearlo? Escribe esta clave en la app: <code className="two-factor-secret">{setup.secret}</code>
          </p>
          <CodeInput label="Código de 6 dígitos de la app" value={code} onChange={setCode} />
          {formError}
          <div className="actions">
            <button type="submit" className="btn" disabled={busy}>
              {busy ? 'Activando…' : 'Activar'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={cancelSetup}>
              Cancelar
            </button>
          </div>
        </form>
      )
    }

    if (status?.enabled) {
      return (
        <form className="card two-factor" onSubmit={handleDisable}>
          <p className="banner banner-success" role="status">
            Activada. Al entrar se te pide un código de la app.
          </p>
          <p>
            Te quedan <strong>{status.recovery_codes_left}</strong> códigos de recuperación.
          </p>
          <h2>Desactivar</h2>
          <CodeInput label="Código de la app o de recuperación" value={code} onChange={setCode} />
          {formError}
          <div className="actions">
            <button type="submit" className="btn btn-secondary" disabled={busy}>
              {busy ? 'Desactivando…' : 'Desactivar'}
            </button>
          </div>
        </form>
      )
    }

    return (
      <section className="card two-factor">
        <p>
          <strong>Desactivada.</strong> Con la verificación en dos pasos, además de la contraseña (o de Google o
          GitHub) se pide un código de tu móvil para entrar.
        </p>
        {formError}
        <div className="actions">
          <button type="button" className="btn" onClick={startSetup} disabled={busy}>
            {busy ? 'Preparando…' : 'Activar'}
          </button>
        </div>
      </section>
    )
  }

  return (
    <>
      <h1>Seguridad</h1>
      <p className="muted">Verificación en dos pasos con una app de autenticación</p>
      {loading && <p className="muted">Cargando…</p>}
      {loadError && <ErrorMessage message={loadError} onRetry={reload} />}
      {!loading && !loadError && content()}
      {USE_MOCK && (
        <p className="muted small">
          Modo simulado · el código de la app es siempre <code>{MOCK_TOTP_CODE}</code>
        </p>
      )}
    </>
  )
}
