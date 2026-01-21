export type TileProperties = Record<string, string | number | undefined>;

export class Tileset {
  firstgid: number;
  imageSrc: string | null;
  image: HTMLImageElement | null = null;
  tilewidth: number;
  tileheight: number;
  imagewidth: number;
  imageheight: number;
  tileproperties: TileProperties[] = [];
  loaded = false;

  constructor(data: any) {
    this.firstgid = data.firstgid || 1;
    this.imageSrc = data.image ? 'resources/' + data.image.replace('../', '') : null;
    this.tilewidth = data.tilewidth;
    this.tileheight = data.tileheight;
    this.imagewidth = data.imagewidth;
    this.imageheight = data.imageheight;
    if (data.tileproperties) {
      for (const k of Object.keys(data.tileproperties)) {
        this.tileproperties[Number(k)] = data.tileproperties[k];
      }
    }
    // Defer image creation to ResourceManager/Loader to centralize loading
    if (!this.imageSrc || this.imageSrc === 'tilesets/data.png') {
      this.loaded = true;
    }
  }

  containsTile(gid: number) {
    return gid >= this.firstgid && gid < this.firstgid + this.numTiles();
  }

  numTiles() {
    return Math.floor((this.imagewidth / this.tilewidth) * (this.imageheight / this.tileheight));
  }
}

export class Layer {
  type: string;
  data: number[] | null = null;
  width: number = 0;
  height: number = 0;
  x: number = 0;
  y: number = 0;
  properties: Record<string, any> = {};
  objects: any[] = [];

  constructor(raw: any) {
    this.type = raw.type;
    if (this.type === 'tilelayer') this.data = raw.data || [];
    this.width = raw.width || 0;
    this.height = raw.height || 0;
    this.x = raw.x || 0;
    this.y = raw.y || 0;
    this.properties = raw.properties || {};
    this.objects = raw.objects || [];
  }
}

export class MapData {
  id: string;
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  tilesets: Tileset[] = [];
  layers: Layer[] = [];
  dataLayer: Layer | null = null;
  properties: Record<string, any> = {};
  // cache for static rendering
  cacheCanvas?: HTMLCanvasElement;
  cacheOffsetX: number = 0;
  cacheOffsetY: number = 0;

  constructor(id: string, raw: any) {
    this.id = id;
    this.width = raw.width;
    this.height = raw.height;
    this.tilewidth = raw.tilewidth;
    this.tileheight = raw.tileheight;
    this.properties = raw.properties || {};

    for (const t of raw.tilesets || []) this.tilesets.push(new Tileset(t));
    for (const l of raw.layers || []) {
      const layer = new Layer(l);
      if (layer.properties && layer.properties.data_layer === '1') this.dataLayer = layer;
      else this.layers.push(layer);
    }
  }

  getTilesetOfTile(gid: number): Tileset | null {
    for (let i = this.tilesets.length - 1; i >= 0; --i) {
      if (gid >= this.tilesets[i].firstgid) return this.tilesets[i];
    }
    return null;
  }

  isTileSolid(x: number, y: number): boolean {
    if (!this.dataLayer) return false;
    if (x < this.dataLayer.x || y < this.dataLayer.y || x >= this.dataLayer.x + this.dataLayer.width || y >= this.dataLayer.y + this.dataLayer.height) return false;
    const idx = (y - this.dataLayer.y) * this.dataLayer.width + (x - this.dataLayer.x);
    const gid = (this.dataLayer.data && this.dataLayer.data[idx]) || 0;
    if (!gid) return false;
    const ts = this.getTilesetOfTile(gid);
    if (!ts) return false;
    const local = gid - ts.firstgid;
    const prop = ts.tileproperties[local];
    if (!prop) {
      try { if ((window as any).pokemmo_ts && (window as any).pokemmo_ts._diag) console.log('[Map] isTileSolid no prop', x, y, 'gid=', gid); } catch(e) {}
      return false;
    }
    const v = (prop as any).solid;
    if (v === undefined || v === null) {
      try { if ((window as any).pokemmo_ts && (window as any).pokemmo_ts._diag) console.log('[Map] isTileSolid prop missing solid', x, y, 'prop=', prop); } catch(e) {}
      return false;
    }
    const s = String(v).toLowerCase();
    const res = (s === '1' || s === 'true');
    try { if ((window as any).pokemmo_ts && (window as any).pokemmo_ts._diag) console.log('[Map] isTileSolid', x, y, 'idx=', idx, 'gid=', gid, 'firstgid=', ts.firstgid, 'local=', local, 'prop=', prop, 'result=', res); } catch(e) {}
    return res;
  }

  isTileWater(x: number, y: number): boolean {
    if (!this.dataLayer) return false;
    if (x < this.dataLayer.x || y < this.dataLayer.y || x >= this.dataLayer.x + this.dataLayer.width || y >= this.dataLayer.y + this.dataLayer.height) return false;
    const idx = (y - this.dataLayer.y) * this.dataLayer.width + (x - this.dataLayer.x);
    const gid = (this.dataLayer.data && this.dataLayer.data[idx]) || 0;
    if (!gid) return false;
    const ts = this.getTilesetOfTile(gid);
    if (!ts) return false;
    const local = gid - ts.firstgid;
    const prop = ts.tileproperties[local];
    if (!prop) {
      try { if ((window as any).pokemmo_ts && (window as any).pokemmo_ts._diag) console.log('[Map] isTileWater no prop', x, y, 'gid=', gid); } catch(e) {}
      return false;
    }
    const v = (prop as any).water;
    if (v === undefined || v === null) {
      try { if ((window as any).pokemmo_ts && (window as any).pokemmo_ts._diag) console.log('[Map] isTileWater prop missing water', x, y, 'prop=', prop); } catch(e) {}
      return false;
    }
    const s = String(v).toLowerCase();
    const res = (s === '1' || s === 'true');
    try { if ((window as any).pokemmo_ts && (window as any).pokemmo_ts._diag) console.log('[Map] isTileWater', x, y, 'idx=', idx, 'gid=', gid, 'firstgid=', ts.firstgid, 'local=', local, 'prop=', prop, 'result=', res); } catch(e) {}
    return res;
  }

  isTileLedge(x: number, y: number): boolean {
    if (!this.dataLayer) return false;
    if (x < this.dataLayer.x || y < this.dataLayer.y || x >= this.dataLayer.x + this.dataLayer.width || y >= this.dataLayer.y + this.dataLayer.height) return false;
    const idx = (y - this.dataLayer.y) * this.dataLayer.width + (x - this.dataLayer.x);
    const gid = (this.dataLayer.data && this.dataLayer.data[idx]) || 0;
    if (!gid) return false;
    const ts = this.getTilesetOfTile(gid);
    if (!ts) return false;
    const local = gid - ts.firstgid;
    const prop = ts.tileproperties[local];
    if (!prop) {
      try { if ((window as any).pokemmo_ts && (window as any).pokemmo_ts._diag) console.log('[Map] isTileLedge no prop', x, y, 'gid=', gid); } catch(e) {}
      return false;
    }
    const v = (prop as any).ledge;
    if (v === undefined || v === null) {
      try { if ((window as any).pokemmo_ts && (window as any).pokemmo_ts._diag) console.log('[Map] isTileLedge prop missing ledge', x, y, 'prop=', prop); } catch(e) {}
      return false;
    }
    const s = String(v).toLowerCase();
    const res = (s === '1' || s === 'true');
    try { if ((window as any).pokemmo_ts && (window as any).pokemmo_ts._diag) console.log('[Map] isTileLedge', x, y, 'idx=', idx, 'gid=', gid, 'firstgid=', ts.firstgid, 'local=', local, 'prop=', prop, 'result=', res); } catch(e) {}
    return res;
  }

  getLedgeDir(x: number, y: number): number {
    if (!this.dataLayer) return -1;
    if (x < this.dataLayer.x || y < this.dataLayer.y || x >= this.dataLayer.x + this.dataLayer.width || y >= this.dataLayer.y + this.dataLayer.height) return -1;
    const idx = (y - this.dataLayer.y) * this.dataLayer.width + (x - this.dataLayer.x);
    const gid = (this.dataLayer.data && this.dataLayer.data[idx]) || 0;
    if (!gid) return -1;
    const ts = this.getTilesetOfTile(gid);
    if (!ts) return -1;
    const local = gid - ts.firstgid;
    const prop = ts.tileproperties[local];
    if (prop && prop.ledge === '1') return Number(prop.ledge_dir) || 0;
    return -1;
  }
}

export default MapData;
