export interface NewGamePayload {
  starter: string;
  character: string;
  token?: string;
}

export interface NewGameSelection {
  starter: string;
  character: string;
}

export interface TokenUpdatePayload {
  token: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface ClientToServerEvents {
  newGame: (data: NewGamePayload) => void;
  register: (data: import('./auth').RegisterPayload) => void;
  login: (data: import('./auth').LoginCredentials) => void;
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
  player_update: (payload: { username: string; x: number; y: number; direction: number }) => void;
}
