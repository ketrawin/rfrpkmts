export interface NewGamePayload {
  starter: string;
  character: string;
  token?: string;
}

export interface TokenUpdatePayload {
  token?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  password: string;
  email?: string;
  challenge?: string;
  response?: string;
}

export interface ClientToServerEvents {
  newGame: (data: NewGamePayload) => void;
  register: (data: RegisterPayload) => void;
  login: (data: LoginCredentials) => void;
  tokenUpdate: (data: TokenUpdatePayload) => void;
}

export interface ServerToClientEvents {
  newGame_result: (payload: { result: string }) => void;
  registration: (payload: any) => void;
  login_result: (payload: any) => void;
  tokenUpdate_result: (payload: any) => void;
  startGame: (payload: { username: string }) => void;
  newGame: (payload: { username: string; starters: string[]; characters: string[] }) => void;
  loadMap: (payload: any) => void;
}
