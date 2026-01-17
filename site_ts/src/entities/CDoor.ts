import CWarp from './CWarp';
import GameObject from './GameObject';

export default class CDoor extends CWarp {
  openStep: number = 0;
  constructor(name: string, x: number, y: number) {
    super(name, x, y);
    this.renderPriority = 100;
    this.openStep = 0;
  }

  open() { this.openStep = 1; }

  render(ctx: CanvasRenderingContext2D) {
    if (this.disable) this.openStep = 0;
    if (this.openStep > 30) this.openStep = 0;
    // draw simple door tile from miscSprites if available
    const img = (window as any).pokemmo_ts && (window as any).pokemmo_ts.titleButtons && (window as any).pokemmo_ts.titleButtons.obj;
    if (img && (img as HTMLImageElement).complete) {
      const sx = 64;
      const sy = 32 * Math.min(Math.floor(this.openStep / 4), 3);
      ctx.drawImage(img, sx, sy, 32, 32, this.x * 32, this.y * 32, 32, 32);
    }
    if (this.openStep > 0) ++this.openStep;
  }
}
