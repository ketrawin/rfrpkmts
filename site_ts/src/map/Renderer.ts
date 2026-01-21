import MapData, { Tileset, Layer } from './Map';

export function renderWithCache(map: MapData, ctx: CanvasRenderingContext2D) {
  const tw = map.tilewidth;
  const th = map.tileheight;
  const offX = map.cacheOffsetX || 0;
  const offY = map.cacheOffsetY || 0;

  // Render static layers directly, like original
  for (const layer of map.layers) {
    if (layer.type !== 'tilelayer') continue;
    if (layer.properties && (layer.properties.overchars === '1' || layer.properties.animated === '1')) continue;
    if (!layer.data) continue;

    const w = layer.width || map.width;
    const h = layer.height || map.height;

    // Calculate visible area, similar to original
    const startX = Math.max(0, Math.floor(-offX / tw) - layer.x);
    const startY = Math.max(0, Math.floor(-offY / th) - layer.y);
    const endX = Math.min(w, startX + Math.ceil(ctx.canvas.width / tw) + 2);
    const endY = Math.min(h, startY + Math.ceil(ctx.canvas.height / th) + 2);

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const idx = y * w + x;
        const gid = layer.data[idx] || 0;
        if (!gid) continue;
        const ts = map.getTilesetOfTile(gid);
        if (!ts || !ts.image) continue;
        const local = gid - ts.firstgid;
        const numTilesX = Math.floor(ts.imagewidth / ts.tilewidth) || 1;
        const srcx = (local % numTilesX) * ts.tilewidth;
        const srcy = Math.floor(local / numTilesX) * ts.tileheight;
        const dx = (x + layer.x) * tw + offX;
        const dy = (y + layer.y) * th + offY;
        ctx.drawImage(ts.image, srcx, srcy, ts.tilewidth, ts.tileheight, dx, dy, tw, th);
      }
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
        ctx.drawImage(ts.image, srcx, srcy, ts.tilewidth, ts.tileheight, x * tw + offX + layer.x * tw, y * th + offY + layer.y * th, tw, th);
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
        ctx.drawImage(animImg, srcx, srcy, ts.tilewidth, ts.tileheight, x * tw + offX + layer.x * tw, y * th + offY + layer.y * th, tw, th);
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
  for (let y = map.dataLayer.y; y < map.dataLayer.y + h; y++) {
    for (let x = map.dataLayer.x; x < map.dataLayer.x + w; x++) {
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
