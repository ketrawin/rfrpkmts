import Character, { ICharacter } from '../models/Character';
import { createStarterPokemonFromId } from '../pokemon';
import fs from 'fs';
import path from 'path';

export async function userHasCharacter(username: string): Promise<boolean> {
  const existing = await Character.findOne({ username }).lean().exec();
  return !!existing;
}

export async function createCharacterForUser(username: string, starterId: string, charType: string): Promise<ICharacter> {
  // default values (match legacy Haxe defaults)
  let defaultMap = 'pallet_hero_home_2f';
  let defaultX = 1;
  let defaultY = 3;
  let defaultDir = 0;

  // Validate and pick a safe spawn (non-solid) near the default location.
  async function findSafeSpawn(mapName: string, x: number, y: number) {
    try {
      const mapsDir = path.resolve(__dirname, '..', '..', 'site_ts', 'public', 'resources', 'maps');
      const mapPath = path.join(mapsDir, `${mapName}.json`);
      const raw = await fs.promises.readFile(mapPath, 'utf8');
      const j = JSON.parse(raw);
      const width = j.width;
      const layers = j.layers || [];

      // find data layer (explicit data_layer property or name 'data')
      const dataLayer = layers.find((l: any) => (l.properties && (l.properties.data_layer === '1' || l.properties.data_layer === 1)) || l.name === 'data');
      if (!dataLayer || !Array.isArray(dataLayer.data)) return { x, y };

      // build set of solid global tile ids from tilesets
      const solidGids = new Set<number>();
      (j.tilesets || []).forEach((ts: any) => {
        const first = Number(ts.firstgid || 0);
        const tileprops = ts.tileproperties || {};
        Object.keys(tileprops).forEach(k => {
          const prop = tileprops[k] || {};
          if (prop.solid == '1' || prop.solid === 1 || prop.solid === true || prop.solid === 'true') {
            const local = Number(k);
            solidGids.add(first + local);
          }
        });
      });

      const data = dataLayer.data;
      const isSolid = (tx: number, ty: number) => {
        if (tx < 0 || ty < 0 || tx >= width || ty >= j.height) return true;
        const idx = ty * width + tx;
        const gid = data[idx] || 0;
        if (!gid) return false;
        return solidGids.has(gid);
      };

      if (!isSolid(x, y)) return { x, y };

      // search nearby tiles (spiral / BFS radius up to 8)
      const maxR = 8;
      for (let r = 1; r <= maxR; r++) {
        for (let dx = -r; dx <= r; dx++) {
          for (let dy = -r; dy <= r; dy++) {
            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // perimeter only
            const nx = x + dx;
            const ny = y + dy;
            if (!isSolid(nx, ny)) return { x: nx, y: ny };
          }
        }
      }
      return { x, y };
    } catch (e) {
      const msg = (e && typeof e === 'object' && 'message' in e) ? (e as any).message : String(e);
      console.warn('[character.service] findSafeSpawn error', msg);
      return { x, y };
    }
  }

  const safe = await findSafeSpawn(defaultMap, defaultX, defaultY);
  console.log('[character.service] chosen spawn for', username, '=>', defaultMap, safe.x, safe.y);

  const save: Partial<ICharacter> = {
    username: username as any,
    map: defaultMap as any,
    x: safe.x as any,
    y: safe.y as any,
    direction: defaultDir as any,
    charType: charType as any,
    money: 0 as any,
    playerVars: {} as any,
    respawnLocation: { mapName: defaultMap, x: safe.x, y: safe.y, direction: defaultDir } as any,
    pokemon: [ createStarterPokemonFromId(starterId) ] as any
  };
  const doc = await Character.create(save as any);
  return doc as ICharacter;
}

export function getStarterOptions(starters: string[], characters: string[]) {
  return { starters, characters };
}

export async function getCharacterForUser(username: string): Promise<ICharacter | null> {
  const c = await Character.findOne({ username }).lean().exec();
  return c as any;
}

export async function updatePosition(username: string, x: number, y: number, direction: number): Promise<void> {
  await Character.findOneAndUpdate({ username }, { $set: { x, y, direction } }).exec();
}
