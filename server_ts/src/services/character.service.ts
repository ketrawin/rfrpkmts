import Character, { ICharacter } from '../models/Character';
import { createStarterPokemonFromId } from '../pokemon';

export async function userHasCharacter(username: string): Promise<boolean> {
  const existing = await Character.findOne({ username }).lean().exec();
  return !!existing;
}

export async function createCharacterForUser(username: string, starterId: string, charType: string): Promise<ICharacter> {
  const save: Partial<ICharacter> = {
    username: username as any,
    map: 'pallet_hero_home_2f' as any,
    x: 1 as any,
    y: 3 as any,
    direction: 0 as any,
    charType: charType as any,
    money: 0 as any,
    playerVars: {} as any,
    respawnLocation: { mapName: 'pallet_hero_home_2f', x: 1, y: 3, direction: 0 } as any,
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
