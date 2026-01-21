import * as CharacterService from './services/character.service';
import Character from './models/Character';
import fs from 'fs';
import path from 'path';
import { Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents } from './types/socketEvents';

export async function sendLoadMapForUser(socket: Socket<ClientToServerEvents, ServerToClientEvents>, username: string) {
  try {
    const char = await CharacterService.getCharacterForUser(username);
    if (!char) return;
    let mapName = (char.map || (char.respawnLocation && char.respawnLocation.mapName) || 'pallet') as string;

    // Validate persisted coords: if the saved x,y is solid on the map, find a nearby safe tile and persist it.
    try {
      const mapsDir = path.resolve(__dirname, '..', 'site_ts', 'public', 'resources', 'maps');
      const mapPath = path.join(mapsDir, `${mapName}.json`);
      if (fs.existsSync(mapPath)) {
        const raw = fs.readFileSync(mapPath, 'utf8');
        const j = JSON.parse(raw);
        const width = j.width;
        const layers = j.layers || [];
        const dataLayer = layers.find((l: any) => (l.properties && (l.properties.data_layer === '1' || l.properties.data_layer === 1)) || l.name === 'data');
        if (dataLayer && Array.isArray(dataLayer.data)) {
          const data = dataLayer.data;
          const solidGids = new Set<number>();
          (j.tilesets || []).forEach((ts: any) => {
            const first = Number(ts.firstgid || 0);
            const tileprops = ts.tileproperties || {};
            Object.keys(tileprops).forEach(k => {
              const prop = tileprops[k] || {};
              if (prop.solid == '1' || prop.solid === 1 || prop.solid === true || prop.solid === 'true') {
                solidGids.add(first + Number(k));
              }
            });
          });

          const isSolid = (tx: number, ty: number) => {
            if (tx < 0 || ty < 0 || tx >= width || ty >= j.height) return true;
            const idx = ty * width + tx;
            const gid = data[idx] || 0;
            if (!gid) return false;
            return solidGids.has(gid);
          };

          // Get spawn from map properties
          let spawnX = char.x;
          let spawnY = char.y;
          if (j.properties) {
            const sx = Number(j.properties.spawn_x || j.properties.start_x);
            const sy = Number(j.properties.spawn_y || j.properties.start_y);
            if (!isNaN(sx) && !isNaN(sy)) {
              spawnX = sx;
              spawnY = sy;
            }
          }

          if (isSolid(char.x, char.y)) {
            // Use map spawn if available and safe, else find nearby
            let found: { x: number; y: number } | null = { x: spawnX, y: spawnY };
            if (isSolid(found.x, found.y)) {
              // search nearby tiles up to radius 8
              const maxR = 8;
              found = null;
              for (let r = 1; r <= maxR && !found; r++) {
                for (let dx = -r; dx <= r && !found; dx++) {
                  for (let dy = -r; dy <= r && !found; dy++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                    const nx = char.x + dx;
                    const ny = char.y + dy;
                    if (!isSolid(nx, ny)) found = { x: nx, y: ny };
                  }
                }
              }
              if (!found) found = { x: spawnX, y: spawnY }; // fallback to spawn even if solid
            }
            if (found) {
              // persist fix
              await Character.findOneAndUpdate({ username }, { $set: { x: found.x, y: found.y, direction: char.direction, respawnLocation: { mapName, x: found.x, y: found.y, direction: char.direction } } }).exec();
              char.x = found.x;
              char.y = found.y;
              char.respawnLocation = { mapName, x: found.x, y: found.y, direction: char.direction } as any;
              console.log('[server_ts] corrected persisted spawn for', username, '->', found.x, found.y);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[server_ts] spawn validation error', err && (err as any).message);
    }
    const payload = {
      mapName,
      player: {
        username,
        x: char.x,
        y: char.y,
        direction: char.direction,
        respawnLocation: char.respawnLocation,
        pokemon: char.pokemon || []
      }
    };
    socket.emit('loadMap', payload);
  } catch (err) {
    console.error('[server_ts] sendLoadMapForUser error', err);
  }
}
