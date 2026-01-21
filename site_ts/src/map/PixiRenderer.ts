import * as PIXI from 'pixi.js';
import { MapData, Layer, Tileset } from './Map';



export class PixiMapRenderer {
  app: PIXI.Application | null = null;
  mapContainer: PIXI.Container | null = null;
  playerLayer: PIXI.Container | null = null;
  ready: Promise<void>;

  playerSprite: PIXI.Sprite | null = null;
  debugCollision: boolean = true;

  async renderPlayer(player: { x: number, y: number, direction?: number, type?: string, animationStep?: number }) {
    await this.ready;
    if (!this.playerLayer) return;

    // Paramètres du spritesheet (standard Pokémon)
    const frameWidth = 32;
    const frameHeight = 64;
    const type = player.type || 'red';
    await PIXI.Assets.load('resources/chars/' + type + '.png');
    const base = PIXI.Texture.from('resources/chars/' + type + '.png');

    // Direction: 0=bas, 1=gauche, 2=haut, 3=droite
    const direction = typeof player.direction === 'number' ? player.direction : 0;
    // Animation: cycle legacy [1,0,2,1]
    const animTable = [1, 0, 2, 1];
    let anim = 1;
    if (typeof player.animationStep === 'number') {
      anim = animTable[Math.floor(player.animationStep) % 4];
    }

    // Calcul du rectangle de la frame (colonne=direction, ligne=anim)
    const frameX = direction * frameWidth;
    const frameY = anim * frameHeight;
    const frame = new PIXI.Rectangle(frameX, frameY, frameWidth, frameHeight);
    const texture = new PIXI.Texture({ source: base.source, frame });

    if (!this.playerSprite) {
      this.playerSprite = new PIXI.Sprite(texture);
      this.playerSprite.zIndex = 1000;
      this.playerSprite.anchor.set(0.5, 1);
      this.playerLayer.addChild(this.playerSprite);
    } else {
      this.playerSprite.texture = texture;
      if (!this.playerLayer.children.includes(this.playerSprite)) {
        this.playerLayer.addChild(this.playerSprite);
      }
    }

    this.playerSprite.x = player.x * 32 + 16;
    this.playerSprite.y = player.y * 32 + 32;
  }

  constructor(width: number, height: number, domTarget: HTMLElement) {
    this.app = new PIXI.Application({ width, height });
    this.ready = this.app.init().then(() => {
      domTarget.appendChild(this.app!.canvas);
      this.mapContainer = new PIXI.Container();
      this.playerLayer = new PIXI.Container();
      this.app!.stage.addChild(this.mapContainer);
      this.app!.stage.addChild(this.playerLayer);
    });
  }

  async renderMap(map: MapData, offsetX = 0, offsetY = 0) {
    await this.ready;
    if (!this.mapContainer || !this.playerLayer) return;
    this.mapContainer.removeChildren();
    this.playerLayer.removeChildren();

    // --- Camera centrée sur le joueur ---
    // Récupère la position du joueur (doit être passée ou accessible via map/player)
    // Pour l'exemple, on suppose map.player existe et a x/y
    let player = (map as any).player || { x: Math.floor(map.width/2), y: Math.floor(map.height/2) };
    // Correction automatique : clamp la position du joueur dans la map
    if (typeof player.x !== 'number' || isNaN(player.x) || player.x < 0 || player.x >= map.width) {
      player.x = Math.floor(map.width/2);
    }
    if (typeof player.y !== 'number' || isNaN(player.y) || player.y < 0 || player.y >= map.height) {
      player.y = Math.floor(map.height/2);
    }
    const screenW = 800, screenH = 600;
    const tileW = map.tilewidth, tileH = map.tileheight;
    // Calcul caméra (legacy)
    const cameraX = player.x + 1 - (screenW / tileW) / 2;
    const cameraY = player.y - (screenH / tileH) / 2;
    const cameraOffsetX = Math.floor(tileW * -cameraX);
    const cameraOffsetY = Math.floor(tileH * -cameraY);
    this.mapContainer.x = 0;
    this.mapContainer.y = 0;

    for (const layer of map.layers) {
      if (layer.type !== 'tilelayer') continue;
      if (layer.properties && (layer.properties.overchars === '1' || layer.properties.animated === '1')) continue;
      if (!layer.data) continue;

      const layerContainer = new PIXI.Container();
      for (let y = 0; y < layer.height; y++) {
        for (let x = 0; x < layer.width; x++) {
          // Legacy : ignore tout offset layer (x/y), index local = gid - firstgid
          const idx = y * layer.width + x;
          const gid = layer.data[idx] || 0;
          if (!gid) continue;
          const ts = map.getTilesetOfTile(gid);
          if (!ts || !ts.imageSrc) continue;

          let texture: PIXI.Texture | null = null;
          try {
            await PIXI.Assets.load(ts.imageSrc);
            texture = PIXI.Texture.from(ts.imageSrc);
          } catch (e) {
            continue;
          }
          if (!texture || !(texture as any).source) continue;

          // Calcul legacy : index local
          const local = gid - ts.firstgid;
          const numTilesX = Math.floor(ts.imagewidth / ts.tilewidth);
          const srcx = (local % numTilesX) * ts.tilewidth;
          const srcy = Math.floor(local / numTilesX) * ts.tileheight;

          const tileTexture = new PIXI.Texture({
            source: (texture as any).source,
            frame: new PIXI.Rectangle(srcx, srcy, ts.tilewidth, ts.tileheight)
          });
          const sprite = new PIXI.Sprite(tileTexture);
          // Rendu legacy : pas d'offset layer, juste x/y et offset caméra
          sprite.x = x * tileW + cameraOffsetX;
          sprite.y = y * tileH + cameraOffsetY;
          layerContainer.addChild(sprite);
        }
      }
      this.mapContainer.addChild(layerContainer);
    }

    // --- DEBUG COLLISION LAYER ---
    if (this.debugCollision && map.dataLayer) {
      const tileW = map.tilewidth;
      const tileH = map.tileheight;
      const graphics = new PIXI.Graphics();
      graphics.setStrokeStyle({
        width: 2,
        color: 0xff0000,
        alpha: 1
      });
      const screenW = 800, screenH = 600;
      const player = (map as any).player || { x: Math.floor(map.width/2), y: Math.floor(map.height/2) };
      const cameraX = player.x + 1 - (screenW / tileW) / 2;
      const cameraY = player.y - (screenH / tileH) / 2;
      const cameraOffsetX = Math.floor(tileW * -cameraX);
      const cameraOffsetY = Math.floor(tileH * -cameraY);
      for (let y = 0; y < map.dataLayer.height; y++) {
        for (let x = 0; x < map.dataLayer.width; x++) {
          const idx = y * map.dataLayer.width + x;
          const gid: number = map.dataLayer.data ? map.dataLayer.data[idx] : 0;
          if (!gid) continue;
          const ts = map.getTilesetOfTile(gid);
          if (!ts) continue;
          const local = gid - ts.firstgid;
          // Affiche tous les tiles du layer collision en bleu
          if (gid) {
            graphics.setStrokeStyle({
              width: 2,
              color: 0x0000ff,
              alpha: 1
            });
            graphics.rect(
              x * tileW + cameraOffsetX,
              y * tileH + cameraOffsetY,
              tileW,
              tileH
            );
          }
        }
      }
      this.mapContainer.addChild(graphics);
    }
  }

  setDebugCollision(enabled: boolean) {
    this.debugCollision = enabled;
  }
}