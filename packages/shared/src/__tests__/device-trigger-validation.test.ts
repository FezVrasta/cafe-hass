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

  it('should require entity_id for device triggers', () => {
    const deviceTriggerWithoutEntityId = {
      trigger: 'device',
      device_id: 'some-device-id',
      type: 'turned_on',
      domain: 'light',
    };

    const result = TriggerNodeValidationSchema.safeParse(deviceTriggerWithoutEntityId);
    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({
        message: 'Entity is required for device triggers',
        path: ['entity_id'],
      })
    );
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

  it('should reject device trigger with empty string entity_id', () => {
    const deviceTriggerWithEmptyEntityId = {
      trigger: 'device',
      device_id: 'some-device-id',
      entity_id: '',
      type: 'turned_on',
      domain: 'light',
    };

    const result = TriggerNodeValidationSchema.safeParse(deviceTriggerWithEmptyEntityId);
    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({
        message: 'Entity is required for device triggers',
        path: ['entity_id'],
      })
    );
  });

  it('should reject device trigger with empty array entity_id', () => {
    const deviceTriggerWithEmptyArrayEntityId = {
      trigger: 'device',
      device_id: 'some-device-id',
      entity_id: [],
      type: 'turned_on',
      domain: 'light',
    };

    const result = TriggerNodeValidationSchema.safeParse(deviceTriggerWithEmptyArrayEntityId);
    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({
        message: 'Entity is required for device triggers',
        path: ['entity_id'],
      })
    );
  });
});