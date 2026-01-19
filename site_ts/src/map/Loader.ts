import MapData from './Map';
import ResourceManager from '../resources/ResourceManager';

export async function loadMap(id: string): Promise<MapData> {
  const url = 'resources/maps/' + id + '.json';
  try { console.log('[Loader] loading map json', url); } catch(e) {}
  const raw = await ResourceManager.loadJSON(url);
  const map = new MapData(id, raw);

  // load tileset images via ResourceManager
  await Promise.all(map.tilesets.map(ts => {
    if (ts.loaded || !ts.imageSrc) return Promise.resolve();
    return ResourceManager.loadImage('resources/' + ts.imageSrc).then(img => {
      ts.image = img;
      ts.loaded = true;
    }).catch(() => {
      ts.loaded = true;
    });
  }));

  // (tileset load debug removed)

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
    try {
      const img = await ResourceManager.loadImage('resources/tilesets/animated.png');
      if (!window.pokemmo_ts) window.pokemmo_ts = {} as any;
      window.pokemmo_ts!.animatedTileset = img;
    } catch (e) {
      // fallback: set an empty Image so legacy code doesn't break
      if (!window.pokemmo_ts) window.pokemmo_ts = {} as any;
      window.pokemmo_ts!.animatedTileset = undefined;
    }
  }

  // attach parsed map to global for convenience
  if (!window.pokemmo_ts) window.pokemmo_ts = {} as any;
  window.pokemmo_ts!.lastLoadedMap = map;

  return map;
}

export default loadMap;
