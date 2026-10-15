import { isDemoChosen } from './api/demo'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || isDemoChosen()

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

export const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID ?? ''
