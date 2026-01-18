export class MapManager {
  // Minimal placeholder for map loading/lookup.
  async loadMap(mapName: string) {
    // In a fuller implementation this would load tilesets, cache canvases, etc.
    return { mapName };
  }
}

export const mapManager = new MapManager();
