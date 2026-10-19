import { GITHUB_CLIENT_ID, GOOGLE_CLIENT_ID, USE_MOCK } from '../config'
import { toLoginResult, type LoginResult } from './auth'
import { api } from './client'
import { mockAuth } from './mockAuth'
import type { LoginResponse, TwoFactorChallenge } from './types'

export type SocialProvider = 'google' | 'github'

export const SOCIAL_PROVIDERS: SocialProvider[] = ['google', 'github']

export const SOCIAL_LABEL: Record<SocialProvider, string> = { google: 'Google', github: 'GitHub' }

const AUTHORIZE: Record<SocialProvider, { url: string; scope: string }> = {
  google: { url: 'https://accounts.google.com/o/oauth2/v2/auth', scope: 'openid email profile' },
  github: { url: 'https://github.com/login/oauth/authorize', scope: 'user:email' },
}

const STATE_KEY = 'restoapi.oauth'

export const CALLBACK_PATH = '/auth/callback'

export function callbackUrl(): string {
  return `${window.location.origin}${CALLBACK_PATH}`
}

function clientId(provider: SocialProvider): string {
  return (provider === 'google' ? GOOGLE_CLIENT_ID : GITHUB_CLIENT_ID) ?? ''
}

export function availableProviders(): SocialProvider[] {
  return USE_MOCK ? SOCIAL_PROVIDERS : SOCIAL_PROVIDERS.filter((p) => clientId(p))
}

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function socialLoginUrl(provider: SocialProvider): string {
  const state = randomState()
  sessionStorage.setItem(STATE_KEY, JSON.stringify({ provider, state }))
  if (USE_MOCK) return `${CALLBACK_PATH}?${new URLSearchParams({ code: 'mock-code', state })}`
  const params = new URLSearchParams({
    client_id: clientId(provider),
    redirect_uri: callbackUrl(),
    response_type: 'code',
    scope: AUTHORIZE[provider].scope,
    state,
  })
  if (provider === 'google') params.set('prompt', 'select_account')
  return `${AUTHORIZE[provider].url}?${params}`
}

export function clearSocialState(): void {
  sessionStorage.removeItem(STATE_KEY)
}

export function readSocialState(): { provider: SocialProvider; state: string } | null {
  const raw = sessionStorage.getItem(STATE_KEY)
  try {
    const value = JSON.parse(raw ?? 'null') as { provider?: string; state?: string } | null
    if (!value?.state || !SOCIAL_PROVIDERS.includes(value.provider as SocialProvider)) return null
    return { provider: value.provider as SocialProvider, state: value.state }
  } catch {
    return null
  }
}

export async function socialLogin(provider: SocialProvider, code: string): Promise<LoginResult> {
  if (USE_MOCK) return mockAuth.socialLogin(provider, code)
  const { data } = await api.post<LoginResponse | TwoFactorChallenge>(`/auth/social/${provider}`, {
    code,
    redirect_uri: callbackUrl(),
  })
  return toLoginResult(data)
}
