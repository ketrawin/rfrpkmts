import { RegisterScreen } from "./screens/RegisterScreen";
import { TitleScreen } from "./screens/TitleScreen";
import NewGameScreen from "./screens/NewGameScreen";
import { io, Socket } from "socket.io-client";
import { getToken, fetchWithAuth, attachTokenToSocketOptions } from './auth';
import { UI } from "./ui/UI";
import { mapResultToMessage } from './i18n/messages';
import loadMap from './map/Loader';
import renderWithCache, { renderOverchars } from './map/Renderer';
import GameClient from './game/GameClient';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// Simple bootstrap: draw background and init RegisterScreen
// ensure canvas has legacy size and clear background
canvas.width = 800; canvas.height = 600;
ctx.fillStyle = '#66BBFF';
ctx.fillRect(0, 0, canvas.width, canvas.height);

// connect to local TS server (attach JWT if available for legacy-like auth)
const socketOpts = attachTokenToSocketOptions();
const socket: Socket = io('http://localhost:2827', socketOpts);
// log socket connection lifecycle for debugging
try {
	socket.on('connect', () => console.log('[main] socket connected', socket.id, 'connected=', socket.connected));
	socket.on('disconnect', (reason) => console.log('[main] socket disconnected', reason, 'connected=', socket.connected));
	socket.on('connect_error', (err) => console.warn('[main] socket connect_error', err));
	socket.on('reconnect_attempt', (n) => console.log('[main] socket reconnect_attempt', n));
} catch(e) { console.warn('[main] socket lifecycle hook failed', e); }

// load some assets into a global mock TitleScreen for legacy-like rendering
if (!window.TitleScreen) window.TitleScreen = {};
window.TitleScreen.titleButtons = { obj: new Image() };
const titleButtonsImg = window.TitleScreen.titleButtons.obj as HTMLImageElement;
titleButtonsImg.src = '/resources/ui/title_buttons.png';
window.TitleScreen.titleLogo = { obj: new Image() };
const titleLogoImg = window.TitleScreen.titleLogo.obj as HTMLImageElement;
titleLogoImg.src = '/resources/ui/title_logo.png';
window.TitleScreen.loadingImg = { obj: new Image() };
const loadingImg = window.TitleScreen.loadingImg.obj as HTMLImageElement;
loadingImg.src = '/resources/ui/loading.png';

// re-render when assets load so sprite/logo appear correctly
const imgs: HTMLImageElement[] = [ titleButtonsImg, titleLogoImg, loadingImg ];
let loaded = 0;

// current screen holds either TitleScreen or RegisterScreen instance
let currentScreen: any = null;

// simple legacy-like Renderer.numRTicks for sprite animation frames
(window as any).Renderer = (window as any).Renderer || { numRTicks: 0 };

function openRegisterFromTitle(titleInst?: any) {
	// create register screen and copy values from title
	if (currentScreen && currentScreen.destroy) currentScreen.destroy();
	// pass back callback and initial values from TitleScreen statics if available
	const init = { username: undefined as string | undefined, password: undefined as string | undefined };
	try {
		init.username = (TitleScreen as any).usernameTxt ? (TitleScreen as any).usernameTxt.value : undefined;
		init.password = (TitleScreen as any).passwordTxt ? (TitleScreen as any).passwordTxt.value : undefined;
	} catch (e) {}
	const reg = new RegisterScreen(canvas, ctx, socket, () => openTitle(), init);
	currentScreen = reg;
	window.pokemmo_ts = window.pokemmo_ts || {};
	window.pokemmo_ts.current = currentScreen;
	reg.render();
}

function openTitle() {
	if (currentScreen && currentScreen.destroy) currentScreen.destroy();
	const title = new TitleScreen(canvas, ctx, socket, () => openRegisterFromTitle(title));
	currentScreen = title;
	window.pokemmo_ts = window.pokemmo_ts || {};
	window.pokemmo_ts.current = currentScreen;
	title.render();
}

for (const im of imgs) {
  im.onload = () => { loaded++; if (loaded === imgs.length) { openTitle(); } };
  im.onerror = () => { console.warn('[main] image failed to load', im && (im as HTMLImageElement).src); loaded++; if (loaded === imgs.length) { openTitle(); } };
}

setTimeout(()=>{ if (loaded === imgs.length) return; openTitle(); }, 300);

// call after title is opened (images loaded) or after timeout
// NOTE: map loading is now driven by server via socket 'loadMap' (legacy flow).
// Removed the automatic preload to show map only after startGame/loadMap.

// forward input events to UI
canvas.addEventListener('mousedown', (e)=>{
	const r = canvas.getBoundingClientRect();
	UI.onMouseDown(e.clientX - r.left, e.clientY - r.top);
	if (currentScreen && currentScreen.render) currentScreen.render();
	// also attempt warp if clicking on a warp tile (quick test interaction)
	try {
		const pok: any = window.pokemmo_ts;
		if (pok && pok.game && pok.map) {
			const tx = Math.floor((e.clientX - r.left) / pok.map.tilewidth);
			const ty = Math.floor((e.clientY - r.top) / pok.map.tileheight);
			pok.game.tryUseWarp(tx, ty);
		}
	} catch (err) {}
});
canvas.addEventListener('mouseup', (e)=>{
	const r = canvas.getBoundingClientRect();
	UI.onMouseUp(e.clientX - r.left, e.clientY - r.top);
	if (currentScreen && currentScreen.render) currentScreen.render();
});
canvas.addEventListener('mousemove', (e)=>{
	const r = canvas.getBoundingClientRect();
	UI.onMouseMove(e.clientX - r.left, e.clientY - r.top);
	if (currentScreen && currentScreen.render) currentScreen.render();
});
window.addEventListener('keydown', (e)=>{ UI.onKeyDown(e); if (currentScreen && currentScreen.render) currentScreen.render(); });
window.addEventListener('keypress', (e)=>{ UI.onKeyPress(e); if (currentScreen && currentScreen.render) currentScreen.render(); });

// simple player movement binding (arrow keys) to move GameClient.player and trigger warps
window.addEventListener('keydown', (e) => {
	// ignore when typing in an input
	const active = document.activeElement;
	if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).isContentEditable)) return;
	const pok: any = (window as any).pokemmo_ts;
	if (!pok || !pok.game) return;

	let dir: number | null = null;
	switch (e.key) {
		case 'ArrowUp': dir = 2; break;
		case 'ArrowDown': dir = 0; break;
		case 'ArrowLeft': dir = 1; break;
		case 'ArrowRight': dir = 3; break;
		case 'w': dir = 2; break;
		case 's': dir = 0; break;
		case 'a': dir = 1; break;
		case 'd': dir = 3; break;
	}
	if (dir !== null) {
		const moved = pok.game.movePlayer(dir);
		if (moved) e.preventDefault();
	}
});

// Expose to window for quick debugging
// create and expose game client
const gameClient = new GameClient();
(window as any).pokemmo_ts = { socket, UI, getToken, fetchWithAuth, mapResultToMessage, current: null, game: gameClient };

// Server may ask client to show newGame selection after login
socket.on('newGame', (data: any) => {
	try {
		if (!data || !data.starters || !data.characters) return;
		if (currentScreen && currentScreen.destroy) currentScreen.destroy();
		const ng = new NewGameScreen(canvas, ctx, socket, data.starters, data.characters);
		currentScreen = ng;
		window.pokemmo_ts = window.pokemmo_ts || {};
		window.pokemmo_ts.current = currentScreen;
		ng.render();
	} catch (e) { console.warn('failed to open NewGameScreen', e); }
});

// server indicates startGame (can be used to switch UI)
socket.on('startGame', (data: any) => {
	try { console.log('[main] startGame', data); } catch(e) {}
	// hide current newGame UI if present
	try {
		if ((window as any).pokemmo_ts && (window as any).pokemmo_ts.current && (window as any).pokemmo_ts.current.destroy) (window as any).pokemmo_ts.current.destroy();
	} catch(e) {}
	// clear current screen references so RAF stops rendering UI and shows the game map
	try { currentScreen = null; if ((window as any).pokemmo_ts) (window as any).pokemmo_ts.current = null; } catch(e) {}
	try { console.log('[main] post-startGame window.pokemmo_ts.current', (window as any).pokemmo_ts && (window as any).pokemmo_ts.current); } catch(e) {}
});

// server instructs client to load a map by name and spawn player
socket.on('loadMap', (data: any) => {
	try {
		console.log('[main] loadMap payload', data);
		if (!data || !data.mapName) return;
		loadMap(data.mapName).then(m => {
			console.log('[main] map loaded from Loader', data.mapName, m);
			try {
				console.log('[main] tilesets', m.tilesets.map((t:any)=>({firstgid:t.firstgid, imageSrc: t.imageSrc, loaded: t.loaded, hasImage: !!t.image})));
			} catch(e){}
			(window as any).pokemmo_ts = (window as any).pokemmo_ts || {};
			(window as any).pokemmo_ts.map = m;
			renderWithCache(m, ctx);
			try { console.log('[main] post-loadMap window.pokemmo_ts.current', (window as any).pokemmo_ts && (window as any).pokemmo_ts.current); } catch(e) {}
			try { console.log('[main] map.cacheCanvas', !!m.cacheCanvas, m.cacheCanvas && {w: m.cacheCanvas.width, h: m.cacheCanvas.height}); } catch(e){}
			// set map on game client and spawn player
			const game: any = (window as any).pokemmo_ts.game;
			if (game && typeof game.setMap === 'function') {
				game.setMap(m);
				console.log('[main] game.setMap done, spawning player', data.player);
				try {
					if (data.player && game.player) {
						game.player.x = Number(data.player.x) || game.player.x;
						game.player.y = Number(data.player.y) || game.player.y;
						game.player.direction = Number(data.player.direction) || game.player.direction;
					}
				} catch (e) {}

					// compute cache offsets to center camera on player (legacy centers player)
					try {
						if (game.player && m) {
							// Pixel-based centering around player, with clamping and map-smaller-than-screen handling.
							const pxTile = Number(game.player.x) || 0;
							const pyTile = Number(game.player.y) || 0;
							const playerRenderX = pxTile * m.tilewidth + m.tilewidth / 2;
							const playerRenderY = pyTile * m.tileheight + m.tileheight / 2;
							// Default offset to center player
							let ox = Math.floor(canvas.width / 2 - playerRenderX);
							let oy = Math.floor(canvas.height / 2 - playerRenderY);
							// If cacheCanvas exists, clamp so map doesn't leave visible area
							if (m.cacheCanvas) {
								const cw = m.cacheCanvas.width;
								const ch = m.cacheCanvas.height;
								// If map smaller than canvas, center the whole map
								if (cw <= canvas.width) ox = Math.floor((canvas.width - cw) / 2);
								else {
									// clamp between right-most (canvas.width - cw) and 0
									ox = Math.max(canvas.width - cw, Math.min(0, ox));
								}
								if (ch <= canvas.height) oy = Math.floor((canvas.height - ch) / 2);
								else {
									oy = Math.max(canvas.height - ch, Math.min(0, oy));
								}
							}
							m.cacheOffsetX = ox;
							m.cacheOffsetY = oy;
							console.log('[main] computed centered cacheOffset', m.cacheOffsetX, m.cacheOffsetY, 'playerRender=', playerRenderX, playerRenderY);
						}
					} catch (e) { console.warn('[main] compute cacheOffset failed', e); }

					// instrumentation removed; normal runtime

					// background fallback removed; rendering will be done via canvas
			}
		}).catch((err)=>{ console.warn('[main] loadMap failed', err); });
	} catch (e) { console.warn('[main] loadMap handler error', e); }
});

// simple animation loop to drive caret blinking and smooth updates when an input is focused
function _rafLoop() {
	const pok: any = window.pokemmo_ts;
	// If a map is loaded, draw it each frame (static cache + animated tiles + overchars)
	if (pok && pok.map) {
		// debug frame counter (throttled logs to avoid console flood)
		(window as any).__rafFrameCount = ((window as any).__rafFrameCount || 0) + 1;
		const fnum = (window as any).__rafFrameCount;
		// clear canvas first
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		try {
			import('./map/Renderer').then(r => {
					r.renderWithCache(pok.map, ctx);
					r.renderAnimated(pok.map, ctx);
				// render game objects between animated and overchars
				if ((window as any).pokemmo_ts && (window as any).pokemmo_ts.game) (window as any).pokemmo_ts.game.renderObjects(ctx);
					r.renderOverchars(pok.map, ctx);
					// One-time diagnostic: read back a pixel from the main canvas where the cache was blitted
					try {
						if (pok.map && !(window as any).__mainCanvasDiagnostic) {
							try {
								const ox = Number(pok.map.cacheOffsetX) || 0;
								const oy = Number(pok.map.cacheOffsetY) || 0;
								const px = Math.max(0, Math.min(canvas.width-1, ox + 1));
								const py = Math.max(0, Math.min(canvas.height-1, oy + 1));
								const dat = ctx.getImageData(px, py, 1, 1).data;
								console.log('[main] main canvas pixel at blit pos', {px, py, rgba: dat, canvasEquals: ctx.canvas === document.getElementById('gameCanvas')});
							} catch(e) { console.warn('[main] read main canvas pixel failed', e); }
							(window as any).__mainCanvasDiagnostic = true;
						}
					} catch(e) {}
				// one-time visible test draw: draw first tile from first tileset at 0,0
				try {
					if (!(window as any).__mapTestDrawn) {
						const m = pok.map;
						if (m && m.tilesets && m.tilesets.length > 0) {
							const ts = m.tilesets[0];
							if (ts && ts.image && ts.image.complete) {
								ctx.drawImage(ts.image, 0, 0, ts.tilewidth, ts.tileheight, 0, 0, ts.tilewidth, ts.tileheight);
								(window as any).__mapTestDrawn = true;
							}
						}
					}
				} catch(e) {}
			}).catch((err)=>{ if (fnum % 60 === 0) console.warn('[raf] import/renderer error', err); });
		} catch (e) { console.warn('[raf] render error', e); }
	}
	// render current UI/screen on top
	if (pok && pok.current && pok.current.render) pok.current.render();
	// increment frame tick used by legacy sprite animations
	(window as any).Renderer.numRTicks++;
	// minimal: no heavy debug overlays in production/debug mode
	requestAnimationFrame(_rafLoop);
}
requestAnimationFrame(_rafLoop);
