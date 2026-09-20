// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { normalizeSelectorOptions } from '../selector-options';

describe('normalizeSelectorOptions', () => {
  it('reads a plain list of strings', () => {
    expect(normalizeSelectorOptions(['cool', 'heat'])).toEqual([
      { value: 'cool', label: 'cool' },
      { value: 'heat', label: 'heat' },
    ]);
  });

  it('reads value/label tuples', () => {
    expect(
      normalizeSelectorOptions([
        ['cool', 'Cool'],
        ['heat', 'Heat'],
      ])
    ).toEqual([
      { value: 'cool', label: 'Cool' },
      { value: 'heat', label: 'Heat' },
    ]);
  });

  it('reads {value, label} objects, which used to render as React error #31', () => {
    expect(
      normalizeSelectorOptions([
        { value: 'cool', label: 'Cool' },
        { value: 'heat', label: 'Heat' },
      ])
    ).toEqual([
      { value: 'cool', label: 'Cool' },
      { value: 'heat', label: 'Heat' },
    ]);
  });

  it('falls back to the value when an object has no label', () => {
    expect(normalizeSelectorOptions([{ value: 'cool' }])).toEqual([
      { value: 'cool', label: 'cool' },
    ]);
  });

  it('stringifies numeric options', () => {
    expect(normalizeSelectorOptions([1, 2])).toEqual([
      { value: '1', label: '1' },
      { value: '2', label: '2' },
    ]);
  });

  it('skips entries with no value at all', () => {
    expect(normalizeSelectorOptions([{ label: 'Cool' }, null, undefined, []])).toEqual([]);
  });

  it('returns nothing for a missing or malformed option list', () => {
    expect(normalizeSelectorOptions(undefined)).toEqual([]);
    expect(normalizeSelectorOptions(null)).toEqual([]);
    expect(normalizeSelectorOptions('cool')).toEqual([]);
    expect(normalizeSelectorOptions({ cool: true })).toEqual([]);
  });
});
