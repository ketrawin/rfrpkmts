export default abstract class GameObject {
  x: number;
  y: number;
  renderPriority: number = 0;
  disable: boolean = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  tick(): void {}
  render(ctx: CanvasRenderingContext2D): void {}
}
