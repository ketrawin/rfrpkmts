import { UI, UIButton } from '../ui/UI';
import { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/socketEvents';

export class NewGameScreen {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  starters: string[];
  chars: string[];

  pendingLoad: number = 0;
  startersFollowerImage: HTMLImageElement[] = [];
  startersSpriteImage: HTMLImageElement[] = [];
  charsImage: HTMLImageElement[] = [];
  border128: HTMLImageElement | null = null;
  arrowsImg: HTMLImageElement | null = null;

  curChar: number = 0;
  curStarter: number = 0;

  confirmBtn: UIButton | null = null;
  arrowPokLeft: UIButton | null = null;
  arrowPokRight: UIButton | null = null;
  arrowCharLeft: UIButton | null = null;
  arrowCharRight: UIButton | null = null;

  constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, socket: Socket<ServerToClientEvents, ClientToServerEvents>, starters: string[], chars: string[]) {
    this.canvas = canvas; this.ctx = ctx; this.socket = socket; this.starters = starters; this.chars = chars;

    this.pendingLoad = starters.length * 2 + chars.length + 2;
    this.curChar = Math.floor(Math.random() * chars.length);
    this.curStarter = Math.floor(Math.random() * starters.length);

    this.border128 = new Image(); this.border128.src = '/resources/ui/border_128.png'; this.border128.onload = ()=>this.onImageLoad(); this.border128.onerror = ()=>this.onImageLoad();
    this.arrowsImg = new Image(); this.arrowsImg.src = '/resources/ui/arrows.png'; this.arrowsImg.onload = ()=>this.onImageLoad(); this.arrowsImg.onerror = ()=>this.onImageLoad();

    for (const s of starters) {
      const f = new Image(); f.src = '/resources/followers/' + s + '.png'; f.onload = ()=>this.onImageLoad(); f.onerror = ()=>this.onImageLoad(); this.startersFollowerImage.push(f);
      const sp = new Image(); sp.src = '/resources/sprites/' + s + '.png'; sp.onload = ()=>this.onImageLoad(); sp.onerror = ()=>this.onImageLoad(); this.startersSpriteImage.push(sp);
    }
    for (const c of chars) {
      const ci = new Image(); ci.src = '/resources/chars/' + c + '.png'; ci.onload = ()=>this.onImageLoad(); ci.onerror = ()=>this.onImageLoad(); this.charsImage.push(ci);
    }

    // create buttons
    this.confirmBtn = new UIButton(340, 490, 130, 30, '');
    const tb = window.TitleScreen?.titleButtons?.obj;
    this.confirmBtn.draw = (ctx: CanvasRenderingContext2D) => {
      if (tb && tb.complete) {
        try { ctx.drawImage(tb, 200, 0, 150, 50, this.confirmBtn!.x - 15, this.confirmBtn!.y - 15, 150, 50); return; } catch(e) {}
      }
      ctx.save(); ctx.fillStyle='#4CAF50'; ctx.fillRect(this.confirmBtn!.x,this.confirmBtn!.y,this.confirmBtn!.w,this.confirmBtn!.h); ctx.restore();
    };
    this.confirmBtn.onSubmit = ()=>this.onConfirm();
    UI.pushInput(this.confirmBtn);

    const createArrow = (x:number,y:number,dir:number,fn:()=>void) => {
      const arrow = new UIButton(x,y,32,32,'');
      arrow.draw = (ctx)=>{
        if (this.arrowsImg && this.arrowsImg.complete) {
          try { ctx.drawImage(this.arrowsImg, dir*32, 0, 32, 32, arrow.x, arrow.y, 32, 32); return; } catch(e) {}
        }
        ctx.save(); ctx.fillStyle='#888'; ctx.fillRect(arrow.x,arrow.y,arrow.w,arrow.h); ctx.restore();
      };
      arrow.onSubmit = fn;
      UI.pushInput(arrow);
      return arrow;
    };

    // arrows positioned as in legacy
    // use legacy arrow frame indices: 1 = left, 3 = right (matches Haxe compiled client)
    this.arrowPokLeft = createArrow(260, 430, 1, ()=>{ if (--this.curStarter < 0) this.curStarter += this.starters.length; this.render(); });
    this.arrowPokRight = createArrow(305, 430, 3, ()=>{ if (++this.curStarter >= this.starters.length) this.curStarter -= this.starters.length; this.render(); });
    this.arrowCharLeft = createArrow(468, 430, 1, ()=>{ if (--this.curChar < 0) this.curChar += this.chars.length; this.render(); });
    this.arrowCharRight = createArrow(513, 430, 3, ()=>{ if (++this.curChar >= this.chars.length) this.curChar -= this.chars.length; this.render(); });
  }

  onImageLoad() { if (--this.pendingLoad <= 0) this.render(); }

  onConfirm() {
    // log and emit BEFORE destroying inputs so we can observe emit timing
    try {
      console.log('[NewGameScreen] onConfirm emit newGame', { starter: this.starters[this.curStarter], character: this.chars[this.curChar] });
    } catch (e) {}
    try {
      // prefer explicit socket, fallback to global pokemmo_ts.socket
      const s = this.socket || window.pokemmo_ts?.socket;
      if (s && typeof s.emit === 'function') {
        const token = window.pokemmo_ts?.getToken ? window.pokemmo_ts.getToken() : null;
        s.emit('newGame', { starter: this.starters[this.curStarter], character: this.chars[this.curChar], token: token ?? undefined });
      } else {
        console.warn('emit newGame failed: socket not available');
      }
    } catch(e) { console.warn('emit newGame failed', e); }
    // destroy UI after emission and show loading panel until server responds
    this.destroy();
    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    this.ctx.fillStyle = '#000'; this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
    this.ctx.fillStyle = '#fff'; this.ctx.font = '16px Font3'; this.ctx.textAlign = 'center'; this.ctx.fillText('Starting game...', this.canvas.width/2, this.canvas.height/2);
  }

  destroy() {
    if (this.confirmBtn) UI.removeInput(this.confirmBtn);
    if (this.arrowPokLeft) UI.removeInput(this.arrowPokLeft);
    if (this.arrowPokRight) UI.removeInput(this.arrowPokRight);
    if (this.arrowCharLeft) UI.removeInput(this.arrowCharLeft);
    if (this.arrowCharRight) UI.removeInput(this.arrowCharRight);
  }

  render() {
    const ctx = this.ctx; const canvas = this.canvas;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if (this.pendingLoad > 0) {
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = '#fff'; ctx.font = '12pt Courier New'; ctx.fillText('Loading... '+this.pendingLoad, 10, 30);
      return;
    }
    ctx.save();
    const logo = window.TitleScreen?.titleLogo?.obj;
    if (logo && logo.complete) try { ctx.drawImage(logo, 117, 80); } catch(e) {}
    ctx.fillStyle = '#000'; ctx.font = '21px Font3'; ctx.textAlign = 'center'; ctx.fillText('Choose your character and starter Pokémon', 400, 250);
    // draw borders at legacy positions
    if (this.border128 && this.border128.complete) { try { ctx.drawImage(this.border128, 200, 250); ctx.drawImage(this.border128, 408, 250); } catch(e) {} }
    // draw starter sprite at legacy coords
    const POKEMON_W = 64, POKEMON_H = 64;
    const CHAR_W = 32, CHAR_H = 64;
    const DIR_RIGHT = 3;
    const ssp = this.startersSpriteImage[this.curStarter];
    if (ssp && ssp.complete) try { ctx.drawImage(ssp, 232, 282); } catch(e) {}
    const sf = this.startersFollowerImage[this.curStarter];
    if (sf && sf.complete) {
      try {
        const rt = window.Renderer && window.Renderer.numRTicks ? window.Renderer.numRTicks : 0;
        const rtSlow = Math.floor(rt / 3); // slow down animation (3x)
        const srcX = DIR_RIGHT * POKEMON_W;
        const srcY = Math.floor((rtSlow % 10) / 5) * POKEMON_H;
        ctx.drawImage(sf, srcX, srcY, POKEMON_W, POKEMON_H, 449, 302, POKEMON_W, POKEMON_H);
      } catch(e) {}
    }
    const ci = this.charsImage[this.curChar];
    if (ci && ci.complete) {
      try {
        const rt = window.Renderer && window.Renderer.numRTicks ? window.Renderer.numRTicks : 0;
        const rtSlowC = Math.floor(rt / 3);
        const srcX = DIR_RIGHT * CHAR_W;
        const srcY = Math.floor(((rtSlowC + 3) % 20) / 5) * CHAR_H;
        ctx.drawImage(ci, srcX, srcY, CHAR_W, CHAR_H, 508, 302, CHAR_W, CHAR_H);
      } catch(e) {}
    }
    ctx.restore();
    // draw UI buttons
    if (this.confirmBtn) this.confirmBtn.draw(ctx as any);
    if (this.arrowPokLeft) this.arrowPokLeft.draw(ctx as any);
    if (this.arrowPokRight) this.arrowPokRight.draw(ctx as any);
    if (this.arrowCharLeft) this.arrowCharLeft.draw(ctx as any);
    if (this.arrowCharRight) this.arrowCharRight.draw(ctx as any);
  }
}

export default NewGameScreen;
