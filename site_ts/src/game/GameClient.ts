import MapData from '../map/Map';
import GameObject from '../entities/GameObject';
import CWarp from '../entities/CWarp';
import CDoor from '../entities/CDoor';
import CWarpArrow from '../entities/CWarpArrow';
import CStairs from '../entities/CStairs';
import Character from '../entities/Character';

export default class GameClient {
  map: MapData | null = null;
  gameObjects: GameObject[] = [];
  characters: any[] = [];
  // `player` may be a simple position object or a `Character` instance
  player: any = null;
  localUsername?: string;
  playerCanMove: boolean = true;
  queuedMap: string | null = null;
  queuedChars: any[] | null = null;
  // Haxe-compatible queue flag: when true, incoming loadMap should be queued
  queueLoadMap: boolean = false;
  transition: { type: 'warpArrow' | 'door' | 'stairs'; warp: any; direction: number; count: number } | null = null;

  constructor() {
    this.map = null;
  }

  // Called when a map has been fully loaded client-side
  onMapLoaded(m: MapData, uiController?: any) {
    this.setMap(m);
    try {
      (window as any).pokemmo_ts = (window as any).pokemmo_ts || {};
      (window as any).pokemmo_ts.map = m;
      console.log('[GameClient] onMapLoaded assigned map', m.id, 'w,h=', m.width, m.height, 'pok.current=', (window as any).pokemmo_ts.current ? 'present' : 'none');
      try { (window as any).pokemmo_ts._diag = true; console.log('[GameClient] diagnostics enabled (pokemmo_ts._diag=true)'); } catch(e) {}
    } catch(e) {}
    // if UI controller provided, notify it to update screens (e.g., close loading)
    try { if (uiController && typeof uiController.onMapLoaded === 'function') uiController.onMapLoaded(m); } catch (e) {}
    // after the UI has been notified and the map is cached, emit start ack to server
    try {
      const pok: any = (window as any).pokemmo_ts || {};
      const sock: any = pok && pok.socket;
      if (sock && typeof sock.emit === 'function' && !pok._startAckSent) {
        try { sock.emit('startGame_ack', {}); pok._startAckSent = true; console.log('[GameClient] emitted startGame_ack after map ready'); } catch(e) { console.warn('[GameClient] failed to emit startGame_ack', e); }
      }
    } catch(e) {}
    // clear any queue state now that map has been loaded
    try { this.queueLoadMap = false; this.queuedMap = null; this.queuedChars = null; } catch(e) {}
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
      try {
        if (!window.pokemmo_ts) window.pokemmo_ts = {} as any;
        // mark that the game is starting and queue incoming map loads until UI is closed
        window.pokemmo_ts.gameStarted = true;
        this.queueLoadMap = true;
        if (data && data.username) this.localUsername = data.username;
      } catch(e) {}
      // do not close UI here; wait until map is actually loaded client-side
    });

    socket.on('loadMap', (data: any) => {
      try {
        console.log('[GameClient] loadMap payload', data && data.mapName, data && data.player);
        try { if (window.pokemmo_ts) window.pokemmo_ts.mapError = null; } catch(e) {}
        if (!data || !data.mapName) return;
        // Proceed to load the map even if queueLoadMap is true; UI will be closed
        // only after the map is ready (see onMapLoaded).
        import('../map/Loader').then(({ default: loadMap }) => {
          loadMap(data.mapName).then((m:any) => {
            try {
              this.onMapLoaded(m, uiController);
              // apply player spawn if provided
              if (data.player) {
                try {
                  const uname = data.player.username;
                  // find existing char
                  let chr = this.characters.find((c:any) => c.username === uname);
                  if (chr) {
                    chr.update(data.player);
                  } else {
                    // create new Character lazily
                        chr = new Character(data.player);
                    this.characters.push(chr);
                  }
                  // diagnostic log to help track spawn issues
                  try { console.log('[GameClient] apply player spawn', uname, 'dataPos=', data.player && data.player.x, data.player && data.player.y, 'respawn=', data.player && data.player.respawnLocation, 'localUsername=', this.localUsername, 'uiCurrent=', (window as any).pokemmo_ts && (window as any).pokemmo_ts.current ? (window as any).pokemmo_ts.current.currentUsername : 'none'); } catch(e) {}
                  // if this is the local player, use the Character as `player`. Also fallback to UI-known username.
                  const uiName = (window as any).pokemmo_ts && (window as any).pokemmo_ts.current ? (window as any).pokemmo_ts.current.currentUsername : null;
                  if (uname && ((this.localUsername && uname === this.localUsername) || (uiName && uname === uiName))) {
                    // prefer respawnLocation from server if provided
                    try {
                      const resp = data.player && data.player.respawnLocation;
                      if (resp && typeof resp.x !== 'undefined' && typeof resp.y !== 'undefined') {
                        // Only apply respawnLocation if it targets this map (or mapName is undefined)
                        if (!resp.mapName || resp.mapName === m.id) {
                          chr.x = Number(resp.x);
                          chr.y = Number(resp.y);
                          chr.targetX = Number(resp.x);
                          chr.targetY = Number(resp.y);
                          chr.direction = typeof resp.direction !== 'undefined' ? Number(resp.direction) : chr.direction;
                        }
                      }
                      if (this.map) {
                        const maxX = Math.max(0, this.map.width - 1);
                        const maxY = Math.max(0, this.map.height - 1);
                        chr.x = Math.max(0, Math.min(Number(chr.x || 0), maxX));
                        chr.y = Math.max(0, Math.min(Number(chr.y || 0), maxY));
                        chr.targetX = Math.max(0, Math.min(Number(chr.targetX || chr.x), maxX));
                        chr.targetY = Math.max(0, Math.min(Number(chr.targetY || chr.y), maxY));
                        // If spawned inside a blocking tile, try nearby safe tiles
                        try {
                          const mapAny: any = this.map;
                          if (mapAny && (mapAny.isTileSolid && mapAny.isTileSolid(chr.x, chr.y) || (mapAny.isTileWater && mapAny.isTileWater(chr.x, chr.y)) || (mapAny.isTileLedge && mapAny.isTileLedge(chr.x, chr.y)))) {
                            const offsets = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
                            for (const off of offsets) {
                              const nx = chr.x + off[0];
                              const ny = chr.y + off[1];
                              if (nx < 0 || ny < 0 || nx > maxX || ny > maxY) continue;
                              if (mapAny.isTileSolid && mapAny.isTileSolid(nx, ny)) continue;
                              if (mapAny.isTileWater && mapAny.isTileWater(nx, ny)) continue;
                              if (mapAny.isTileLedge && mapAny.isTileLedge(nx, ny)) continue;
                              chr.x = nx; chr.y = ny; chr.targetX = nx; chr.targetY = ny; break;
                            }
                          }
                        } catch (e) {}
                      }
                    } catch (e) {}
                    this.player = chr;
                    try { (window as any).pokemmo_ts = (window as any).pokemmo_ts || {}; (window as any).pokemmo_ts.game = this; } catch(e) {}
                  } else if (!this.player) {
                    // fallback: set simple position
                    let px = Number(data.player.x || 1);
                    let py = Number(data.player.y || 1);
                    try {
                      if (this.map) {
                        px = Math.max(0, Math.min(px, this.map.width - 1));
                        py = Math.max(0, Math.min(py, this.map.height - 1));
                      }
                    } catch (e) {}
                    this.player = { x: px, y: py, direction: Number(data.player.direction || 0) };
                  }
                } catch(e) { console.warn('[GameClient] apply player spawn failed', e); }
              }
            } catch(e) { console.warn('[GameClient] onMapLoaded error', e); }
          }).catch((err:any)=>{ console.warn('[GameClient] loadMap failed', err); try { if (window.pokemmo_ts) window.pokemmo_ts.mapError = String(err); } catch(e) {} });
        }).catch((err:any) => { console.warn('[GameClient] dynamic import loadMap failed', err); try { if (window.pokemmo_ts) window.pokemmo_ts.mapError = String(err); } catch(e) {} });
      } catch (e) { console.warn('[GameClient] loadMap handler error', e); try { if (window.pokemmo_ts) window.pokemmo_ts.mapError = String(e); } catch(e) {} }
    });

    // generic world updates: chars, messages, warpsUsed, cremoved
    socket.on('update', (data: any) => {
      try {
        if (!data) return;
        if (!this.map) return;
        if (data.map && data.map !== this.map.id) return;

        // ensure arrays
        const chars = data.chars || [];
        const cremoved = data.cremoved || [];

        // update/create characters
        for (const cd of chars) {
          const username = cd.username;
          try {
            // If this update targets the local player, log the incoming data for diagnostics
            const localMatch = (this.localUsername && username === this.localUsername) || ((window as any).pokemmo_ts && (window as any).pokemmo_ts.current && (window as any).pokemmo_ts.current.currentUsername === username);
            if (localMatch) {
              try { console.log('[GameClient] incoming update for local player', username, 'data=', cd); } catch(e) {}
            }
            let chr = this.characters.find((c:any) => c.username === username);
            if (chr) {
              if (localMatch) {
                try { console.log('[GameClient] before update local char state', { x: chr.x, y: chr.y, targetX: chr.targetX, targetY: chr.targetY, walking: chr.walking }); } catch(e) {}
              }
              chr.update(cd);
              if (localMatch) {
                try { console.log('[GameClient] after update local char state', { x: chr.x, y: chr.y, targetX: chr.targetX, targetY: chr.targetY, walking: chr.walking }); } catch(e) {}
              }
            } else {
              const c = new Character(cd);
              this.characters.push(c);
            }
          } catch(e) {
            console.warn('failed to update/create character', e);
          }
        }

        // remove characters
        for (const name of cremoved) {
          const idx = this.characters.findIndex((c:any) => c.username === name);
          if (idx !== -1) {
            try { this.characters[idx].destroy(); } catch(e) {}
            this.characters.splice(idx, 1);
          }
        }

      } catch(e) { console.warn('[GameClient] update handler failed', e); }
    });
  }

  // Called each frame to update UI-related state; currently a thin adapter
  updateUI(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    // advance character ticks and handle keyboard-driven local input
    try {
      // advance animations
      // emulate legacy tick rate (30 FPS) by running ticks every other RAF frame
      const rendererAny: any = (window as any).Renderer || { numRTicks: 0 };
      const shouldTick = (rendererAny.numRTicks % 2) === 0;
      for (const c of this.characters) {
        try { if (shouldTick && typeof c.tick === 'function') c.tick(); } catch(e) {}
      }

      // handle fresh key presses to move player
      const keyState = (window as any).pokemmo_ts && (window as any).pokemmo_ts.UI && (window as any).pokemmo_ts.UI.keyState ? (window as any).pokemmo_ts.UI.keyState : {};
      this._prevKeyState = this._prevKeyState || {};
      const keys = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];
      for (const k of keys) {
        const now = !!keyState[k];
        const prev = !!this._prevKeyState[k];
        // Trigger on initial press OR when key is held and the player is not currently walking
        let shouldTrigger = false;
        if (now && !prev) shouldTrigger = true;
        else if (now && prev) {
          const p: any = this.player;
          const isWalking = p && typeof p.walking !== 'undefined' ? !!p.walking : false;
          if (!isWalking) shouldTrigger = true;
        }
        if (shouldTrigger) {
          let dir = 0;
          if (k === 'ArrowDown') dir = 0;
          else if (k === 'ArrowLeft') dir = 1;
          else if (k === 'ArrowUp') dir = 2;
          else if (k === 'ArrowRight') dir = 3;
          if (this.player && this.playerCanMove) {
            console.log('[GameClient] movePlayer attempt', 'player=', (this.player && this.player.username) || 'local', 'from=', this.player && this.player.x, this.player && this.player.y, 'dir=', dir);
            const moved = this.movePlayer(dir);
            console.log('[GameClient] movePlayer result', moved, 'to=', this.player && this.player.x, this.player && this.player.y);
            try {
              const pok: any = (window as any).pokemmo_ts || {};
              const sock: any = pok && pok.socket;
              if (sock && typeof sock.emit === 'function' && moved && this.player) {
                sock.emit('walk', { x: this.player.x, y: this.player.y, dir: this.player.direction });
              } else if (sock && typeof sock.emit === 'function') {
                sock.emit('turn', { dir });
              }
            } catch(e) {}
          }
        }
        this._prevKeyState[k] = now;
      }
    } catch(e) { console.warn('[GameClient] updateUI error', e); }
  }

  setMap(m: MapData) {
    this.map = m;
    this.gameObjects = [];
    this.parseMapObjects();
    // initialize player spawn: try map.properties.spawn_x/spawn_y else default (1,1)
    const sx = (m.properties && (m.properties.spawn_x || m.properties.start_x)) || 1;
    const sy = (m.properties && (m.properties.spawn_y || m.properties.start_y)) || 1;
    this.player = { x: Number(sx), y: Number(sy), direction: 0 };
    try { (window as any).pokemmo_ts = (window as any).pokemmo_ts || {}; (window as any).pokemmo_ts.map = m; } catch(e) {}
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
    // render gameObjects AND characters together, sorted by y for proper layering
    const arr: any[] = [];
    for (const o of this.gameObjects) arr.push(o);
    for (const c of this.characters) arr.push(c);
    arr.sort((a: any, b: any) => {
      const ay = (typeof a.y === 'number') ? a.y : 0;
      const by = (typeof b.y === 'number') ? b.y : 0;
      if (ay !== by) return ay - by;
      const ap = a.renderPriority || 0;
      const bp = b.renderPriority || 0;
      return bp - ap;
    });
    for (const o of arr) {
      try { o.render(ctx); } catch(e) {}
    }

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

  // used by Character for ledge interactions
  useLedge(tileX: number, tileY: number) {
    // simple local transition: block movement briefly and emit useLedge
    this.playerCanMove = false;
    this.transition = { type: 'warpArrow', warp: null, direction: 0, count: 0 };
    try {
      const pok: any = (window as any).pokemmo_ts || {};
      const sock: any = pok && pok.socket;
      if (sock && typeof sock.emit === 'function') {
        console.log('[GameClient] emitting useLedge', tileX, tileY);
        sock.emit('useLedge', { x: tileX, y: tileY });
      }
    } catch (e) {}
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

    // Block initiating movement into solid/water tiles client-side to respect collisions
    try {
      const mapAny: any = this.map;
      if (mapAny && (mapAny.isTileSolid && mapAny.isTileSolid(nx, ny))) return false;
      if (mapAny && (mapAny.isTileWater && mapAny.isTileWater(nx, ny))) return false;
      // allow ledge initiation; ledge handled during tickWalking
    } catch (e) {}

    // If player is a Character instance, set target and walking state (legacy behaviour)
    try {
      if (this.player && typeof this.player === 'object' && typeof this.player.targetX !== 'undefined') {
        this.player.targetX = nx;
        this.player.targetY = ny;
        this.player.targetDirection = dir;
        // if direction unchanged, start slightly into the step as legacy client does
        if (this.player.direction === dir) this.player.walkingPerc = 0.3; else this.player.walkingPerc = 0.0;
        this.player.walking = true;
        this.player.direction = dir;
      } else {
        this.player.x = nx;
        this.player.y = ny;
        this.player.direction = dir;
      }
    } catch (e) { this.player.x = nx; this.player.y = ny; this.player.direction = dir; }

    // after moving, check for warp on the new tile
    this.tryUseWarp(nx, ny, dir);
    return true;
  }
}
