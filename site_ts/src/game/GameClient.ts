import MapData from '../map/Map';
import GameObject from '../entities/GameObject';
import CWarp from '../entities/CWarp';
import CDoor from '../entities/CDoor';
import CWarpArrow from '../entities/CWarpArrow';
import CStairs from '../entities/CStairs';

export default class GameClient {
  map: MapData | null = null;
  gameObjects: GameObject[] = [];
  characters: any[] = [];
  player: { x: number; y: number; direction: number } | null = null;
  playerCanMove: boolean = true;
  queuedMap: string | null = null;
  queuedChars: any[] | null = null;
  transition: { type: 'warpArrow' | 'door' | 'stairs'; warp: any; direction: number; count: number } | null = null;

  constructor() {
    this.map = null;
  }

  // Called when a map has been fully loaded client-side
  onMapLoaded(m: MapData, uiController?: any) {
    this.setMap(m);
    try { (window as any).pokemmo_ts = (window as any).pokemmo_ts || {}; (window as any).pokemmo_ts.map = m; } catch(e) {}
    // if UI controller provided, notify it to update screens (e.g., close loading)
    try { if (uiController && typeof uiController.onMapLoaded === 'function') uiController.onMapLoaded(m); } catch (e) {}
  }

  // Install socket handlers onto the provided socket and optionally use uiController
  handleSocketEvents(socket: any, uiController: any) {
    if (!socket) return;

    socket.on('newGame', (data: { username: string; starters: string[]; characters: string[] }) => {
      try {
        if (!data || !data.starters || !data.characters) return;
        if (uiController && typeof uiController.openNewGame === 'function') uiController.openNewGame(data.starters, data.characters);
      } catch (e) { console.warn('failed to open NewGameScreen', e); }
    });

    socket.on('startGame', (data: { username?: string }) => {
      try { console.log('[main] startGame', data); } catch(e) {}
      try { if (uiController && typeof uiController.closeCurrent === 'function') uiController.closeCurrent(); } catch(e) {}
    });

    socket.on('loadMap', (data: any) => {
      try {
        if (!data || !data.mapName) return;
        import('../map/Loader').then(({ default: loadMap }) => {
          loadMap(data.mapName).then((m:any) => {
            try { this.onMapLoaded(m, uiController); } catch(e) {}
          }).catch((err:any)=>{ console.warn('[main] loadMap failed', err); });
        }).catch((err:any) => { console.warn('[main] dynamic import loadMap failed', err); });
      } catch (e) { console.warn('[main] loadMap handler error', e); }
    });
  }

  // Called each frame to update UI-related state; currently a thin adapter
  updateUI(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    // placeholder: could update camera, sprite animations, overlays, etc.
    // keep minimal for now; renderObjects is invoked externally by the RAF loop.
    return;
  }

  setMap(m: MapData) {
    this.map = m;
    this.gameObjects = [];
    this.parseMapObjects();
    // initialize player spawn: try map.properties.spawn_x/spawn_y else default (1,1)
    const sx = (m.properties && (m.properties.spawn_x || m.properties.start_x)) || 1;
    const sy = (m.properties && (m.properties.spawn_y || m.properties.start_y)) || 1;
    this.player = { x: Number(sx), y: Number(sy), direction: 0 };
  }

  parseMapObjects() {
    if (!this.map) return;
    for (const layer of this.map.layers) {
      if (layer.type !== 'objectgroup') continue;
      for (const obj of layer.objects || []) {
        if (!obj.type) continue;
        const tx = Math.floor(obj.x / this.map.tilewidth);
        const ty = Math.floor(obj.y / this.map.tileheight);
        if (obj.type === 'warp') {
          const t = obj.properties && obj.properties.type;
          if (t === 'door') {
            this.gameObjects.push(new CDoor(obj.name, tx, ty));
          } else if (t === 'arrow') {
            this.gameObjects.push(new CWarpArrow(obj.name, tx, ty));
          } else if (t === 'stairs_up' || t === 'stairs_down') {
            const dir = (t === 'stairs_up') ? 2 : 0; // map legacy DIR_UP/DOWN mapping simplified
            const fromDir = Number(obj.properties && obj.properties.from_dir) || 0;
            this.gameObjects.push(new CStairs(obj.name, tx, ty, dir, fromDir));
          }
        }
      }
    }
  }

  renderObjects(ctx: CanvasRenderingContext2D) {
    if (!this.map) return;
    // simple render: draw all gameObjects sorted by y
    const arr = this.gameObjects.slice();
    arr.sort((a, b) => a.y - b.y || b.renderPriority - a.renderPriority);
    for (const o of arr) o.render(ctx);

    // render transition overlay if present
    if (this.transition) {
      const t = this.transition;
      // handle first-frame actions
      if (t.count === 0) {
        if (t.type === 'door' && t.warp && typeof t.warp.open === 'function') {
          try { t.warp.open(); } catch (e) {}
        }
      }
      t.count++;
      if (t.type === 'warpArrow') {
        const perc = Math.max(0, Math.min(1, t.count / 10));
        ctx.fillStyle = 'rgba(0,0,0,' + perc + ')';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        if (t.count >= 10) {
          this.transition = null;
          this.playerCanMove = true;
        }
      } else if (t.type === 'door') {
        // let door sprite animate itself via CDoor.render; add slight fade
        const perc = Math.max(0, Math.min(1, t.count / 20));
        ctx.fillStyle = 'rgba(0,0,0,' + perc * 0.5 + ')';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        if (t.count >= 20) {
          this.transition = null;
          this.playerCanMove = true;
        }
      } else if (t.type === 'stairs') {
        const perc = Math.max(0, Math.min(1, t.count / 12));
        ctx.fillStyle = 'rgba(255,255,255,' + perc + ')';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        if (t.count >= 12) {
          this.transition = null;
          this.playerCanMove = true;
        }
      }
    }
  }

  tryUseWarp(tileX: number, tileY: number, direction: number = 0) {
    // find warp at tile
    for (const o of this.gameObjects) {
      // CWarp instances have name property
      if ((o as any).name && o.x === tileX && o.y === tileY) {
        const warp = o as any;
        if (warp.disable) return false;
        // if warp has canWarp, honor it
        if (warp.canWarp && !warp.canWarp(/*chr*/ null)) return false;
        // emit socket event to server to request warp
        const sock = (window as any).pokemmo_ts && (window as any).pokemmo_ts.socket;
        if (sock && typeof sock.emit === 'function') {
          // locally trigger transition for player depending on warp type
          if (this.player) {
            if (o instanceof CDoor) this.enterDoor(o, direction);
            else if (o instanceof CStairs) this.enterStairs(o, direction);
            else this.enterWarpArrow(o, direction);
          }
          sock.emit('useWarp', { name: warp.name, direction });
          return true;
        }
        return false;
      }
    }
    return false;
  }

  enterWarpArrow(warp: any, direction: number) {
    if (!warp) return;
    warp.disable = true;
    this.playerCanMove = false;
    this.queuedMap = null;
    this.queuedChars = null;
    this.transition = { type: 'warpArrow', warp, direction, count: 0 };
  }

  enterDoor(warp: any, direction: number) {
    if (!warp) return;
    try { if (typeof warp.open === 'function') warp.open(); } catch (e) {}
    warp.disable = true;
    this.playerCanMove = false;
    this.transition = { type: 'door', warp, direction, count: 0 };
  }

  enterStairs(warp: any, direction: number) {
    if (!warp) return;
    warp.disable = true;
    this.playerCanMove = false;
    this.transition = { type: 'stairs', warp, direction, count: 0 };
  }

  getPlayerChar() {
    // placeholder: try window.pokemmo_ts.current player
    if (this.player) return this.player;
    const cur = (window as any).pokemmo_ts && (window as any).pokemmo_ts.current;
    return cur && cur.player ? cur.player : null;
  }

  movePlayer(dir: number) {
    if (!this.player || !this.map) return false;
    // dir: 0 down, 1 left, 2 up, 3 right (legacy mapping)
    let nx = this.player.x;
    let ny = this.player.y;
    if (dir === 0) ny += 1;
    else if (dir === 2) ny -= 1;
    else if (dir === 1) nx -= 1;
    else if (dir === 3) nx += 1;

    // bounds
    if (nx < 0 || ny < 0 || nx >= this.map.width || ny >= this.map.height) return false;

    this.player.x = nx;
    this.player.y = ny;
    this.player.direction = dir;

    // after moving, check for warp on the new tile
    this.tryUseWarp(nx, ny, dir);
    return true;
  }
}
