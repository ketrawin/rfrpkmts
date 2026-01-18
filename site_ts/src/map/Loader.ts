import MapData from './Map';

export async function loadMap(id: string): Promise<MapData> {
  const resp = await fetch('resources/maps/' + id + '.json');
  if (!resp.ok) throw new Error('Failed to fetch map ' + id);
  const raw = await resp.json();
  const map = new MapData(id, raw);

  // wait for all tileset images to attempt to load (simple approach)
  await Promise.all(map.tilesets.map(ts => {
    return new Promise<void>(resolve => {
      if (ts.loaded) return resolve();
      if (!ts.image) return resolve();
      if (ts.image.complete) {
        ts.loaded = true; return resolve();
      }
      ts.image.onload = () => { ts.loaded = true; resolve(); };
      ts.image.onerror = () => { ts.loaded = true; resolve(); };
    });
  }));

  // ensure animated tiles resource exists (legacy uses resources/tilesets/animated.png)
  // create a global animated image resource if any tiles reference 'animated' property
  let needsAnimated = false;
  for (const ts of map.tilesets) {
    for (const p of ts.tileproperties) {
      if (p && (p as any).animated != null) { needsAnimated = true; break; }
    }
    if (needsAnimated) break;
  }
  if (needsAnimated) {
    const img = new Image();
    img.src = 'resources/tilesets/animated.png';
    // attach to window as legacy Game.getRes('animatedTileset') equivalent
    if (!window.pokemmo_ts) window.pokemmo_ts = {} as any;
    window.pokemmo_ts!.animatedTileset = img;
    // wait for it to attempt loading
    await new Promise<void>(r => { if (img.complete) r(); else { img.onload = () => r(); img.onerror = () => r(); } });
  }

  // attach parsed map to global for convenience
  if (!window.pokemmo_ts) window.pokemmo_ts = {} as any;
  window.pokemmo_ts!.lastLoadedMap = map;

  return map;
}

export default loadMap;
