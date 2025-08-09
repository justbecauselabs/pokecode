export interface User {
  id: string
  email: string
  name?: string
}

export interface Tokens {
  accessToken: string
  refreshToken: string
}

export interface LoginData {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  name?: string
}

export interface AuthResponse {
  user: User
  tokens: Tokens
}