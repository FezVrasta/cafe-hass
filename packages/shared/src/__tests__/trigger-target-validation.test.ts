// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { HATriggerSchema } from '../schemas/ha-schemas';

describe('Trigger target validation', () => {
  it('accepts an entity target', () => {
    const result = HATriggerSchema.safeParse({
      trigger: 'state',
      target: { entity_id: 'light.living_room' },
    });

    expect(result.success).toBe(true);
  });

  it('accepts a device target', () => {
    const result = HATriggerSchema.safeParse({
      trigger: 'power.crossed_threshold',
      target: { device_id: 'ac841705789afd9e919f31ac5007629d' },
    });

    expect(result.success).toBe(true);
  });

  it('accepts a label target', () => {
    const result = HATriggerSchema.safeParse({
      trigger: 'power.crossed_threshold',
      target: { label_id: 'washers' },
    });

    expect(result.success).toBe(true);
  });

  it('accepts area and floor targets', () => {
    const area = HATriggerSchema.safeParse({
      trigger: 'state',
      target: { area_id: ['kitchen', 'hallway'] },
    });
    const floor = HATriggerSchema.safeParse({
      trigger: 'state',
      target: { floor_id: 'ground_floor' },
    });

    expect(area.success).toBe(true);
    expect(floor.success).toBe(true);
  });

  it('accepts several target kinds at once', () => {
    const result = HATriggerSchema.safeParse({
      trigger: 'state',
      target: {
        entity_id: ['light.kitchen'],
        device_id: 'ac841705789afd9e919f31ac5007629d',
        label_id: ['washers'],
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects an id that is neither a string nor a list of strings', () => {
    const result = HATriggerSchema.safeParse({
      trigger: 'state',
      target: { device_id: 42 },
    });

    expect(result.success).toBe(false);
  });

  it('keeps the target on the parsed trigger', () => {
    const result = HATriggerSchema.parse({
      trigger: 'power.crossed_threshold',
      target: { device_id: 'ac841705789afd9e919f31ac5007629d' },
      options: { behavior: 'each' },
    });

    expect(result.target).toEqual({ device_id: 'ac841705789afd9e919f31ac5007629d' });
  });
});
