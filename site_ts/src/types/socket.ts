export interface LoginResult {
  result: 'success' | 'invalid_token' | 'login_failed' | string;
  token?: string;
}

export interface LoginResponse {
  result: string;
  token?: string;
  user?: { username?: string };
}

export interface RegistrationResult {
  result: 'success' | string;
}

export interface MeResponse {
  result: 'success' | 'invalid_token' | string;
  user?: { username?: string };
}
