import GameObject from './GameObject';

export default class CWarp extends GameObject {
  name: string;
  constructor(name: string, x: number, y: number) {
    super(x, y);
    this.name = name;
    this.disable = false;
  }

  canWarp(obj?: any): boolean { return true; }

  static getWarpAt(x: number, y: number): CWarp | null {
    const g = (window as any).pokemmo_ts && (window as any).pokemmo_ts.game;
    if (!g) return null;
    for (const o of g.gameObjects) {
      if (o.x === x && o.y === y && o instanceof CWarp) return o;
    }
    return null;
  }

  static getWarpByName(name: string): CWarp | null {
    const g = (window as any).pokemmo_ts && (window as any).pokemmo_ts.game;
    if (!g) return null;
    for (const o of g.gameObjects) {
      if (o instanceof CWarp && (o as any).name === name) return o as CWarp;
    }
    return null;
  }
}
