import type { ClientToServerEvents, ServerToClientEvents } from './socketEvents';
import type { Socket } from 'socket.io-client';

declare global {
  interface Window {
    TitleScreen?: {
      titleButtons?: { obj?: CanvasImageSource };
      titleLogo?: { obj?: CanvasImageSource };
      loadingImg?: { obj?: CanvasImageSource };
    };
    __lastRegister?: { username?: string; password?: string };
    API_BASE?: string;
    pokemmo_ts?: {
      socket?: Socket<ServerToClientEvents, ClientToServerEvents> | undefined;
      UI?: any;
      getToken?: any;
      fetchWithAuth?: any;
      mapResultToMessage?: any;
      current?: any;
      _reconnectTimer?: any;
    };
    Renderer?: { numRTicks: number };
  }
}

export {};
