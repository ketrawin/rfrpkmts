import { GameManager } from '../src/managers/GameManager';

describe('GameManager handleInput and broadcast', () => {
  test('handleInput moves player and emits via socket', () => {
    const gm = new GameManager(1000);
    // create mock socket
    const emitted: any[] = [];
    const mockSocket: any = { id: 's1', emit: (ev: string, payload: any) => emitted.push({ ev, payload }) };
    const username = 'tester';
    const sess = gm.ensureSession(username, mockSocket) as any;
    // seed player
    sess.player = { x: 5, y: 5, direction: 0 };
    // move right (3)
    gm.handleInput(username, { type: 'move', direction: 3 });
    expect(sess.player.x).toBe(6);
    expect(emitted.length).toBeGreaterThan(0);
    const last = emitted[emitted.length - 1];
    expect(last.ev).toBe('player_update');
    expect(last.payload).toMatchObject({ username, x: 6, y: 5 });
  });
});
