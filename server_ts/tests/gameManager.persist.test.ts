import { GameManager } from '../src/managers/GameManager';

jest.useFakeTimers();

describe('GameManager persistence batching', () => {
  test('flushPositions calls updatePosition for dirty sessions', async () => {
    const gm = new GameManager(1000);
    // mock CharacterService.updatePosition
    const charService = require('../src/services/character.service');
    const spy = jest.spyOn(charService, 'updatePosition').mockResolvedValue(undefined);

    gm.setPersistPositions(true);
    gm.setFlushInterval(50);

    const mockSocket: any = { id: 's1', emit: jest.fn() };
    const username = 'persistUser';
    const sess = gm.ensureSession(username, mockSocket) as any;
    sess.player = { x: 1, y: 1, direction: 0 };

    gm.handleInput(username, { type: 'move', direction: 3 });

    // advance timers to trigger flush
    jest.advanceTimersByTime(100);
    // allow any pending promises to resolve
    await Promise.resolve();

    expect(spy).toHaveBeenCalledWith(username, 2, 1, 0);
    spy.mockRestore();
    gm.setPersistPositions(false);
  });
});
