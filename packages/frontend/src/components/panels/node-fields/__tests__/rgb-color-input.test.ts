// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { formatRgbColor, parseRgbColor } from '../RgbColorInput';

describe('parseRgbColor', () => {
  it('parses a comma-separated colour into numbers', () => {
    expect(parseRgbColor('255,100,50')).toEqual([255, 100, 50]);
  });

  it('ignores the spacing around each number', () => {
    expect(parseRgbColor('  145 , 65 ,172 ')).toEqual([145, 65, 172]);
  });

  it('drops the empty segment left by a trailing comma', () => {
    expect(parseRgbColor('255,100,')).toEqual([255, 100]);
  });

  it('returns an empty value for an empty field', () => {
    expect(parseRgbColor('')).toBe('');
    expect(parseRgbColor('  ,  ')).toBe('');
  });

  it('keeps text that is not a list of numbers', () => {
    expect(parseRgbColor('255, red, 50')).toBe('255, red, 50');
  });
});

describe('formatRgbColor', () => {
  it('shows a stored array as a comma-separated list', () => {
    expect(formatRgbColor([145, 65, 172])).toBe('145, 65, 172');
  });

  it('shows an empty field for a missing value', () => {
    expect(formatRgbColor(undefined)).toBe('');
    expect(formatRgbColor(null)).toBe('');
  });

  it('passes a string through unchanged', () => {
    expect(formatRgbColor('255, red, 50')).toBe('255, red, 50');
  });
});
