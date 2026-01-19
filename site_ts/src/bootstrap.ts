import { io } from 'socket.io-client';
import { UI } from './ui/UI';
import GameClient from './game/GameClient';
import { getToken, attachTokenToSocketOptions } from './auth';
import ResourceManager from './resources/ResourceManager';

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
    try { (socket as any).onAny((event: string, ...args: any[]) => { try { console.log('[socket recv]', event, args && args.length === 1 ? args[0] : args); } catch(e) {} }); } catch(e) {}
  } catch (e) { console.warn('[main] socket lifecycle hook failed', e); }

  // preload some title assets used by screens via ResourceManager
  const w: any = window;
  if (!w.TitleScreen) w.TitleScreen = {};
  // create placeholders; ResourceManager will populate obj when loaded
  w.TitleScreen.titleButtons = { obj: null } as any;
  ResourceManager.loadImage('/resources/ui/title_buttons.png').then(img => { w.TitleScreen.titleButtons.obj = img; }).catch(()=>{});
  w.TitleScreen.titleLogo = { obj: null } as any;
  ResourceManager.loadImage('/resources/ui/title_logo.png').then(img => { w.TitleScreen.titleLogo.obj = img; }).catch(()=>{});
  w.TitleScreen.loadingImg = { obj: null } as any;
  ResourceManager.loadImage('/resources/ui/loading.png').then(img => { w.TitleScreen.loadingImg.obj = img; }).catch(()=>{});

  const gameClient = new GameClient();
  w.pokemmo_ts = { socket, UI, getToken, fetchWithAuth: w.fetchWithAuth, mapResultToMessage: w.mapResultToMessage, current: null, game: gameClient } as any;
  // ensure canvas does not show browser focus outline (we handle focus visuals in-canvas)
  try { canvas.style.outline = 'none'; canvas.style.boxShadow = 'none'; } catch(e) {}

  return { canvas, ctx, socket, gameClient };
}
