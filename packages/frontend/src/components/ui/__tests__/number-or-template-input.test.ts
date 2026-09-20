// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  formatNumberOrTemplate,
  isTemplateValue,
  parseNumberOrTemplate,
} from '../NumberOrTemplateInput';

describe('parseNumberOrTemplate', () => {
  it('stores a number as a number', () => {
    expect(parseNumberOrTemplate('50')).toBe(50);
    expect(parseNumberOrTemplate(' 12.5 ')).toBe(12.5);
    expect(parseNumberOrTemplate('-3')).toBe(-3);
  });

  it('keeps a template, which the number input used to throw away', () => {
    const template = "{{ states('input_number.brightness') | int }}";
    expect(parseNumberOrTemplate(template)).toBe(template);
  });

  it('keeps a statement template', () => {
    const template = '{% if is_state("sun.sun", "above_horizon") %}100{% else %}20{% endif %}';
    expect(parseNumberOrTemplate(template)).toBe(template);
  });

  it('reports an empty field as no value', () => {
    expect(parseNumberOrTemplate('')).toBeUndefined();
    expect(parseNumberOrTemplate('   ')).toBeUndefined();
  });
});

describe('formatNumberOrTemplate', () => {
  it('shows numbers and templates as typed', () => {
    expect(formatNumberOrTemplate(50)).toBe('50');
    expect(formatNumberOrTemplate('{{ x }}')).toBe('{{ x }}');
  });

  it('shows an empty field for no value', () => {
    expect(formatNumberOrTemplate(undefined)).toBe('');
    expect(formatNumberOrTemplate(null)).toBe('');
    expect(formatNumberOrTemplate({ nested: true })).toBe('');
  });
});

describe('isTemplateValue', () => {
  it('recognises both Jinja delimiters', () => {
    expect(isTemplateValue('{{ states("x") }}')).toBe(true);
    expect(isTemplateValue('{% if x %}1{% endif %}')).toBe(true);
  });

  it('does not call a plain value a template', () => {
    expect(isTemplateValue('50')).toBe(false);
    expect(isTemplateValue(50)).toBe(false);
    expect(isTemplateValue(undefined)).toBe(false);
  });
});
