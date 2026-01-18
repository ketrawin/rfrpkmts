// Delegate socket handling to GameClient to centralize responsibilities
export function bindSocketEvents(params: { socket: any, uiController: any, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, gameClient: any }) {
  const { socket, uiController, canvas, ctx, gameClient } = params;
  if (gameClient && typeof gameClient.handleSocketEvents === 'function') {
    gameClient.handleSocketEvents(socket, uiController);
  }
}
