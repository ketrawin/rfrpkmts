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
      socket?: any;
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
