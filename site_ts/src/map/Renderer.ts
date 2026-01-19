import MapData, { Tileset, Layer } from './Map';

function createCache(map: MapData) {
  const canvas = document.createElement('canvas');
  canvas.width = map.width * map.tilewidth;
  canvas.height = map.height * map.tileheight;
  const ctx = canvas.getContext('2d')!;

  const tw = map.tilewidth;
  const th = map.tileheight;

  const layerDrawCounts: Array<{ id?: string | number; drawn: number }> = [];
  for (let li = 0; li < map.layers.length; li++) {
    const layer = map.layers[li];
    if (layer.type !== 'tilelayer') continue;
    if (layer.properties && (layer.properties.overchars === '1' || layer.properties.animated === '1')) continue;
    if (!layer.data) continue;

    const w = layer.width || map.width;
    const h = layer.height || map.height;

    let drawn = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const gid = layer.data[idx] || 0;
        if (!gid) continue;
        const ts = map.getTilesetOfTile(gid);
        if (!ts || !ts.image) continue;
        const local = gid - ts.firstgid;
        const numTilesX = Math.floor(ts.imagewidth / ts.tilewidth) || 1;
        const srcx = (local % numTilesX) * ts.tilewidth;
        const srcy = Math.floor(local / numTilesX) * ts.tileheight;
        ctx.drawImage(ts.image, srcx, srcy, ts.tilewidth, ts.tileheight, x * tw, y * th, tw, th);
        drawn++;
      }
    }
    layerDrawCounts.push({ id: layer.properties && layer.properties.name ? layer.properties.name : (layer as any).id || li, drawn });
  }

  map.cacheCanvas = canvas;
  map.cacheOffsetX = 0;
  map.cacheOffsetY = 0;
  try { console.log('[Renderer] cache created for', map.id, 'layerDrawCounts=', layerDrawCounts); } catch(e) {}
}

export function renderWithCache(map: MapData, ctx: CanvasRenderingContext2D) {
  // create cache if missing
  if (!map.cacheCanvas) createCache(map);
  if (map.cacheCanvas) {
    try {
      // only log when offset changes to avoid flooding the console
      const lastX = (map as any)._lastLoggedOffsetX;
      const lastY = (map as any)._lastLoggedOffsetY;
      if (lastX !== map.cacheOffsetX || lastY !== map.cacheOffsetY) {
        console.log('[Renderer] draw attempt: main canvas=', ctx.canvas ? ctx.canvas.width + 'x' + ctx.canvas.height : 'unknown', ' cache=', map.cacheCanvas.width + 'x' + map.cacheCanvas.height, 'offset=', map.cacheOffsetX + ',' + map.cacheOffsetY);
        (map as any)._lastLoggedOffsetX = map.cacheOffsetX;
        (map as any)._lastLoggedOffsetY = map.cacheOffsetY;
      }
      try { if (window && (window as any).pokemmo_ts) (window as any).pokemmo_ts.lastCacheCanvas = map.cacheCanvas; } catch(e) {}
    } catch(e) {}
    // no diagnostics here in normal mode
    // draw cache using identity transform to avoid any leftover transforms hiding the image
    try {
      ctx.save();
      if ((ctx as any).setTransform) {
        (ctx as any).setTransform(1,0,0,1,0,0);
      }
      // ensure compositing and alpha are fully opaque when blitting cache
      try { ctx.globalCompositeOperation = 'source-over'; } catch(e) {}
      try { ctx.globalAlpha = 1; } catch(e) {}
      // clear target area first (safe no-op if outside) then draw
      try { ctx.clearRect(map.cacheOffsetX, map.cacheOffsetY, map.cacheCanvas.width, map.cacheCanvas.height); } catch(e) {}
      try { ctx.drawImage(map.cacheCanvas, 0, 0, map.cacheCanvas.width, map.cacheCanvas.height, map.cacheOffsetX, map.cacheOffsetY, map.cacheCanvas.width, map.cacheCanvas.height); } catch(e) { console.warn('[Renderer] drawImage failed', e); }
      
    } finally {
      try { ctx.restore(); } catch(e) {}
    }
  }
}

export function renderOverchars(map: MapData, ctx: CanvasRenderingContext2D) {
  const tw = map.tilewidth;
  const th = map.tileheight;
  const offX = map.cacheOffsetX || 0;
  const offY = map.cacheOffsetY || 0;
  for (const layer of map.layers) {
    if (layer.type !== 'tilelayer') continue;
    if (!layer.properties || layer.properties.overchars !== '1') continue;
    if (!layer.data) continue;

    const w = layer.width || map.width;
    const h = layer.height || map.height;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const gid = layer.data[idx] || 0;
        if (!gid) continue;
        const ts = map.getTilesetOfTile(gid);
        if (!ts || !ts.image) continue;
        const local = gid - ts.firstgid;
        const numTilesX = Math.floor(ts.imagewidth / ts.tilewidth) || 1;
        const srcx = (local % numTilesX) * ts.tilewidth;
        const srcy = Math.floor(local / numTilesX) * ts.tileheight;
        ctx.drawImage(ts.image, srcx, srcy, ts.tilewidth, ts.tileheight, x * tw + offX, y * th + offY, tw, th);
      }
    }
  }
}

export function renderAnimated(map: MapData, ctx: CanvasRenderingContext2D) {
  // animated tiles are drawn from a special animated tileset image (legacy: Game.getRes('animatedTileset').obj)
  const animImg: HTMLImageElement | undefined = window.pokemmo_ts && window.pokemmo_ts.animatedTileset;
  if (!animImg) return;

  const tw = map.tilewidth;
  const th = map.tileheight;
  const offX = map.cacheOffsetX || 0;
  const offY = map.cacheOffsetY || 0;
  for (const layer of map.layers) {
    if (layer.type !== 'tilelayer') continue;
    if (!layer.data) continue;
    if (!layer.properties || layer.properties.animated !== '1') continue;

    const w = layer.width || map.width;
    const h = layer.height || map.height;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const gid = layer.data[idx] || 0;
        if (!gid) continue;
        const ts = map.getTilesetOfTile(gid);
        if (!ts) continue;
        const local = gid - ts.firstgid;
        const prop = ts.tileproperties[local];
        if (!prop || prop.animated == null) continue;

        const id = Number(prop.animated);
        const numFrames = Number(prop.numFrames) || 1;
        const animDelay = Number(prop.animDelay) || 0;

        // compute frame using global Renderer.numRTicks (legacy)
        const ticks = window.Renderer && window.Renderer.numRTicks || 0;
        const frame = Math.floor(((ticks + animDelay) / 8) % numFrames);

        const srcx = ts.tilewidth * frame;
        const srcy = id * ts.tileheight;

        if (!animImg.complete) continue;
        ctx.drawImage(animImg, srcx, srcy, ts.tilewidth, ts.tileheight, x * tw + offX, y * th + offY, tw, th);
      }
    }
  }
}

export function debugDrawSolidOverlay(map: MapData, ctx: CanvasRenderingContext2D) {
  if (!map || !map.dataLayer) return;
  const tw = map.tilewidth;
  const th = map.tileheight;
  const offX = map.cacheOffsetX || 0;
  const offY = map.cacheOffsetY || 0;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,0,0,0.9)';
  ctx.lineWidth = 2;
  ctx.fillStyle = 'rgba(255,0,0,0.15)';
  const w = map.dataLayer.width || map.width;
  const h = map.dataLayer.height || map.height;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      try {
        if (map.isTileSolid && map.isTileSolid(x, y)) {
          const rx = x * tw + offX;
          const ry = y * th + offY;
          ctx.fillRect(rx, ry, tw, th);
          ctx.strokeRect(rx + 0.5, ry + 0.5, tw - 1, th - 1);
        }
      } catch (e) {
        // ignore per-tile errors
      }
    }
  }
  ctx.restore();
}

export default renderWithCache;
