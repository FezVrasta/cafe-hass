// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { describeHassError } from '../ha-api';

describe('describeHassError', () => {
  it('reads the message Home Assistant sends back from a save', () => {
    // What hass.callApi rejects with when the config is refused (#192).
    expect(
      describeHassError({
        error: 'Bad Request',
        status_code: 400,
        body: { message: "Message malformed: required key not provided @ data['entity_id']" },
      })
    ).toBe("Message malformed: required key not provided @ data['entity_id']");
  });

  it('reads a websocket {code, message} rejection', () => {
    expect(describeHassError({ code: 'invalid_format', message: 'expected a dict' })).toBe(
      'expected a dict'
    );
  });

  it('reads a plain Error', () => {
    expect(describeHassError(new Error('boom'))).toBe('boom');
  });

  it('reads a thrown string', () => {
    expect(describeHassError('boom')).toBe('boom');
  });

  it('falls back when there is nothing to read', () => {
    expect(describeHassError(undefined)).toBe('Unknown error');
    expect(describeHassError(null)).toBe('Unknown error');
    expect(describeHassError({})).toBe('Unknown error');
    expect(describeHassError({ message: '   ' })).toBe('Unknown error');
  });
});
