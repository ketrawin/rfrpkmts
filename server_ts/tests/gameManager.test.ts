import { GameManager } from '../src/managers/GameManager';

jest.useFakeTimers();

describe('GameManager basic tick and session', () => {
  test('tick increments session tickCount', () => {
    const gm = new GameManager(50);
    gm.start();
    gm.ensureSession('alice');
    expect(gm.getSession('alice')).not.toBeNull();
    // advance timers
    jest.advanceTimersByTime(200);
    const s = gm.getSession('alice') as any;
    expect(s).not.toBeNull();
    expect(s.tickCount).toBeGreaterThanOrEqual(3);
    gm.stop();
  });

  test('removeSession works', () => {
    const gm = new GameManager(1000);
    gm.ensureSession('bob');
    expect(gm.getSession('bob')).not.toBeNull();
    gm.removeSession('bob');
    expect(gm.getSession('bob')).toBeNull();
  });
});
