import { drawRoundedRect } from '../util/Util';
export type UIInput = TextInput | UIButton;

export class UI {
  static inputs: UIInput[] = [];
  static focused: TextInput | null = null;
  static enterHooks: Array<() => void> = [];

  static pushInput(i: UIInput) { this.inputs.push(i); }
  static removeInput(i: UIInput) { this.inputs = this.inputs.filter(x=>x!==i); if(this.focused===i) this.focused = null; }

  static onMouseDown(x:number,y:number) {
    for (let i = this.inputs.length-1;i>=0;--i) {
      const inp = this.inputs[i];
      if ('hitTest' in inp && inp.hitTest(x,y)) {
        // if clicking a TextInput, ensure any previous focused input is unfocused
        if (inp instanceof TextInput) {
          if (this.focused && this.focused !== inp) {
            this.focused.focused = false;
          }
          this.focused = inp;
          inp.focused = true;
        } else {
          // clicking a non-text control should remove focus from any TextInput
          if (this.focused) { this.focused.focused = false; this.focused = null; }
        }
        if (inp instanceof UIButton) { inp.isDown = true; }
        return;
      }
    }
    if (this.focused) { this.focused.focused = false; this.focused = null; }
  }

  static onMouseUp(x:number,y:number) {
    for (let i = this.inputs.length-1;i>=0;--i) {
      const inp = this.inputs[i];
      if (inp instanceof UIButton) {
        if (inp.isDown && inp.hitTest(x,y)) inp.onClick();
        inp.isDown = false;
      }
    }
  }

  static onMouseMove(x:number,y:number) {
    for (let i = 0;i<this.inputs.length;++i) {
      const inp = this.inputs[i];
      if (inp instanceof UIButton) {
        inp.isHover = inp.hitTest(x,y);
      }
    }
    // update cursor when hovering any enabled button
    const hoveringButton = this.inputs.some(i => i instanceof UIButton && (i as UIButton).isHover && !(i as UIButton).disabled);
    try { document.body.style.cursor = hoveringButton ? 'pointer' : 'default'; } catch(e) {}
  }
  static onKeyDown(ev:KeyboardEvent) {
    if (ev.key === 'Enter') {
      // call registered enter hooks
      for (const h of this.enterHooks) { try { h(); } catch(e) {} }
      ev.preventDefault();
      return;
    }
    if (!this.focused) return;
    if (ev.key === 'Backspace') {
      this.focused.value = this.focused.value.slice(0,-1);
      ev.preventDefault();
      return;
    }
  }

  static onKeyPress(ev:KeyboardEvent) {
    if (!this.focused) return;
    if (ev.key.length === 1) {
      if (this.focused.value.length < this.focused.maxLength) {
        this.focused.value += ev.key;
      }
    }
    ev.preventDefault();
  }

  static hookEnterButton(fn:() => void) { this.enterHooks.push(fn); }
  static unHookEnterButton(fn:() => void) { this.enterHooks = this.enterHooks.filter(f=>f!==fn); }
}

export class TextInput {
  x:number; y:number; w:number; h:number; value:string = '';
  maxLength:number = 100; isPassword:boolean = false; disabled:boolean = false; focused:boolean = false;
  onChange:(()=>void)|null = null;

  constructor(x:number,y:number,w:number) { this.x=x;this.y=y;this.w=w;this.h=18; }

  hitTest(px:number,py:number){ return px>=this.x && px<=this.x+this.w && py>=this.y && py<=this.y+this.h; }

  draw(ctx:CanvasRenderingContext2D) {
    // draw rounded background like legacy
    drawRoundedRect(ctx, this.x, this.y, this.w, this.h, 5, '#FFFFFF', 1.0);
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.font = '12px Font3, sans-serif';
    const raw = this.isPassword ? '*'.repeat(this.value.length) : this.value;
    // handle overflow with ellipsis
    const padding = 6;
    const avail = Math.max(10, this.w - padding*2);
    let txt = raw;
    try {
      if (ctx.measureText(txt).width > avail) {
        // truncate and add ellipsis
        while (txt.length > 0 && ctx.measureText(txt + '…').width > avail) txt = txt.slice(0, -1);
        txt = txt + '…';
      }
    } catch (e) {}
    ctx.fillText(txt, this.x+4, this.y+13);
    // draw blinking caret when focused
      if (this.focused) {
      const now = Date.now();
      const show = Math.floor(now / 500) % 2 === 0;
      if (show) {
        try {
          const metrics = ctx.measureText(txt);
          const caretX = this.x + 4 + metrics.width;
          const caretY = this.y + 3;
          const caretH = Math.max(8, this.h - 6);
          ctx.fillRect(Math.round(caretX), caretY, 2, caretH);
        } catch (e) {}
      }
    }
    ctx.restore();
  }
}

export class UIButton {
  x:number; y:number; w:number; h:number; disabled:boolean=false; label:string; onSubmit: (()=>void)|null = null;
  isHover:boolean = false;
  isDown:boolean = false;
  spriteSrcX:number = 200;
  spriteSrcW:number = 150;
  spriteSrcH:number = 50;
  drawOffsetX:number = -15;
  drawOffsetY:number = -15;
  constructor(x:number,y:number,w:number,h:number,label:string){ this.x=x;this.y=y;this.w=w;this.h=h;this.label=label; }
  hitTest(px:number,py:number){ return px>=this.x && px<=this.x+this.w && py>=this.y && py<=this.y+this.h; }
  onClick(){ if(!this.disabled && this.onSubmit) this.onSubmit(); }
  draw(ctx:CanvasRenderingContext2D){
    // Try to draw using title_buttons sprite if available (legacy look)
    const tb = window.TitleScreen?.titleButtons?.obj as CanvasImageSource | undefined;
    const tbImg = tb as HTMLImageElement | undefined;
    if (tb && ((tbImg && tbImg.complete) || (tb instanceof HTMLCanvasElement))) {
      // legacy sprite layout: source tiles with vertical states at y=0,50,100,150
      const srcX = (this.spriteSrcX ?? 200);
      let srcY = 0;
      if (this.disabled) srcY = 150; else if (this.isDown) srcY = 100; else if (this.isHover) srcY = 50; else srcY = 0;
      try {
        const srcW = (this.spriteSrcW ?? 150);
        const srcH = (this.spriteSrcH ?? 50);
        const dx = (this.drawOffsetX ?? -15);
        const dy = (this.drawOffsetY ?? -15);
        ctx.drawImage(tb, srcX, srcY, srcW, srcH, this.x + dx, this.y + dy, srcW, srcH);
        // sprite already contains label/outline; do not draw additional text
        return;
      } catch(e) {
        // fallback to simple draw
      }
    }
    ctx.save(); ctx.fillStyle = this.disabled ? '#999' : '#4CAF50'; ctx.fillRect(this.x,this.y,this.w,this.h); ctx.fillStyle='#fff'; ctx.font= Math.max(12, Math.round(this.h * 0.5)) + 'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(this.label, this.x+this.w/2, this.y+this.h/2); ctx.restore();
  }
}
