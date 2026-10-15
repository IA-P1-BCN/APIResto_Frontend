import { useEffect, useRef, useState } from 'react'
import { MOCK_SOCIAL_USER } from '../api/mockAuth'
import { SOCIAL_LABEL, type SocialProvider } from '../api/social'
import Modal from './Modal'

const REDIRECT_MS = 700

const SCREEN: Record<SocialProvider, { domain: string; title: string; intro: string; permission: string; accept: string }> = {
  github: {
    domain: 'github.com',
    title: 'Autorizar APIResto',
    intro: 'APIResto quiere acceder a tu cuenta de GitHub.',
    permission: 'Leer tus direcciones de email (solo lectura)',
    accept: 'Autorizar',
  },
  google: {
    domain: 'accounts.google.com',
    title: 'Elige una cuenta',
    intro: 'para continuar en APIResto.',
    permission: 'Google compartirá tu nombre y tu dirección de email con APIResto.',
    accept: 'Continuar',
  },
}

interface Props {
  provider: SocialProvider
  onAuthorize: () => void
  onCancel: () => void
  onClose: () => void
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function SimulatedProviderDialog({ provider, onAuthorize, onCancel, onClose }: Props) {
  const [redirecting, setRedirecting] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const screen = SCREEN[provider]
  const label = SOCIAL_LABEL[provider]

  function authorize() {
    setRedirecting(true)
    timer.current = setTimeout(onAuthorize, REDIRECT_MS)
  }

  return (
    <Modal label={`Iniciar sesión con ${label} (simulado)`} onClose={onClose} narrow>
      <div className={`card provider-sim provider-sim-${provider}`}>
        <p className="provider-sim-tag">Simulación · en producción se abre {screen.domain}</p>
        <p className="provider-sim-brand">{label}</p>
        <h2>{screen.title}</h2>
        <p className="muted">{screen.intro}</p>

        <div className="provider-sim-account">
          <span className="provider-sim-avatar" aria-hidden="true">
            {initials(MOCK_SOCIAL_USER.name)}
          </span>
          <span>
            <strong>{MOCK_SOCIAL_USER.name}</strong>
            <br />
            <span className="muted small">{MOCK_SOCIAL_USER.email}</span>
          </span>
        </div>

        <p className="provider-sim-permission">{screen.permission}</p>

        {redirecting ? (
          <p className="muted" role="status">
            Volviendo a APIResto…
          </p>
        ) : (
          <div className="actions dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancelar
            </button>
            <button type="button" className="btn" onClick={authorize}>
              {screen.accept}
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
