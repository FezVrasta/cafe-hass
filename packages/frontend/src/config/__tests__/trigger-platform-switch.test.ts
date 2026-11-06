// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getTriggerPlatformSwitchPatch } from '../triggerFields';

describe('Switching a trigger node to another platform', () => {
  it('applies the defaults of the new platform', () => {
    const patch = getTriggerPlatformSwitchPatch(
      { trigger: 'state', entity_id: 'light.living' },
      'sun'
    );

    expect(patch.trigger).toBe('sun');
    expect(patch.event).toBe('sunset');
  });

  it('clears the fields of the platform it came from', () => {
    const patch = getTriggerPlatformSwitchPatch(
      { trigger: 'state', entity_id: 'binary_sensor.motion', to: 'on', for: { minutes: 5 } },
      'sun'
    );

    expect(patch).toMatchObject({
      trigger: 'sun',
      entity_id: undefined,
      to: undefined,
      for: undefined,
    });
  });

  it('keeps a device trigger’s device when switching to device', () => {
    const patch = getTriggerPlatformSwitchPatch(
      { trigger: 'state', entity_id: 'light.living', device_id: 'abc' },
      'device'
    );

    expect(patch.trigger).toBe('device');
    expect(patch.device_id).toBeUndefined();
    expect('device_id' in patch).toBe(false);
  });

  it('clears device_id when switching away from a device trigger', () => {
    const patch = getTriggerPlatformSwitchPatch(
      { trigger: 'device', device_id: 'abc', domain: 'light' },
      'state'
    );

    expect(patch.device_id).toBeUndefined();
    expect('device_id' in patch).toBe(true);
  });

  it('keeps keys shared by both platforms', () => {
    const patch = getTriggerPlatformSwitchPatch(
      { trigger: 'zone', entity_id: 'person.a', zone: 'zone.home', alias: 'Leaving home' },
      'state'
    );

    expect('entity_id' in patch).toBe(false);
  });
});
