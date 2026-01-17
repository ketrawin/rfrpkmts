export interface RegisterPayload {
  username: string;
  password: string;
  email: string;
  challenge?: string;
  response?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthUser {
  id: string;
  username: string;
}

export interface AuthResult {
  ok: boolean;
  user?: AuthUser;
  token?: string;
  errors?: string[];
  error?: string;
}
