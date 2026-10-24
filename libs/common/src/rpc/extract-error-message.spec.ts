import { extractErrorMessage } from './extract-error-message';

describe('extractErrorMessage', () => {
  it('returns .message for Error instances', () => {
    expect(extractErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns the string for plain strings', () => {
    expect(extractErrorMessage('plain failure')).toBe('plain failure');
  });

  it('extracts message from a plain RPC error object', () => {
    expect(
      extractErrorMessage({ statusCode: 400, message: 'Invalid file ids' }),
    ).toBe('Invalid file ids');
  });

  it('uses the first entry when message is an array', () => {
    expect(extractErrorMessage({ message: ['first', 'second'] })).toBe(
      'first; second',
    );
  });

  it('reads a nested error object', () => {
    expect(extractErrorMessage({ error: { message: 'nested msg' } })).toBe(
      'nested msg',
    );
  });

  it('falls back to JSON for objects without a message', () => {
    expect(extractErrorMessage({ code: 'ECONNREFUSED' })).toBe(
      '{"code":"ECONNREFUSED"}',
    );
  });

  it('never returns [object Object]', () => {
    expect(extractErrorMessage({})).toBe('Unknown error');
    expect(extractErrorMessage({})).not.toBe('[object Object]');
  });
});
