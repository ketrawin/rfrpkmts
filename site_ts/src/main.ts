import { initBootstrap } from './bootstrap';
import { bindSocketEvents } from './events';
import { UIController } from './uiController';

const { canvas, ctx, socket, gameClient } = initBootstrap();

const uiController = new UIController(canvas, ctx, socket as any);
bindSocketEvents({ socket, uiController, canvas, ctx, gameClient });

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

function _rafLoop() {
  const pok = window.pokemmo_ts;
  if (pok && pok.map) {
    (window as any).__rafFrameCount = ((window as any).__rafFrameCount || 0) + 1;
    const fnum = (window as any).__rafFrameCount;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    try {
      import('./map/Renderer').then(r => {
        r.renderWithCache(pok.map, ctx);
        r.renderAnimated(pok.map, ctx);
            if (gameClient) gameClient.renderObjects(ctx);
        r.renderOverchars(pok.map, ctx);
      }).catch((err)=>{ if (fnum % 60 === 0) console.warn('[raf] import/renderer error', err); });
    } catch (e) { console.warn('[raf] render error', e); }
  }
      // per-frame UI updates
      try { gameClient.updateUI(canvas, ctx); } catch(e) {}
      if (window.pokemmo_ts && window.pokemmo_ts.current && window.pokemmo_ts.current.render) window.pokemmo_ts.current.render();
  (window as any).Renderer = (window as any).Renderer || { numRTicks: 0 };
  (window as any).Renderer.numRTicks++;
  requestAnimationFrame(_rafLoop);
}

setTimeout(() => { try { uiController.openTitle(); } catch (e) {} }, 300);
requestAnimationFrame(_rafLoop);
