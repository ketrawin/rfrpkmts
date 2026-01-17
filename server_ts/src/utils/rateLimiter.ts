export type RateState = { count: number; firstSeen: number };

export function createRateLimiter(maxAttempts: number, windowMs: number) {
  const map: Map<string, RateState> = new Map();
  return {
    isRateLimited(ip: string) {
      const now = Date.now();
      const st = map.get(ip);
      if (!st) {
        map.set(ip, { count: 1, firstSeen: now });
        return false;
      }
      if (now - st.firstSeen > windowMs) {
        map.set(ip, { count: 1, firstSeen: now });
        return false;
      }
      st.count++;
      map.set(ip, st);
      return st.count > maxAttempts;
    },
    reset() {
      map.clear();
    }
  };
}
