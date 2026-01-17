export interface IMove {
  name: string;
  pp?: number;
  power?: number;
  type?: string;
  moveType?: string;
  [key: string]: any;
}

export interface IPokemon {
  id: number | string;
  level: number;
  shiny: boolean;
  experience: number;
  ivs?: Record<string, number>;
  moves?: Array<string | null> | IMove[];
  [key: string]: any;
}

export type IPlayerVars = Record<string, any>;
