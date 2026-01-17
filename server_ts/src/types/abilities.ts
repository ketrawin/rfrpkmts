import type { IPokemon, IMove } from './pokemon';

export type AbilityHookResult = { blocked?: boolean; reason?: string; reflect?: boolean; activate?: boolean; [key: string]: any };

export type ICombatant = Partial<IPokemon> & {
  hp?: number;
  maxHp?: number;
  moves?: Array<string | null>;
  movesPP?: number[];
  movesMaxPP?: number[];
  battleStats?: Record<string, any>;
  getAbilityName?: () => string;
  abilityName?: string;
  status?: number;
  gender?: string | number;
  pokemonId?: string | number;
  confused?: boolean;
  infatuated?: boolean;
  [key: string]: any;
};
