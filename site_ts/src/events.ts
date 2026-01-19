// Delegate socket handling to GameClient to centralize responsibilities
export function bindSocketEvents(params: { socket: any, uiController: any, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, gameClient: any }) {
  const { socket, uiController, canvas, ctx, gameClient } = params;
  if (gameClient && typeof gameClient.handleSocketEvents === 'function') {
    gameClient.handleSocketEvents(socket, uiController);
  }
  // Ensure that when the server accepts a token we close title UI promptly
  try {
    socket.on('tokenUpdate_result', (data: any) => {
      try {
        if (data && data.result === 'success') {
          try { (window as any).pokemmo_ts = (window as any).pokemmo_ts || {}; (window as any).pokemmo_ts.gameStarted = true; } catch(e) {}
          try { if (uiController && typeof uiController.closeCurrent === 'function') uiController.closeCurrent(); } catch(e) {}
        }
      } catch(e) { console.warn('[bindSocketEvents] tokenUpdate_result handler failed', e); }
    });
  } catch(e) {}
}
