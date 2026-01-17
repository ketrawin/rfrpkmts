import mongoose, { Schema, Document } from 'mongoose';
import type { IPokemon, IPlayerVars } from '../types/pokemon';

export interface IRespawnLocation {
  mapName: string;
  x: number;
  y: number;
  direction: number;
}

export interface ICharacter extends Document {
  username: string;
  map: string;
  x: number;
  y: number;
  direction: number;
  charType: string;
  pokemon: IPokemon[];
  respawnLocation: IRespawnLocation;
  money: number;
  playerVars: IPlayerVars;
}

const RespawnSchema = new Schema<IRespawnLocation>({
  mapName: { type: String, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  direction: { type: Number, required: true }
}, { _id: false });

const CharacterSchema = new Schema<ICharacter>({
  username: { type: String, required: true, unique: true },
  map: { type: String, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  direction: { type: Number, required: true },
  charType: { type: String, required: true },
  pokemon: { type: Array as any, default: [] },
  respawnLocation: { type: RespawnSchema, required: true },
  money: { type: Number, default: 0 },
  playerVars: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true });

export default mongoose.model<ICharacter>('Character', CharacterSchema);
