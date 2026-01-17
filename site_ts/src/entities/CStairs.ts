import CWarp from './CWarp';

export default class CStairs extends CWarp {
  fromDir: number = 0;
  constructor(name: string, x: number, y: number, direction: number, fromDir: number) {
    super(name, x, y);
    this.fromDir = fromDir;
    (this as any).direction = direction;
  }

  canWarp(chr: any) {
    return chr && chr.direction === this.fromDir;
  }
}
