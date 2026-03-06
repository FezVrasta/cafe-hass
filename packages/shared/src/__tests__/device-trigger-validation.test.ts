// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { TriggerNodeValidationSchema } from '../schemas/validation';

describe('Device Trigger Validation', () => {
  it('should require device_id for device triggers', () => {
    const deviceTriggerWithoutDeviceId = {
      trigger: 'device',
      type: 'turned_on',
      domain: 'light',
    };

    const result = TriggerNodeValidationSchema.safeParse(deviceTriggerWithoutDeviceId);
    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({
        message: 'Device is required',
        path: ['device_id'],
      })
    );
  });

  it('should NOT require entity_id for device triggers (e.g. ZHA remotes)', () => {
    const zhaDeviceTrigger = {
      trigger: 'device',
      device_id: 'some-device-id',
      domain: 'zha',
      type: 'remote_button_short_press',
      subtype: 'turn_on',
    };

    const result = TriggerNodeValidationSchema.safeParse(zhaDeviceTrigger);
    expect(result.success).toBe(true);
  });

  it('should accept valid device trigger with both device_id and entity_id', () => {
    const validDeviceTrigger = {
      trigger: 'device',
      device_id: 'some-device-id',
      entity_id: 'light.living_room',
      type: 'turned_on',
      domain: 'light',
    };

    const result = TriggerNodeValidationSchema.safeParse(validDeviceTrigger);
    expect(result.success).toBe(true);
  });

  it('should accept device trigger with entity_id as array', () => {
    const validDeviceTriggerWithArray = {
      trigger: 'device',
      device_id: 'some-device-id',
      entity_id: ['light.living_room', 'light.bedroom'],
      type: 'turned_on',
      domain: 'light',
    };

    const result = TriggerNodeValidationSchema.safeParse(validDeviceTriggerWithArray);
    expect(result.success).toBe(true);
  });

  it('should accept device trigger without entity_id for standard domain triggers', () => {
    const deviceTriggerWithoutEntityId = {
      trigger: 'device',
      device_id: 'some-device-id',
      type: 'turned_on',
      domain: 'light',
    };

    const result = TriggerNodeValidationSchema.safeParse(deviceTriggerWithoutEntityId);
    expect(result.success).toBe(true);
  });
});
