import { io } from 'socket.io-client';
import { UI } from './ui/UI';
import GameClient from './game/GameClient';
import { getToken, attachTokenToSocketOptions } from './auth';

export function initBootstrap() {
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  canvas.width = 800; canvas.height = 600;
  ctx.fillStyle = '#66BBFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const socketOpts = attachTokenToSocketOptions();
  const socket = io((window as any).API_BASE || 'http://localhost:2827', socketOpts);

  try {
    (socket as any).on('connect', () => console.log('[main] socket connected', socket.id, 'connected=', (socket as any).connected));
    (socket as any).on('disconnect', (reason: any) => console.log('[main] socket disconnected', reason, 'connected=', (socket as any).connected));
    (socket as any).on('connect_error', (err: any) => console.warn('[main] socket connect_error', err));
    (socket as any).on('reconnect_attempt', (n: number) => console.log('[main] socket reconnect_attempt', n));
  } catch (e) { console.warn('[main] socket lifecycle hook failed', e); }

  // preload some title assets used by screens
  const w: any = window;
  if (!w.TitleScreen) w.TitleScreen = {};
  w.TitleScreen.titleButtons = { obj: new Image() } as any;
  (w.TitleScreen.titleButtons.obj as HTMLImageElement).src = '/resources/ui/title_buttons.png';
  w.TitleScreen.titleLogo = { obj: new Image() } as any;
  (w.TitleScreen.titleLogo.obj as HTMLImageElement).src = '/resources/ui/title_logo.png';
  w.TitleScreen.loadingImg = { obj: new Image() } as any;
  (w.TitleScreen.loadingImg.obj as HTMLImageElement).src = '/resources/ui/loading.png';

  const gameClient = new GameClient();
  w.pokemmo_ts = { socket, UI, getToken, fetchWithAuth: w.fetchWithAuth, mapResultToMessage: w.mapResultToMessage, current: null, game: gameClient } as any;
  // ensure canvas does not show browser focus outline (we handle focus visuals in-canvas)
  try { canvas.style.outline = 'none'; canvas.style.boxShadow = 'none'; } catch(e) {}

  return { canvas, ctx, socket, gameClient };
}
