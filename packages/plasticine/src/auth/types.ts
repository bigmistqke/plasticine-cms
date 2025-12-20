import type { Component } from 'solid-js'

export interface User {
  login: string
  avatar_url: string
  name: string
}

export interface AuthResult {
  user: User
  token?: string
}

export interface AuthProvider {
  /** Check if authenticated (works with token or cookie) */
  checkAuth(): Promise<AuthResult | null>

  /** Clear auth state */
  logout(): Promise<void>

  /** Login screen component - each provider brings its own UI */
  LoginScreen: Component<{ onSuccess: (result: AuthResult) => void }>
}
