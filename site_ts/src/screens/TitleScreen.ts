import { Socket } from 'socket.io-client';
import { UI, TextInput, UIButton } from '../ui/UI';
import { drawRoundedRect } from '../util/Util';
import { setToken, fetchWithAuth, getToken } from '../auth';
import { mapResultToMessage } from '../i18n/messages';
import type { LoginResult, LoginResponse, MeResponse } from '../types/socket';

export class TitleScreen {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  socket: Socket;
  onOpenRegister: (() => void) | null = null;
  sentLogin: boolean = false;
  loginInitTime: number | null = null;
  currentUsername: string | null = null;
  loginError: string | null = null;
  _enterHook?: () => void;

  static usernameTxt: TextInput;
  static passwordTxt: TextInput;
  static loginButton: UIButton;
  static registerButton: UIButton;

  constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, socket: Socket, onOpenRegister?: () => void) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.socket = socket;
    if (onOpenRegister) this.onOpenRegister = onOpenRegister;

    const inputX = 350;
    TitleScreen.usernameTxt = new TextInput(inputX, 321, 130);
    TitleScreen.usernameTxt.maxLength = 10;
    UI.pushInput(TitleScreen.usernameTxt);

    TitleScreen.passwordTxt = new TextInput(inputX, 346, 130);
    TitleScreen.passwordTxt.maxLength = 64;
    TitleScreen.passwordTxt.isPassword = true;
    UI.pushInput(TitleScreen.passwordTxt);

    // if redirected from RegisterScreen, prefill with last registered credentials
    try {
        const last = window.__lastRegister;
      if (last && last.username) {
        TitleScreen.usernameTxt.value = last.username;
        TitleScreen.passwordTxt.value = last.password || '';
          delete window.__lastRegister;
      }
    } catch (e) {}

    TitleScreen.loginButton = new UIButton(455, 375, 30, 30, '');
    TitleScreen.loginButton.spriteSrcX = 0;
    TitleScreen.loginButton.spriteSrcW = 50;
    TitleScreen.loginButton.spriteSrcH = 50;
    TitleScreen.loginButton.drawOffsetX = -10;
    TitleScreen.loginButton.drawOffsetY = -10;
    TitleScreen.loginButton.onSubmit = () => this.onLoginSubmit();
    UI.pushInput(TitleScreen.loginButton);

    TitleScreen.registerButton = new UIButton(310, 375, 130, 30, '');
    TitleScreen.registerButton.spriteSrcX = 50;
    TitleScreen.registerButton.spriteSrcW = 150;
    TitleScreen.registerButton.spriteSrcH = 50;
    TitleScreen.registerButton.drawOffsetX = -10;
    TitleScreen.registerButton.drawOffsetY = -10;
    TitleScreen.registerButton.onSubmit = () => this.onRegisterSubmit();
    UI.pushInput(TitleScreen.registerButton);

    // listen socket login_result
    this.socket.on('login_result', (data: LoginResult) => {
      (async () => {
        if (data && data.result === 'success') {
          console.log('[TitleScreen] login success');
          this.loginError = null;
          if (data.token) {
            try { setToken(data.token); } catch (e) { console.warn('failed to set token', e); }
          }
          // verify token by calling /me and display username
          try {
            const apiBase = window.API_BASE || 'http://localhost:2827';
            const resp = await fetchWithAuth(apiBase + '/me');
            const j = (await resp.json()) as MeResponse;
            if (j && j.result === 'success' && j.user && j.user.username) {
              this.currentUsername = (j.user && j.user.username) ?? null;
            } else {
              if (j && j.result === 'invalid_token') {
                console.warn('[TitleScreen] token invalid according to /me; showing UX message (not purging token)');
                this.currentUsername = null;
                this.loginError = 'Session expirée — reconnectez‑vous';
              }
            }
            // clear transient login timer on success
            try { this.loginInitTime = null; } catch(e) {}
          } catch (e) { console.warn('me fetch failed', e); }
        } else {
          console.warn('[TitleScreen] login failed', data && data.result);
          this.loginError = mapResultToMessage(data && data.result ? data.result : 'login_failed');
          // clear password like legacy client and trigger transient error display
          try { TitleScreen.passwordTxt.value = ''; } catch(e) {}
          this.loginInitTime = Date.now();
        }
        this.sentLogin = false;
        this.render();
      })();
    });

    // if a token exists on load, try to validate it and hydrate username
    (async () => {
      try {
        if (getToken()) {
          const apiBase = window.API_BASE || 'http://localhost:2827';
          const resp = await fetchWithAuth(apiBase + '/me');
          const j = (await resp.json()) as MeResponse;
          if (j && j.result === 'success' && j.user && j.user.username) {
            this.currentUsername = (j.user && j.user.username) ?? null;
          } else if (j && j.result === 'invalid_token') {
            this.loginError = 'Session expirée — reconnectez‑vous';
          }
          this.render();
        }
      } catch (e) { /* ignore startup me failures */ }
    })();

    // hook Enter key to submit when focused in username/password
    const onEnter = () => {
      if (UI.focused === TitleScreen.usernameTxt || UI.focused === TitleScreen.passwordTxt) this.onLoginSubmit();
    };
    UI.hookEnterButton(onEnter);
    // remember to unhook on destroy
      this._enterHook = onEnter;
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#66BBFF';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    // draw logo placeholder
      ctx.drawImage(window.TitleScreen?.titleLogo?.obj || document.createElement('canvas'), 117, 80);

    // if we have a current username, show it under the logo (legacy-style small text)
    if (this.currentUsername) {
      ctx.fillStyle = '#000';
      ctx.font = '14px Font3';
      ctx.textAlign = 'center';
      ctx.fillText(this.currentUsername, this.canvas.width/2, 170);
    }

    if (this.loginError) {
      ctx.fillStyle = 'rgba(200,0,0,0.9)';
      ctx.font = '12px Font3';
      ctx.textAlign = 'center';
      ctx.fillText(this.loginError, this.canvas.width/2, 190);
    }

    // draw loading spinner if performing login (legacy spinner frames 12x)
    if (this.sentLogin && this.loginInitTime != null) {
      const loading = window.TitleScreen?.loadingImg?.obj as CanvasImageSource | undefined;
      const now = Date.now();
      const loadingImg = loading as HTMLImageElement | undefined;
      if (loading && ((loadingImg && loadingImg.complete) || (loading instanceof HTMLCanvasElement))) {
        const frame = Math.floor((now - this.loginInitTime) / 100) % 12;
        try {
          ctx.drawImage(loading, 0, 32 * frame, 32, 32, 384, 425, 32, 32);
        } catch (e) {}
      }
    }

    // legacy panel and inputs rendering (match Haxe)
    const panelX = 300;
    const panelY = 275;
    const panelW = 200;
    const panelH = 140;
    const now = Date.now();

    // draw panel background and title
    drawRoundedRect(ctx, panelX, panelY, panelW, panelH, 15, '#FFFFFF', 0.6);
    ctx.fillStyle = '#000';
    ctx.font = '21px Font3';
    // center title explicitly to avoid textAlign bleed from earlier draws
    ctx.textAlign = 'center';
    ctx.fillText('Login', panelX + panelW/2, 300);
    // legacy labels
    ctx.font = '12px Font3';
    // Ensure left alignment for labels (username display uses center)
    ctx.textAlign = 'left';
    const labelX = panelX + 10;
    ctx.fillText('ID:', labelX, 335);
    ctx.fillText('PW:', labelX, 360);

    // draw input backgrounds and position inputs to match drawn boxes
    const inputOffsetX = 50; // offset inside panel to match legacy layout
    const inputX = panelX + inputOffsetX;
    TitleScreen.passwordTxt.x = inputX;
    drawRoundedRect(ctx, inputX, 321, 130, 18, 5, '#FFFFFF', 1.0);
    drawRoundedRect(ctx, inputX, 346, 130, 18, 5, '#FFFFFF', 1.0);

    // ensure input text uses left alignment (prevents centering leftover from labels)
    ctx.textAlign = 'left';
    TitleScreen.usernameTxt.draw(ctx);
    TitleScreen.passwordTxt.draw(ctx);

    // Enable/disable login button based on input validation (legacy: username >=4 and password >=8)
    try {
      const ulen = (TitleScreen.usernameTxt && TitleScreen.usernameTxt.value) ? TitleScreen.usernameTxt.value.trim().length : 0;
      const plen = (TitleScreen.passwordTxt && TitleScreen.passwordTxt.value) ? TitleScreen.passwordTxt.value.length : 0;
      TitleScreen.loginButton.disabled = !(ulen >= 4 && plen >= 8);
    } catch (e) {}

    // transient invalid-credentials message like legacy (fade over 4s)
    // Only show when an actual login error occurred (loginError set) and within the recent window
    if (this.loginError && this.loginInitTime && (Date.now() - this.loginInitTime < 4000)) {
      const elapsed = Date.now() - this.loginInitTime;
      const alpha = Math.max(0, Math.min(1, 4 - elapsed / 1000));
      ctx.save();
      ctx.fillStyle = 'rgba(200,0,0,' + alpha + ')';
      ctx.textAlign = 'center';
      ctx.font = '12px Font3';
      ctx.fillText(this.loginError === 'invalid_token' ? 'Session expirée — reconnectez‑vous' : 'Invalid username or password', 400, 430);
      ctx.restore();
    }

    // update button positions to remain pixel-perfect
    TitleScreen.loginButton.draw(ctx);
    TitleScreen.registerButton.draw(ctx);

    ctx.restore();
  }

  onLoginSubmit() {
    if (this.sentLogin) return;
    const username = TitleScreen.usernameTxt.value.trim();
    const password = TitleScreen.passwordTxt.value;
    if (username.length < 4 || password.length < 8) return;
    // minimal logging
    // clear any previous login error so we don't show an error while the new request is pending
    this.loginError = null;
    this.sentLogin = true;
    this.loginInitTime = Date.now();
    this.render();
    // Try REST login first (more reliable), fall back to socket login for legacy compatibility
    (async () => {
      try {
          const apiBase = window.API_BASE || 'http://localhost:2827';
        
        let resp: Response | null = null;
        try {
          resp = await fetch(apiBase + '/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
          });
          console.log('[TitleScreen] /login status', resp.status);
        } catch (e) {
          console.warn('[TitleScreen] /login fetch failed', e);
          resp = null;
        }
        if (resp) {
          let j: LoginResponse | null = null;
          try { j = (await resp.json()) as LoginResponse; } catch(e) { console.warn('failed to parse /login JSON', e); }
          if (j && j.result === 'success' && j.token) {
            try { setToken(j.token); } catch (e) { console.warn('failed to set token', e); }
            // hydrate username via /me
            try { const me = await fetch(apiBase + '/me', { headers: { Authorization: 'Bearer ' + (j.token ?? '') } }); const mj = (await me.json()) as MeResponse; if (mj && mj.result === 'success') this.currentUsername = (mj.user && mj.user.username) ?? null; } catch(e) { console.warn('me after rest login failed', e); }
            this.loginError = null;
            // clear transient login timer so the invalid message won't show after success
            this.loginInitTime = null;
            this.sentLogin = false;
            // Also emit socket login so legacy socket flows (newGame/startGame) are triggered
            try {
              const doSocketLogin = () => {
                try { this.socket.emit('login', { username, password }); } catch(e) { console.warn('socket emit after REST login failed', e); }
              };
              // if socket is connected, emit immediately, otherwise wait for connect (setToken may have triggered reconnect)
              try {
                const sockAny = this.socket as any;
                if (sockAny && sockAny.connected) {
                  doSocketLogin();
                } else {
                  const onConnect = () => { try { doSocketLogin(); } finally { try { this.socket.off('connect', onConnect); } catch(e) {} } };
                  this.socket.once('connect', onConnect);
                  // safety timeout: if no connect within 2s, attempt emit anyway
                  setTimeout(() => { try { doSocketLogin(); this.socket.off('connect', onConnect); } catch(e) {} }, 2000);
                }
              } catch(e) { try { this.socket.emit('login', { username, password }); } catch(err) { console.warn('socket emit after REST login failed (fallback)', err); } }
            } catch(e) { console.warn('socket emit after REST login failed outer', e); }
            this.render();
            return;
          }
        }
      } catch (e) { /* ignore REST login errors and fallback to socket */ }
      // fallback to socket login
      console.log('[TitleScreen] falling back to socket login emit', { username });
      try { this.socket.emit('login', { username, password }); } catch(e) { console.warn('socket emit failed', e); }
    })();
  }

  onRegisterSubmit() {
    if (this.sentLogin) return;
    // navigate to register screen (preserve fields)
    if (this.onOpenRegister) {
      // copy values into global RegisterScreen inputs when it opens
      this.onOpenRegister();
    }
  }

  destroy() {
    UI.removeInput(TitleScreen.usernameTxt);
    UI.removeInput(TitleScreen.passwordTxt);
    UI.removeInput(TitleScreen.loginButton);
    UI.removeInput(TitleScreen.registerButton);
    // remove enter hook if set
    try { if (this._enterHook) UI.unHookEnterButton(this._enterHook); } catch(e) {}
  }
}
