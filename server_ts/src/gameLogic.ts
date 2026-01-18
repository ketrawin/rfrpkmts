import * as CharacterService from './services/character.service';
import { Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents } from './types/socketEvents';

export async function sendLoadMapForUser(socket: Socket<ClientToServerEvents, ServerToClientEvents>, username: string) {
  try {
    const char = await CharacterService.getCharacterForUser(username);
    if (!char) return;
    const mapName = (char.map || (char.respawnLocation && char.respawnLocation.mapName) || 'pallet') as string;
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
