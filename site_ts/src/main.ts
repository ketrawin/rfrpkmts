import { initBootstrap } from './bootstrap';
import { bindSocketEvents } from './events';
import { UIController } from './uiController';
import renderWithCache, { renderAnimated, renderOverchars } from './map/Renderer';

const { canvas, ctx, socket, gameClient } = initBootstrap();

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
  if (pok && pok.map) {
    // advance global render tick counter early so tick/update logic uses the new frame id
    (window as any).Renderer = (window as any).Renderer || { numRTicks: 0 };
    (window as any).Renderer.numRTicks++;
    (window as any).__rafFrameCount = ((window as any).__rafFrameCount || 0) + 1;
    const fnum = (window as any).__rafFrameCount;

    // perform game logic / ticks before rendering to avoid rendering stale positions (reduces jitter)
    try { gameClient.updateUI(canvas, ctx); } catch(e) { console.warn('[main] updateUI error', e); }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // compute camera offsets (legacy behaviour from Haxe Renderer.getOffsetX/Y) based on updated char positions
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
          // Center camera on the character render position. Remove the legacy
          // "+1" offset which shifts the view left by one tile and causes a
          // persistent one-tile visual offset after reloads.
          const cameraX = renderX / map.tilewidth - (canvas.width / map.tilewidth) / 2;
          const cameraY = renderY / map.tileheight - (canvas.height / map.tileheight) / 2;
          // Use rounding (not floor) to avoid half-tile rendering shifts when
          // the camera fractional position should center the player.
          const offUnroundedX = map.tilewidth * -cameraX;
          const offUnroundedY = map.tileheight * -cameraY;
          map.cacheOffsetX = Math.round(offUnroundedX);
          map.cacheOffsetY = Math.round(offUnroundedY);
          // Optional detailed camera diagnostics when enabled by the debug flag
          try {
            const diagCam = (window as any).pokemmo_ts && (window as any).pokemmo_ts._diag_camera;
            if (diagCam) {
              console.log('[CameraDiag] render=(%d,%d) tile=(%d,%d) camera=(%d,%d) offUnrounded=(%d,%d) offRounded=(%d,%d) canvas=(%d,%d) cacheCanvas=(%s)',
                renderX, renderY, map.tilewidth, map.tileheight, cameraX, cameraY,
                Math.round(offUnroundedX*100)/100, Math.round(offUnroundedY*100)/100,
                map.cacheOffsetX, map.cacheOffsetY,
                canvas.width, canvas.height,
                map.cacheCanvas ? (map.cacheCanvas.width + 'x' + map.cacheCanvas.height) : 'none'
              );
            }
          } catch(e) {}
        }
      }
    } catch(e) { console.warn('[main] camera calc failed', e); }

    try {
      renderWithCache(pok.map, ctx);
      renderAnimated(pok.map, ctx);
      // optional debug: overlay solid tiles if requested
      try {
        const diagSolid = (window as any).pokemmo_ts && (window as any).pokemmo_ts._diag_showSolid;
        if (diagSolid) {
          const rd = require('./map/Renderer');
          if (rd && typeof rd.debugDrawSolidOverlay === 'function') rd.debugDrawSolidOverlay(pok.map, ctx);
        }
      } catch(e) {}
      if (gameClient) gameClient.renderObjects(ctx);
      renderOverchars(pok.map, ctx);
    } catch (e) { console.warn('[raf] render error', e); }
    // Auto-sync: if the GameClient has loaded a map but global pok.map isn't set,
    // assign it and close any open UI so the map becomes visible. This handles
    // race conditions where `startGame`/`loadMap` completed but the UI remained.
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
  }
  // (debug overlay removed)
      // per-frame UI updates
      try { gameClient.updateUI(canvas, ctx); } catch(e) {}
      try {
        const pk = (window as any).pokemmo_ts;
        // don't render title/menus if the game has started (they overwrite the game canvas)
        if (pk && pk.current && pk.current.render && !pk.gameStarted) pk.current.render();
      } catch(e) {}
      // (backup draw removed)
  // if map failed to load, draw diagnostics overlay
  try {
    const err = window.pokemmo_ts && (window.pokemmo_ts as any).mapError;
    if (err) {
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Map load error: ' + String(err), canvas.width/2, canvas.height/2);
      ctx.restore();
    }
  } catch(e) {}
  // (debug blit removed)
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
