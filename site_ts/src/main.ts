import { initBootstrap } from './bootstrap';
import { bindSocketEvents } from './events';
import { UIController } from './uiController';

import renderWithCache, { renderAnimated, renderOverchars } from './map/Renderer';
import { PixiMapRenderer } from './map/PixiRenderer';


const { canvas, ctx, socket, gameClient } = initBootstrap();

// Ajout d'un conteneur PixiJS dans #app
const appDiv = document.getElementById('app');
let pixiRenderer: PixiMapRenderer | null = null;
let pixiRendererCreated = false;

// Restore debug overlay preference from localStorage so it survives reloads
try {
  (window as any).pokemmo_ts = (window as any).pokemmo_ts || {};
  const solidFlag = localStorage.getItem('pokemmo_debug_solid');
  if (solidFlag === '1') {
    (window as any).pokemmo_ts._diag = true;
    (window as any).pokemmo_ts._diag_showSolid = true;
  }
} catch (e) {}

const uiController = new UIController(canvas, ctx, socket as any);
bindSocketEvents({ socket, uiController, canvas, ctx, gameClient });
// expose uiController for debugging so we can reopen title UI after reloads
try { (window as any).pokemmo_ts = (window as any).pokemmo_ts || {}; (window as any).pokemmo_ts.uiController = uiController; } catch (e) {}

// Attach input event handlers to route to UI static methods
// Make canvas focusable for legacy keyboard interactions
try {
  canvas.tabIndex = canvas.tabIndex || 0;
} catch(e) {}

function clientXYFromEvent(ev: MouseEvent | Touch): {x:number,y:number} {
  const rect = canvas.getBoundingClientRect();
  return { x: Math.round((ev as any).clientX - rect.left), y: Math.round((ev as any).clientY - rect.top) };
}


canvas.addEventListener('mousedown', (ev: MouseEvent) => {
  try { const p = clientXYFromEvent(ev); window.pokemmo_ts?.UI?.onMouseDown(p.x, p.y); canvas.focus(); } catch(e) { console.warn('mousedown handler', e); }
});
canvas.addEventListener('mouseup', (ev: MouseEvent) => { try { const p = clientXYFromEvent(ev); window.pokemmo_ts?.UI?.onMouseUp(p.x, p.y); } catch(e) { console.warn('mouseup handler', e); } });
canvas.addEventListener('mousemove', (ev: MouseEvent) => { try { const p = clientXYFromEvent(ev); window.pokemmo_ts?.UI?.onMouseMove(p.x, p.y); } catch(e) { console.warn('mousemove handler', e); } });

canvas.addEventListener('touchstart', (ev: TouchEvent) => { try { if (ev.touches && ev.touches[0]) { const p = clientXYFromEvent(ev.touches[0]); window.pokemmo_ts?.UI?.onMouseDown(p.x, p.y); canvas.focus(); } ev.preventDefault(); } catch(e) { console.warn('touchstart handler', e); } }, { passive: false });
canvas.addEventListener('touchend', (ev: TouchEvent) => { try { if (ev.changedTouches && ev.changedTouches[0]) { const p = clientXYFromEvent(ev.changedTouches[0]); window.pokemmo_ts?.UI?.onMouseUp(p.x, p.y); } ev.preventDefault(); } catch(e) { console.warn('touchend handler', e); } }, { passive: false });
canvas.addEventListener('touchmove', (ev: TouchEvent) => { try { if (ev.touches && ev.touches[0]) { const p = clientXYFromEvent(ev.touches[0]); window.pokemmo_ts?.UI?.onMouseMove(p.x, p.y); } ev.preventDefault(); } catch(e) { console.warn('touchmove handler', e); } }, { passive: false });

document.addEventListener('keydown', (ev) => { try { window.pokemmo_ts?.UI?.onKeyDown(ev); } catch(e) { console.warn('keydown handler', e); } });
document.addEventListener('keypress', (ev) => { try { window.pokemmo_ts?.UI?.onKeyPress(ev); } catch(e) { console.warn('keypress handler', e); } });
document.addEventListener('keyup', (ev) => { try { window.pokemmo_ts?.UI?.onKeyUp(ev); } catch(e) { console.warn('keyup handler', e); } });



function _rafLoop() {
  const pok = window.pokemmo_ts;
  // Création de PixiRenderer uniquement après login (quand la map est chargée)
  if (pok && pok.map && appDiv && !pixiRendererCreated) {
    pixiRenderer = new PixiMapRenderer(800, 600, appDiv);
    pixiRendererCreated = true;
  }
  // Si la map est chargée (jeu lancé), on masque le canvas et on affiche la map avec PixiJS
  if (pok && pok.map && pixiRenderer) {
    canvas.style.display = 'none';
    (window as any).Renderer = (window as any).Renderer || { numRTicks: 0 };
    (window as any).Renderer.numRTicks++;
    (window as any).__rafFrameCount = ((window as any).__rafFrameCount || 0) + 1;
    const fnum = (window as any).__rafFrameCount;

    try { gameClient.updateUI(canvas, ctx); } catch(e) { console.warn('[main] updateUI error', e); }

    try {
      const g: any = pok.game || null;
      const map: any = pok.map;
      if (map && g) {
        let chr: any = null;
        if (typeof g.getPlayerChar === 'function') chr = g.getPlayerChar();
        if (!chr && g.player) chr = g.player;
        if (chr) {
          const renderX = (typeof chr.getRenderPosX === 'function') ? chr.getRenderPosX() : (Number(chr.x || 0) * map.tilewidth);
          const renderY = (typeof chr.getRenderPosY === 'function') ? chr.getRenderPosY() : (Number(chr.y || 0) * map.tileheight - 32);
          const cameraX = renderX / map.tilewidth - (800 / map.tilewidth) / 2;
          const cameraY = renderY / map.tileheight - (600 / map.tileheight) / 2;
          const offUnroundedX = map.tilewidth * -cameraX;
          const offUnroundedY = map.tileheight * -cameraY;
          map.cacheOffsetX = Math.round(offUnroundedX);
          map.cacheOffsetY = Math.round(offUnroundedY);
        }
      }
    } catch(e) { console.warn('[main] camera calc failed', e); }


    try {
      pixiRenderer.renderMap(pok.map, pok.map.cacheOffsetX, pok.map.cacheOffsetY);
      // Ajoute le rendu du joueur principal si disponible
      if (gameClient && gameClient.player) {
        pixiRenderer.renderPlayer(gameClient.player);
      }
    } catch (e) { console.warn('[raf] Pixi render error', e); }

    try {
      const global: any = (window as any).pokemmo_ts || {};
      if (global && global.game && global.game.map && !global.map) {
        try {
          if (global.current && typeof global.current.destroy === 'function') {
            global.current.destroy();
          }
        } catch(e) {}
        try { global.map = global.game.map; } catch(e) {}
        try { global.gameStarted = true; } catch(e) {}
        console.log('[main] auto-synced pokemmo_ts.map from game.map and closed UI');
      }
    } catch(e) {}
  } else {
    // Si le jeu n'est pas lancé, on affiche le canvas pour la UI/login
    canvas.style.display = '';
  }
  // per-frame UI updates
  try { gameClient.updateUI(canvas, ctx); } catch(e) {}
  try {
    const pk = (window as any).pokemmo_ts;
    if (pk && pk.current && pk.current.render && !pk.gameStarted) pk.current.render();
  } catch(e) {}
  // if map failed to load, draw diagnostics overlay (optionnel, sur le canvas d'origine)
  try {
    const err = window.pokemmo_ts && (window.pokemmo_ts as any).mapError;
    if (err) {
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Map load error: ' + String(err), canvas.width/2, canvas.height/2);
      ctx.restore();
    }
  } catch(e) {}
  (window as any).Renderer = (window as any).Renderer || { numRTicks: 0 };
  (window as any).Renderer.numRTicks++;
  requestAnimationFrame(_rafLoop);
}

// Only open the TitleScreen if the game hasn't started AND there is no loaded map.
// Increase delay slightly to avoid racing with async map loads.
setTimeout(() => {
  try {
    const pok = (window as any).pokemmo_ts;
    const gameStarted = !!(pok && pok.gameStarted);
    const hasMap = !!(pok && pok.map);
    if (!gameStarted && !hasMap) uiController.openTitle();
  } catch (e) {}
}, 800);
requestAnimationFrame(_rafLoop);
