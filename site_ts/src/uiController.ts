import { Socket } from 'socket.io-client';
import { TitleScreen } from './screens/TitleScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import NewGameScreen from './screens/NewGameScreen';
import type { ClientToServerEvents, ServerToClientEvents } from './types/socketEvents';

export class UIController {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  currentScreen: { render?: () => void; destroy?: () => void; player?: any } | null = null;

  constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, socket: Socket<ServerToClientEvents, ClientToServerEvents>) {
    this.canvas = canvas; this.ctx = ctx; this.socket = socket;
  }

  openTitle() {
    if (this.currentScreen && this.currentScreen.destroy) this.currentScreen.destroy();
    const title = new TitleScreen(this.canvas, this.ctx, this.socket, () => this.openRegisterFromTitle(title));
    this.currentScreen = title;
    if (!window.pokemmo_ts) window.pokemmo_ts = {} as any;
    window.pokemmo_ts!.current = this.currentScreen;
    title.render();
  }

  openRegisterFromTitle(titleInst?: any) {
    if (this.currentScreen && this.currentScreen.destroy) this.currentScreen.destroy();
    const init = { username: undefined as string | undefined, password: undefined as string | undefined };
    try {
      init.username = (TitleScreen as any).usernameTxt ? (TitleScreen as any).usernameTxt.value : undefined;
      init.password = (TitleScreen as any).passwordTxt ? (TitleScreen as any).passwordTxt.value : undefined;
    } catch (e) {}
    const reg = new RegisterScreen(this.canvas, this.ctx, this.socket, () => this.openTitle(), init);
    this.currentScreen = reg;
    if (!window.pokemmo_ts) window.pokemmo_ts = {} as any;
    window.pokemmo_ts!.current = this.currentScreen;
    reg.render();
  }

  openNewGame(starters: string[], characters: string[]) {
    if (this.currentScreen && this.currentScreen.destroy) this.currentScreen.destroy();
    const ng = new NewGameScreen(this.canvas, this.ctx, this.socket, starters, characters);
    this.currentScreen = ng;
    if (!window.pokemmo_ts) window.pokemmo_ts = {} as any;
    window.pokemmo_ts!.current = this.currentScreen;
    ng.render();
  }

  closeCurrent() {
    if (this.currentScreen && this.currentScreen.destroy) this.currentScreen.destroy();
    this.currentScreen = null;
    if (window.pokemmo_ts) window.pokemmo_ts.current = null;
  }
}
