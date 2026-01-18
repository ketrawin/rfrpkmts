export function getToken(): string | null {
  try {
    return localStorage.getItem('pokemmo_jwt');
  } catch (e) {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem('pokemmo_jwt', token);
    else localStorage.removeItem('pokemmo_jwt');
  } catch (e) {
    console.warn('failed to access localStorage', e);
  }

  // If a socket is exposed on window, update its auth and reconnect to include the token in the next handshake
  try {
    const pok = window.pokemmo_ts;
    if (pok && pok.socket) {
      // set auth object for next handshake
      pok.socket.auth = token ? { token } : {};
      // Best-effort non-disruptive update: if socket is connected, inform server via a lightweight event
      // so we avoid a disconnect/connect cycle that causes transient drops.
      try {
        if (pok.socket.connected) {
          try {
            if (token != null) {
              pok.socket.emit('tokenUpdate', { token });
            }
          } catch(e) {}
        } else {
          // if not connected, attempt a single connect to resume handshake with new auth
          try { pok.socket.connect(); } catch(e) {}
        }
      } catch(e) {}
    }
  } catch (e) {
    // ignore
  }
}

export async function fetchWithAuth(input: RequestInfo, init?: RequestInit) {
  const headers = new Headers(init?.headers as HeadersInit || {});
  const token = getToken();
  if (token) headers.set('Authorization', 'Bearer ' + token);
  const merged: RequestInit = Object.assign({}, init || {}, { headers });
  const resp = await fetch(input, merged);
  if (resp.status === 401) {
    console.warn('[fetchWithAuth] received 401 Unauthorized for', typeof input === 'string' ? input : 'request');
    // do not purge token automatically to remain faithful to legacy UX
  }
  return resp;
}

export function attachTokenToSocketOptions(opts: any = {}) {
  const token = getToken();
  opts.auth = Object.assign({}, opts.auth || {}, token ? { token } : {});
  return opts;
}
