export function drawRoundedRect(ctx:CanvasRenderingContext2D, x:number, y:number, width:number, height:number, radius:number, color:string, alpha:number=1.0) {
  // Legacy implementation uses a temporary canvas to draw rounded rects with
  // strokeRect and fillRect then copies it to main canvas with alpha.
  const tmpKey = '__tmpRoundedCanvas';
  // create or reuse a tmp canvas attached to the function
  const funcMap = drawRoundedRect as unknown as Record<string, HTMLCanvasElement & { ctx?: CanvasRenderingContext2D }>;
  let tmp: HTMLCanvasElement & { ctx?: CanvasRenderingContext2D } = funcMap[tmpKey];
  if (!tmp) {
    tmp = document.createElement('canvas') as HTMLCanvasElement & { ctx?: CanvasRenderingContext2D };
    funcMap[tmpKey] = tmp;
  }
  tmp.width = Math.max(1, Math.ceil(width));
  tmp.height = Math.max(1, Math.ceil(height));
  const tctx = (tmp.getContext('2d') as CanvasRenderingContext2D);
  tctx.clearRect(0,0,tmp.width,tmp.height);
  tctx.save();
  tctx.lineJoin = 'round';
  tctx.lineWidth = radius;
  tctx.fillStyle = color;
  tctx.strokeStyle = color;
  // strokeRect and fillRect adjusted like legacy: stroke at radius/2
  tctx.strokeRect(radius/2, radius/2, tmp.width - radius, tmp.height - radius);
  tctx.fillRect(radius/2, radius/2, tmp.width - radius, tmp.height - radius);
  tctx.restore();
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, x, y, width, height);
  ctx.restore();
}

export function clamp(v:number, a:number, b:number) { return Math.max(a, Math.min(b, v)); }
