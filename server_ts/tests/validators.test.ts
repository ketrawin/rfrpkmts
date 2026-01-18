import { isValidUsername, isValidPassword, isValidEmail, validateCredentials } from '../src/utils/validators';

describe('validators', () => {
  test('isValidUsername valid/invalid', () => {
    expect(isValidUsername('abc')).toBe(false); // too short
    expect(isValidUsername('valid_user')).toBe(true);
    expect(isValidUsername('user-with-dash')).toBe(false);
  });

  test('isValidPassword valid/invalid', () => {
    expect(isValidPassword('short')).toBe(false);
    expect(isValidPassword('longenoughpassword')).toBe(true);
  });

  test('isValidEmail valid/invalid', () => {
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('alice@example.com')).toBe(true);
  });

  test('validateCredentials reports errors', () => {
    expect(validateCredentials({ username: 'a', password: 'b' }).ok).toBe(false);
    expect(validateCredentials({ username: 'gooduser', password: 'goodpass', email: 'bad' }).ok).toBe(false);
    expect(validateCredentials({ username: 'gooduser', password: 'goodpass', email: 'ok@example.com' }).ok).toBe(true);
  });
});
