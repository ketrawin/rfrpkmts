class ResourceManager {
  private images: Map<string, Promise<HTMLImageElement>> = new Map();
  private jsons: Map<string, Promise<any>> = new Map();

  loadImage(src: string): Promise<HTMLImageElement> {
    if (!src) return Promise.reject(new Error('empty src')); // Ensure empty src check
    const key = src;
    if (this.images.has(key)) return this.images.get(key)!;
    const p = new Promise<HTMLImageElement>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(img);
      img.src = src;
    });
    this.images.set(key, p);
    return p;
  }

  loadJSON(url: string): Promise<any> {
    if (!url) return Promise.reject(new Error('empty url')); // Ensure empty url check
    if (this.jsons.has(url)) return this.jsons.get(url)!;
    const p = fetch(url).then(r => { if (!r.ok) throw new Error('fetch failed'); return r.json(); }).catch(e => { return Promise.reject(e); });
    this.jsons.set(url, p);
    return p;
  }

  async waitForAll(timeoutMs: number = 5000) {
    const imgs = Array.from(this.images.values());
    const jsons = Array.from(this.jsons.values());
    const all = imgs.concat(jsons) as Promise<any>[];
    if (all.length === 0) return;
    await Promise.race([Promise.allSettled(all), new Promise((r) => setTimeout(r, timeoutMs))]);
  }
}

const resourceManager = new ResourceManager();
export default resourceManager;
