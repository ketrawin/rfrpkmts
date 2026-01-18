import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from './socketEvents';
import type GameClient from '../game/GameClient';
import type { UI } from '../ui/UI';

declare global {
  interface PokemmoWindow {
    socket?: Socket<ServerToClientEvents, ClientToServerEvents>;
    UI?: typeof UI;
    getToken?: () => string | null;
    fetchWithAuth?: typeof fetch;
    mapResultToMessage?: (r: any) => string;
    current?: { render?: () => void; destroy?: () => void; player?: any; currentUsername?: string } | null;
    game?: GameClient | null;
    map?: any;
    animatedTileset?: HTMLImageElement;
    lastLoadedMap?: any;
  }

  interface Window {
    pokemmo_ts?: PokemmoWindow;
    TitleScreen?: any;
    Renderer?: { numRTicks: number } | any;
  }
}

export {};
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
