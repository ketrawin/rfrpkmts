import CWarp from './CWarp';

export default class CWarpArrow extends CWarp {
  constructor(name: string, x: number, y: number) {
    super(name, x, y);
  }

  render(ctx: CanvasRenderingContext2D) {
    if (this.disable) return;
    const g = (window as any).pokemmo_ts && (window as any).pokemmo_ts.game;
    if (!g) return;
    const chr = g.getPlayerChar && g.getPlayerChar();
    if (!chr) return;
    if (Math.abs(chr.x - this.x) + Math.abs(chr.y - this.y) > 1) return;

    let dir;
    if (chr.x < this.x) dir = 0; // right mapping kept simple
    else if (chr.x > this.x) dir = 1;
    else if (chr.y < this.y) dir = 2;
    else dir = 3;

    // simple arrow rendering using misc sprite placeholder
    const img = (window as any).pokemmo_ts && (window as any).pokemmo_ts.titleButtons && (window as any).pokemmo_ts.titleButtons.obj;
    if (!img || !(img as HTMLImageElement).complete) return;
    const map: any = (window as any).pokemmo_ts && (window as any).pokemmo_ts.map;
    const offX = map && typeof map.cacheOffsetX === 'number' ? map.cacheOffsetX : 0;
    const offY = map && typeof map.cacheOffsetY === 'number' ? map.cacheOffsetY : 0;
    ctx.save();
    ctx.translate(this.x * 32 + 16 + offX, this.y * 32 + 16 + offY);
    ctx.rotate(Math.PI / 2 * dir);
    ctx.drawImage(img, 0, 32, 32, 32, -16, -16, 32, 32);
    ctx.restore();
  }
}
