import { Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from '../types/socketEvents';
import { UI, TextInput, UIButton } from "../ui/UI";
import { setToken } from '../auth';
import { drawRoundedRect } from "../util/Util";
import type { RegistrationResult, LoginResponse, MeResponse } from '../types/socket';

export class RegisterScreen {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  sentRequest: boolean = false;
  socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  requestInitTime: number | null = null;
  lastResult: string | null = null;
  lastResultTime: number | null = null;

  // Inputs mirroring legacy positions
  static usernameTxt: TextInput;
  static passwordTxt: TextInput;
  static password2Txt: TextInput;
  static emailTxt: TextInput;
  static confirmBtn: UIButton;
  static cancelBtn: UIButton;

  constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, socket: Socket<ServerToClientEvents, ClientToServerEvents>, onBack?: () => void, initial?: { username?: string; password?: string }) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.socket = socket;
    // legacy fixed positions
    // create inputs at legacy positions (x=245)
    const inputX = 245;
    RegisterScreen.usernameTxt = new TextInput(inputX, 321, 135);
    RegisterScreen.usernameTxt.maxLength = 10;
    UI.pushInput(RegisterScreen.usernameTxt);

    RegisterScreen.passwordTxt = new TextInput(inputX, 346, 135);
    RegisterScreen.passwordTxt.maxLength = 64; RegisterScreen.passwordTxt.isPassword = true;
    UI.pushInput(RegisterScreen.passwordTxt);

    RegisterScreen.password2Txt = new TextInput(inputX, 371, 135);
    RegisterScreen.password2Txt.maxLength = 64; RegisterScreen.password2Txt.isPassword = true;
    UI.pushInput(RegisterScreen.password2Txt);

    RegisterScreen.emailTxt = new TextInput(inputX, 396, 135);
    RegisterScreen.emailTxt.maxLength = 100;
    UI.pushInput(RegisterScreen.emailTxt);

    // captcha removed for refactor (dev flow)

    // legacy confirm and cancel positions
    RegisterScreen.confirmBtn = new UIButton(410, 490, 130, 30, 'Confirm');
    RegisterScreen.confirmBtn.spriteSrcX = 200;
    RegisterScreen.confirmBtn.onSubmit = () => this.onConfirm();
    UI.pushInput(RegisterScreen.confirmBtn);

    RegisterScreen.cancelBtn = new UIButton(270, 490, 130, 30, '');
    RegisterScreen.cancelBtn.spriteSrcX = 350;
    RegisterScreen.cancelBtn.spriteSrcW = 150;
    RegisterScreen.cancelBtn.spriteSrcH = 50;
    RegisterScreen.cancelBtn.drawOffsetX = -15;
    RegisterScreen.cancelBtn.drawOffsetY = -15;
    RegisterScreen.cancelBtn.onSubmit = () => {
      if (onBack) onBack(); else console.warn('Register cancel pressed but no onBack callback provided');
    };
    UI.pushInput(RegisterScreen.cancelBtn);

    // apply initial values if provided
    if (initial) {
      if (initial.username) RegisterScreen.usernameTxt.value = initial.username;
      if (initial.password) { RegisterScreen.passwordTxt.value = initial.password; RegisterScreen.password2Txt.value = initial.password; }
    }

    // listen server response
    this.socket.on('registration', async (data: RegistrationResult) => {
      if (data && data.result === 'success') {
        console.log('Registration success');
        this.lastResult = 'success';
        // Attempt to login via REST to obtain JWT and store it for subsequent requests
          try {
            const apiBase = window.API_BASE || 'http://localhost:2827';
          const resp = await fetch(apiBase + '/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: RegisterScreen.usernameTxt.value, password: RegisterScreen.passwordTxt.value })
          });
          const j = (await resp.json()) as LoginResponse;
          if (j && j.result === 'success' && j.token) {
            try { setToken(j.token); } catch (e) { console.warn('failed to store token', e); }
            console.log('Logged in and stored JWT');
            // If a back callback was provided (open title), go back so TitleScreen can hydrate /me
            if (onBack) {
              // store last registered credentials temporarily so TitleScreen can prefill inputs
              try { window.__lastRegister = { username: RegisterScreen.usernameTxt.value, password: RegisterScreen.passwordTxt.value }; } catch (e) {}
              try { onBack(); } catch (e) {}
              return;
            }
            // otherwise, try to hydrate current screen user display
            try {
              const apiBase = window.API_BASE || 'http://localhost:2827';
              fetch(apiBase + '/me', { headers: { Authorization: 'Bearer ' + j.token } }).then(r=>r.json()).then((mj: MeResponse)=>{
                if (mj && mj.result === 'success' && window.pokemmo_ts && window.pokemmo_ts.current) {
                  window.pokemmo_ts.current.currentUsername = mj.user && mj.user.username;
                  try { window.pokemmo_ts.current.render && window.pokemmo_ts.current.render(); } catch(e){}
                }
              }).catch(()=>{});
            } catch(e) {}
          } else {
            console.warn('Login after registration failed', j);
          }
        } catch (e) {
          console.error('login fetch error', e);
        }
      } else {
        console.log('Registration error', data && data.result);
        this.lastResult = data && data.result ? data.result : 'unknown';
      }
      this.lastResultTime = Date.now();
      this.sentRequest = false;
      this.requestInitTime = null;
      this.render();
    });
  }

    destroy() {
    try {
      // remove socket listener
      if (this.socket && typeof this.socket.off === 'function') {
        this.socket.off('registration');
      }
    } catch (e) {}
    UI.removeInput(RegisterScreen.confirmBtn);
    UI.removeInput(RegisterScreen.cancelBtn);
    UI.removeInput(RegisterScreen.usernameTxt);
    UI.removeInput(RegisterScreen.passwordTxt);
    UI.removeInput(RegisterScreen.password2Txt);
    UI.removeInput(RegisterScreen.emailTxt);
  }

  render() {
    const ctx = this.ctx;
    const now = Date.now();
    // clear previous frame and redraw background to avoid cumulative artifacts
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#66BBFF';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();

    // background panel (centered horizontally)
    const panelW = 250;
    const panelH = 150;
    const panelX = Math.round((this.canvas.width - panelW) / 2);
    const panelY = 275;
    ctx.drawImage(window.TitleScreen?.titleLogo?.obj || document.createElement('canvas'), 117, 80);
    drawRoundedRect(ctx, panelX, panelY, panelW, panelH, 15, '#FFFFFF', 0.6);

    ctx.fillStyle = '#000';
    ctx.font = '21px Font3';
    ctx.fillText('Register', panelX + panelW/2 - Math.round(ctx.measureText('Register').width / 2), 300);

    // legacy labels
    ctx.font = '12px Font3';
    const labelX = panelX + 10;
    ctx.fillText('ID:', labelX, 335);
    ctx.fillText('PW:', labelX, 360);
    ctx.fillText('PW (Again):', labelX, 385);
    ctx.fillText('Email:', labelX, 410);

      // draw input backgrounds and highlight errors like legacy
      let cstr = '#FFFFFF';
      if (this.lastResult && this.lastResultTime) {
        const elapsed = now - this.lastResultTime;
        const c2 = Math.floor(0xFF * (elapsed / 2000));
        const rr = (0xFF0000 | (c2 << 8) | c2) & 0xFFFFFF;
        cstr = '#' + ('000000' + rr.toString(16)).slice(-6);
      }
      // username
      const inputOffsetX = 100; // legacy offset inside panel
      const inputX = panelX + inputOffsetX;
      // apply computed X to inputs so their internal positions match drawn boxes
      RegisterScreen.usernameTxt.x = inputX;
      RegisterScreen.passwordTxt.x = inputX;
      RegisterScreen.password2Txt.x = inputX;
      RegisterScreen.emailTxt.x = inputX;
      const usernameColor = (this.lastResult && ['short_username','long_username','invalid_username','username_already_exists'].includes(this.lastResult) && this.lastResultTime && (now - this.lastResultTime < 2000)) ? cstr : '#FFFFFF';
      drawRoundedRect(ctx, inputX, 321, 135, 18, 5, usernameColor, 1.0);
      // password
      const passwordColor = (this.lastResult && ['short_password','long_password','invalid_password','mismatch_password'].includes(this.lastResult) && this.lastResultTime && (now - this.lastResultTime < 2000)) ? cstr : '#FFFFFF';
      drawRoundedRect(ctx, inputX, 346, 135, 18, 5, passwordColor, 1.0);
      // password2
      const password2Color = (this.lastResult && this.lastResult === 'mismatch_password' && this.lastResultTime && (now - this.lastResultTime < 2000)) ? cstr : '#FFFFFF';
      drawRoundedRect(ctx, inputX, 371, 135, 18, 5, password2Color, 1.0);
      // email
      const emailColor = (this.lastResult && this.lastResult === 'invalid_email' && this.lastResultTime && (now - this.lastResultTime < 2000)) ? cstr : '#FFFFFF';
      drawRoundedRect(ctx, inputX, 396, 135, 18, 5, emailColor, 1.0);

      // now draw input text
      ctx.textAlign = 'left';
        RegisterScreen.usernameTxt.draw(ctx);
        RegisterScreen.passwordTxt.draw(ctx);
        RegisterScreen.password2Txt.draw(ctx);
        RegisterScreen.emailTxt.draw(ctx);
      // captcha omitted in refactor: no captcha image or input drawn

    // Confirm enabled when not sending a request (captcha removed)
    RegisterScreen.confirmBtn.disabled = this.sentRequest;
    // position the pair of buttons centered under the panel (preserve small gap)
    const centerX2 = Math.round(this.canvas.width / 2);
    const btnW = 130;
    const gap = 10;
    const totalW = btnW * 2 + gap; // two buttons + gap
    const pairLeftX = Math.round(centerX2 - totalW / 2);
    RegisterScreen.cancelBtn.x = pairLeftX;
    RegisterScreen.confirmBtn.x = pairLeftX + btnW + gap;
    // draw both buttons explicitly so cancel is visible
    RegisterScreen.confirmBtn.draw(ctx);
    RegisterScreen.cancelBtn.draw(ctx);

    // draw loading spinner if sending request
    if (this.sentRequest && this.requestInitTime != null) {
      const loading = window.TitleScreen && window.TitleScreen.loadingImg && window.TitleScreen.loadingImg.obj;
      if (loading && loading.complete) {
        const frame = Math.floor((now - this.requestInitTime) / 100) % 12;
        try {
          ctx.drawImage(loading, 0, 32 * frame, 32, 32, 384, 440, 32, 32);
        } catch (e) {}
      }
    }

    // show result/error message for a few seconds
    if (this.lastResult && this.lastResultTime && (now - this.lastResultTime < 4000)) {
      let errorMsg: string | null = null;
      try { errorMsg = window.pokemmo_ts && window.pokemmo_ts.mapResultToMessage ? window.pokemmo_ts.mapResultToMessage(this.lastResult) : null; } catch(e) { errorMsg = null; }
      // fallback to import-local mapping if available
      if (!errorMsg) {
        try { const { mapResultToMessage } = require('../i18n/messages'); errorMsg = mapResultToMessage(this.lastResult); } catch(e) { errorMsg = 'Erreur : ' + this.lastResult; }
      }
      if (errorMsg) {
        ctx.save();
        ctx.fillStyle = 'rgba(200,0,0,' + Math.min(1, 4 - (now - this.lastResultTime)/1000) + ')';
        ctx.textAlign = 'center';
        ctx.fillText(errorMsg, this.canvas.width/2, 465);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  onConfirm() {
    if (this.sentRequest) return;

    let requestError: string | null = null;
    const username = RegisterScreen.usernameTxt.value;
    const password = RegisterScreen.passwordTxt.value;
    const password2 = RegisterScreen.password2Txt.value;
    const email = RegisterScreen.emailTxt.value;

    if (username.length < 4) requestError = 'short_username';
    else if (username.length > 10) requestError = 'long_username';
    else if (password.length < 8) requestError = 'short_password';
    else if (password.length > 32) requestError = 'long_password';
    else if (password !== password2) { requestError = 'mismatch_password'; RegisterScreen.passwordTxt.value=''; RegisterScreen.password2Txt.value=''; }

    if (requestError) {
      console.log('validation error', requestError);
      this.lastResult = requestError;
      this.lastResultTime = Date.now();
      return;
    }

    this.sentRequest = true;
    this.requestInitTime = Date.now();
    this.render();

    this.socket.emit('register', {
      username: username,
      password: password,
      challenge: '',
      response: '',
      email: email
    });
  }
}
