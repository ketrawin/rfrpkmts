import GameObject from './GameObject';
import ResourceManager from '../resources/ResourceManager';

export type CCharacterData = {
  username: string;
  x: number;
  y: number;
  direction: number;
  type?: string;
  inBattle?: boolean;
  folShiny?: boolean;
  follower?: string;
  lastX?: number;
  lastY?: number;
};

export default class Character extends GameObject {
  // Legacy timing constants
  private static readonly CHAR_MOVE_WAIT: number = 0.3;
  private static readonly TICKS_PER_SECOND: number = 30; // legacy tick cadence
  private _animSpeed: number = 0.2;
  private _warnOutOfBoundsLogged: boolean = false;
  username: string;
  animationStep: number = 0;
  walking: boolean = false;
  walkingPerc: number = 0.0;
  walkingHasMoved: boolean = false;
  targetX: number = 0;
  targetY: number = 0;
  targetDirection: number = 0;
  direction: number = 0;
  loaded: boolean = false;
  image?: HTMLImageElement;
  inBattle: boolean = false;
  follower?: string;
  folShiny: boolean = false;

  renderOffsetX: number = 0;
  renderOffsetY: number = 0;
  renderAlpha: number = 1.0;

  constructor(data: CCharacterData) {
    super(data.x, data.y);
    this.username = data.username;
    this.direction = data.direction || 0;
    this.targetX = data.x;
    this.targetY = data.y;
    this.inBattle = !!data.inBattle;
    this.follower = data.follower;
    this.folShiny = !!data.folShiny;
    try { console.log('[Character] created', this.username, 'pos=', this.x, this.y, 'target=', this.targetX, this.targetY, 'dir=', this.direction, 'type=', (data.type || 'red')); } catch(e) {}
    // load image resource if provided (chars/<type>.png)
    const type = (data.type || 'red');
    ResourceManager.loadImage('/resources/chars/' + type + '.png').then(img => {
      this.image = img;
      this.loaded = true;
      console.log('[Character] image loaded', this.username, 'img=', (img && img.src) ? img.src.split('/').pop() : img);
    }).catch(() => { this.loaded = false; });
  }

  update(data: Partial<CCharacterData>) {
    if (data.x != null) this.targetX = Number(data.x);
    if (data.y != null) this.targetY = Number(data.y);
    if (data.direction != null) this.targetDirection = Number(data.direction);
    if (data.inBattle != null) this.inBattle = !!data.inBattle;
    if (data.follower != null) this.follower = data.follower;
    if (data.folShiny != null) this.folShiny = !!data.folShiny;
    // determine walking state
    // Mirror legacy behaviour: if the server position is far (>1) then snap immediately
    const dx = Math.abs(this.x - (this.targetX || this.x));
    const dy = Math.abs(this.y - (this.targetY || this.y));
    const allowNearby = (dx <= 1 && dy <= 1) || (this.x - 2 === this.targetX && this.y === this.targetY) || (this.x + 2 === this.targetX && this.y === this.targetY) || (this.x === this.targetX && this.y - 2 === this.targetY) || (this.x === this.targetX && this.y + 2 === this.targetY);
    if (!allowNearby && (dx > 1 || dy > 1)) {
      // too far: snap to server position to avoid odd interpolation/teleport
      try { if ((window as any).pokemmo_ts && (window as any).pokemmo_ts._diag) console.log('[Character] snap-to-server', this.username, 'from=', this.x, this.y, 'to=', this.targetX, this.targetY, 'dx=', dx, 'dy=', dy); } catch(e) {}
      this.x = Number(this.targetX || this.x);
      this.y = Number(this.targetY || this.y);
      this.direction = this.targetDirection || this.direction;
      this.walking = false;
      this.walkingPerc = 0.0;
      this.walkingHasMoved = false;
      this.animationStep = 0;
    } else if (this.x !== this.targetX || this.y !== this.targetY) {
      this.walking = true;
      // immediately reflect facing towards target for snappier orientation
      if (typeof this.targetDirection !== 'undefined') this.direction = this.targetDirection;
    } else {
      this.walking = false;
      this.walkingPerc = 0.0;
      this.walkingHasMoved = false;
      this.animationStep = 0;
      this.direction = this.targetDirection || this.direction;
    }
  }

  getRenderPosX(): number {
    const tileW = 32;
    if (!this.walking) return Math.floor(this.x * tileW + this.renderOffsetX);
    const perc = (this.walkingPerc - 0.3) * (1.0 / 0.7);
    let destX = this.x * tileW;
    if (this.walkingPerc >= 0.3) {
      if (this.walkingHasMoved) {
        if (this.direction === 1) destX += tileW * (1 - perc);
        else if (this.direction === 3) destX -= tileW * (1 - perc);
      } else {
        if (this.direction === 1) destX -= tileW * perc;
        else if (this.direction === 3) destX += tileW * perc;
      }
    }
    return Math.floor(destX + this.renderOffsetX);
  }

  getRenderPosY(): number {
    const tileH = 32;
    if (!this.walking) return Math.floor(this.y * tileH - 32 + this.renderOffsetY);
    const destY = this.y * tileH - 32;
    const perc = (this.walkingPerc - 0.3) * (1.0 / 0.7);
    let finalY = destY;
    if (this.walkingPerc >= 0.3) {
      if (this.walkingHasMoved) {
        if (this.direction === 2) finalY += tileH * (1 - perc);
        else if (this.direction === 0) finalY -= tileH * (1 - perc);
      } else {
        if (this.direction === 2) finalY -= tileH * perc;
        else if (this.direction === 0) finalY += tileH * perc;
      }
    }
    return Math.floor(finalY + this.renderOffsetY);
  }

  tick(): void {
    this.tickWalking();
  }

  tickWalking(): void {
    if (!this.walking) {
      this.animationStep = 0;
      this.walkingPerc = 0.0;
      this.walkingHasMoved = false;
      return;
    }
    // ensure facing is applied at start of walk
    if (this.walking && this.walkingPerc <= 0.0) {
      if (typeof this.targetDirection !== 'undefined') this.direction = this.targetDirection;
    }
    // Tuned increments to slow down walking and animation for better feel
    // Previous values were 0.10/0.20 (legacy) then 0.07/0.20; reduce further to slow movement.
    this.walkingPerc += 0.05;
    this.animationStep += 0.15;
    if (this.animationStep >= 4.0) this.animationStep -= 4.0;
    if (this.walkingPerc >= (1.0 - Character.CHAR_MOVE_WAIT) * 0.5 && !this.walkingHasMoved) {
      // check for front tile warps/ledges if this is controllable
      try {
        const gw: any = (window as any).pokemmo_ts && (window as any).pokemmo_ts.game;
        const map: any = (window as any).pokemmo_ts && (window as any).pokemmo_ts.map;
        const frontX = this.getFrontPositionX ? this.getFrontPositionX() : (this.x + (this.direction === 3 ? 1 : this.direction === 1 ? -1 : 0));
        const frontY = this.getFrontPositionY ? this.getFrontPositionY() : (this.y + (this.direction === 0 ? 1 : this.direction === 2 ? -1 : 0));
        if (this.isControllable && this.isControllable()) {
          // try warp via GameClient helper
          if (gw && typeof gw.tryUseWarp === 'function') {
            const used = gw.tryUseWarp(frontX, frontY, this.direction);
            if (used) return;
          }
          // ledge detection via map helper
          if (map && typeof map.getLedgeDir === 'function') {
            const ld = map.getLedgeDir(frontX, frontY);
            if (ld !== -1 && ld === this.direction) {
              try { if (gw && typeof gw.useLedge === 'function') { gw.useLedge(frontX, frontY); return; } } catch(e) {}
            }
          }
          // block movement if front tile is solid/water/ledge
          if (this.willMoveIntoAWall()) {
            try { if (gw && typeof gw.onBlocked === 'function') gw.onBlocked(); } catch(e) {}
            return;
          }
        }

        // move one tile according to current direction (legacy behaviour)
        if (this.x !== this.targetX || this.y !== this.targetY) {
          switch (this.direction) {
            case 1: // LEFT
              this.x -= 1;
              break;
            case 3: // RIGHT
              this.x += 1;
              break;
            case 2: // UP
              this.y -= 1;
              break;
            case 0: // DOWN
              this.y += 1;
              break;
          }
          this.walkingHasMoved = true;
        }
      } catch (e) {
        // fallback: simple move
        if (this.x !== this.targetX || this.y !== this.targetY) {
          if (this.x < this.targetX) this.x += 1;
          else if (this.x > this.targetX) this.x -= 1;
          else if (this.y < this.targetY) this.y += 1;
          else if (this.y > this.targetY) this.y -= 1;
          this.walkingHasMoved = true;
        }
      }
    }
    if (this.walkingPerc >= 1.0) {
      if (this.x === this.targetX && this.y === this.targetY) {
        this.walking = false;
        this.walkingHasMoved = false;
        this.walkingPerc = 0.0;
        this.animationStep = 0;
        this.direction = this.targetDirection || this.direction;
      } else {
        this.walkingHasMoved = false;
        this.walkingPerc = Character.CHAR_MOVE_WAIT + 0.10;
      }
    }
  }

  // Checks whether attempting to move forward would hit a wall/water/ledge
  willMoveIntoAWall(): boolean {
    try {
      const map: any = (window as any).pokemmo_ts && (window as any).pokemmo_ts.map;
      const diag = (window as any).pokemmo_ts && (window as any).pokemmo_ts._diag;
      if (!map) {
        if (diag) console.log('[Character] willMoveIntoAWall no map');
        return false;
      }
      const fx = this.getFrontPositionX();
      const fy = this.getFrontPositionY();
      let solid = false, water = false, ledge = false;
      if (diag) {
        try {
          const px = (typeof this.getRenderPosX === 'function') ? this.getRenderPosX() : this.x * (map.tilewidth || 32);
          const py = (typeof this.getRenderPosY === 'function') ? this.getRenderPosY() : this.y * (map.tileheight || 32) - 32;
          console.log('[Character] willMoveIntoAWall diag:', this.username, 'frontTile=', fx, fy, 'renderPos(px,py)=', px, py, 'mapOffset=', map.cacheOffsetX, map.cacheOffsetY);
        } catch (e) {}
      }
      try { if (typeof map.isTileSolid === 'function') solid = !!map.isTileSolid(fx, fy); } catch(e) { solid = false; }
      try { if (typeof map.isTileWater === 'function') water = !!map.isTileWater(fx, fy); } catch(e) { water = false; }
      try { if (typeof map.isTileLedge === 'function') ledge = !!map.isTileLedge(fx, fy); } catch(e) { ledge = false; }
      if (diag) console.log('[Character] willMoveIntoAWall', 'char=', this.username, 'front=', fx, fy, 'solid=', solid, 'water=', water, 'ledge=', ledge);
      return solid || water || ledge;
    } catch (e) { return false; }
  }

  // Return the tile X in front of the character based on current direction
  getFrontPositionX(): number {
    switch (this.direction) {
      case 3: return this.x + 1; // RIGHT
      case 1: return this.x - 1; // LEFT
      default: return this.x;
    }
  }

  // Return the tile Y in front of the character based on current direction
  getFrontPositionY(): number {
    switch (this.direction) {
      case 0: return this.y + 1; // DOWN
      case 2: return this.y - 1; // UP
      default: return this.y;
    }
  }

  // True if this character is controlled by the local client
  isControllable(): boolean {
    try {
      const pok: any = (window as any).pokemmo_ts || {};
      return !!(pok.game && pok.game.player === this && pok.game.playerCanMove);
    } catch (e) { return false; }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.disable) return;
    const px = this.getRenderPosX();
    const py = this.getRenderPosY();
    // warn once if character position is outside current map bounds
    try {
      const map: any = (window as any).pokemmo_ts && (window as any).pokemmo_ts.map;
      if (map && !this._warnOutOfBoundsLogged) {
        if (this.x < 0 || this.y < 0 || this.x >= map.width || this.y >= map.height) {
          console.warn('[Character] spawn/out-of-bounds detected', this.username, 'pos=', this.x, this.y, 'map=', map.id, 'w,h=', map.width, map.height);
          this._warnOutOfBoundsLogged = true;
        }
      }
    } catch(e) {}
    if (this.image && this.loaded) {
      try {
        // Draw a single frame from a typical spritesheet.
        const FRAME_W = 32;
        const FRAME_H = 64;
        // legacy layout: direction selects column, animation selects row
        const frameX = (this.direction % 4) * FRAME_W;
        const frameY = (Math.floor(this.animationStep) % 4) * FRAME_H;
        const map: any = (window as any).pokemmo_ts && (window as any).pokemmo_ts.map;
        const offX = map && typeof map.cacheOffsetX === 'number' ? map.cacheOffsetX : 0;
        const offY = map && typeof map.cacheOffsetY === 'number' ? map.cacheOffsetY : 0;
        const dx = px - Math.floor(FRAME_W / 2) + offX;
        const dy = py - FRAME_H + 32 + offY; // align feet to tile baseline
        ctx.drawImage(this.image as HTMLImageElement, frameX, frameY, FRAME_W, FRAME_H, dx, dy, FRAME_W, FRAME_H);
      } catch (e) { console.warn('[Character] draw frame failed', e); }
    } else {
      // fallback: draw simple rectangle
      ctx.save();
      ctx.fillStyle = '#FF00FF';
      const map: any = (window as any).pokemmo_ts && (window as any).pokemmo_ts.map;
      const offX = map && typeof map.cacheOffsetX === 'number' ? map.cacheOffsetX : 0;
      const offY = map && typeof map.cacheOffsetY === 'number' ? map.cacheOffsetY : 0;
      ctx.fillRect(px - 8 + offX, py - 24 + offY, 16, 32);
      ctx.restore();
    }
  }

  destroy(): void {
    // no special cleanup needed for now
  }
}
