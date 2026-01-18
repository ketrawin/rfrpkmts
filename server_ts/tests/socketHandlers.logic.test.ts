import { handleLogin, handleRegister, handleTokenUpdate } from '../src/socketHandlers.logic';

jest.mock('../src/services/auth.service', () => ({
  registerUser: jest.fn(),
  loginUser: jest.fn()
}));
jest.mock('../src/services/character.service', () => ({
  userHasCharacter: jest.fn(),
  createCharacterForUser: jest.fn(),
  getCharacterForUser: jest.fn()
}));
jest.mock('../src/gameLogic', () => ({
  sendLoadMapForUser: jest.fn()
}));

const AuthService = require('../src/services/auth.service');
const CharacterService = require('../src/services/character.service');
const GameLogic = require('../src/gameLogic');

function makeSocket() {
  const onceHandlers: Record<string, Function[]> = {};
  return {
    handshake: { address: '1.2.3.4', auth: {}, headers: {} },
    data: {},
    emit: jest.fn(),
    once: jest.fn((ev: string, h: Function) => { onceHandlers[ev] = onceHandlers[ev] || []; onceHandlers[ev].push(h); }),
    __invokeOnce(ev: string, payload: any) { (onceHandlers[ev] || []).forEach(fn => fn(payload)); }
  } as any;
}

describe('socketHandlers.logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('handleLogin missing fields', async () => {
    const socket = makeSocket();
    await handleLogin(socket, {} as any);
    expect(socket.emit).toHaveBeenCalledWith('login_result', { result: 'missing_fields' });
  });

  test('handleLogin success, no character -> emits newGame and login_result', async () => {
    const socket = makeSocket();
    AuthService.loginUser.mockResolvedValue({ ok: true, token: 'tok', user: { username: 'alice' } });
    CharacterService.userHasCharacter.mockResolvedValue(false);

    await handleLogin(socket, { username: 'alice', password: 'pwd' });

    expect(socket.emit).toHaveBeenCalledWith('login_result', { result: 'success', token: 'tok' });
    expect(socket.emit).toHaveBeenCalledWith('newGame', expect.objectContaining({ username: 'alice' }));
  });

  test('handleLogin success, has character -> startGame + sendLoadMapForUser', async () => {
    const socket = makeSocket();
    AuthService.loginUser.mockResolvedValue({ ok: true, token: 'tok', user: { username: 'bob' } });
    CharacterService.userHasCharacter.mockResolvedValue(true);
    GameLogic.sendLoadMapForUser.mockResolvedValue(undefined);

    await handleLogin(socket, { username: 'bob', password: 'pwd' });

    expect(socket.emit).toHaveBeenCalledWith('login_result', { result: 'success', token: 'tok' });
    expect(socket.emit).toHaveBeenCalledWith('startGame', { username: 'bob' });
    expect(GameLogic.sendLoadMapForUser).toHaveBeenCalledWith(socket, 'bob');
  });

  test('handleRegister missing fields', async () => {
    const socket = makeSocket();
    await handleRegister(socket, { username: 'a' } as any);
    expect(socket.emit).toHaveBeenCalledWith('registration', { result: 'missing_fields' });
  });

  test('handleRegister success', async () => {
    const socket = makeSocket();
    AuthService.registerUser.mockResolvedValue({ ok: true });
    await handleRegister(socket, { username: 'carl', password: 'longpassword', email: 'carl@example.com' });
    expect(AuthService.registerUser).toHaveBeenCalledWith({ username: 'carl', password: 'longpassword', email: 'carl@example.com' });
    expect(socket.emit).toHaveBeenCalledWith('registration', { result: 'success' });
  });

  test('handleTokenUpdate invalid token', async () => {
    const socket = makeSocket();
    await handleTokenUpdate(socket, { token: 'bad' });
    // invalid token should emit invalid_token or missing_token; since JWT verify will fail, expect invalid_token
    // Implementation emits 'tokenUpdate_result' with invalid_token
    expect(socket.emit).toHaveBeenCalledWith('tokenUpdate_result', { result: 'invalid_token' });
  });
});
